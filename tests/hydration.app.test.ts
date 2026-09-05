import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { InMemoryFoodSourceRepository } from '../src/persistence/inMemoryFoodSource.js';
import type { FoodSourceProvider } from '../src/persistence/foodSourceProvider.js';
import type { FoodSourceRepository } from '../src/persistence/foodSourceRepository.js';
import type { FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import { fixedClock, makeContainer, seededRepo, until, wiredCatalog } from './_helpers.js';

const SAMPLE_CATALOG: SourcedFood[] = [
  {
    id: 'usda:1', name: 'Apple, raw',
    nutritionFacts: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
    servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: '1',
  },
  {
    id: 'usda:2', name: 'Mango, raw',
    nutritionFacts: { calories: 60, protein: 0.8, carbs: 15, fat: 0.4 },
    servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: '2',
  },
];

function makeManifest(version = 'v1'): FoodSourceManifest {
  return {
    source: 'usda', version,
    itemCount: SAMPLE_CATALOG.length,
    sha256: 'a'.repeat(64),
    generatedAt: '2026-05-29T00:00:00.000Z',
  };
}

type FakeProviderOptions = {
  items?: SourcedFood[];
  manifestVersion?: string;
  fetchManifestThrows?: string;
  fetchDatasetThrows?: string;
  emitProgress?: boolean;
  holdUntil?: Promise<void>;
};

function fakeProvider(opts: FakeProviderOptions = {}): FoodSourceProvider {
  return {
    name: 'usda',
    async fetchManifest(version: string): Promise<FoodSourceManifest> {
      if (opts.fetchManifestThrows) {
        throw new Error(opts.fetchManifestThrows);
      }

      return makeManifest(opts.manifestVersion ?? version);
    },
    async fetchDataset(_manifest, onProgress) {
      if (opts.fetchDatasetThrows) {
        throw new Error(opts.fetchDatasetThrows);
      }

      if (opts.emitProgress) {
        onProgress?.(51200);
        onProgress?.(102400);
      }

      if (opts.holdUntil) {
        await opts.holdUntil;
      }

      return [...(opts.items ?? SAMPLE_CATALOG)];
    },
  };
}

describe('app — catalog hydration boot flow', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('runs without a catalog: picker shows user foods and no banner renders', async () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    expect(container.querySelectorAll('[data-testid="food-option"]').length).to.equal(10);
    expect(container.querySelector('[data-testid="hydration-banner"]')).to.equal(null);
  });

  it('shows a per-tier banner while the first-launch fetch is in flight', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    let releaseHold!: () => void;
    const hold = new Promise<void>((r) => { releaseHold = r; });
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1' }, [fakeProvider({ holdUntil: hold })]),
    });

    await until(() => container.querySelector('[data-testid="hydration-banner"]') !== null, 'banner appears');
    expect(container.querySelector('[data-testid="hydration-banner"]')!.textContent).to.equal('Everyday foods: downloading…');
    releaseHold();
  });

  it('clears the banner and populates the catalog after a successful fetch', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1' }, [fakeProvider()]),
    });

    await until(async () => (await catalog.currentVersion('usda')) === 'v1', 'catalog hydrated');
    await until(() => container.querySelector('[data-testid="hydration-banner"]') === null, 'banner clears');

    const stored = await catalog.search('raw', { limit: 10 });
    expect(stored.map((f) => f.name)).to.deep.equal(['Apple, raw', 'Mango, raw']);
    expect(await catalog.currentVersion('usda')).to.equal('v1');
  });

  it('renders downloaded kilobytes on the banner when provider emits progress', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    let releaseHold!: () => void;
    const hold = new Promise<void>((r) => { releaseHold = r; });
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1' }, [fakeProvider({ emitProgress: true, holdUntil: hold })]),
    });

    await until(() => {
      const banner = container.querySelector('[data-testid="hydration-banner"]');
      return banner !== null && banner.textContent === 'Everyday foods: downloading… 100 KB';
    }, 'banner shows 100 KB');

    releaseHold();
  });

  it('shows the first-launch failure banner when the fetch fails and nothing is cached', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1' }, [fakeProvider({ fetchManifestThrows: 'network down' })]),
    });

    await until(() => container.querySelector('[data-testid="hydration-error"]') !== null,
      'failure banner appears');

    const err = container.querySelector('[data-testid="hydration-error"]')!;
    expect(err.textContent).to.equal("Everyday foods: couldn't load. Reload to retry.");
    expect(err.getAttribute('title')).to.equal('network down');
    expect(err.getAttribute('data-state')).to.equal('first-launch');
    expect(await catalog.currentVersion('usda')).to.equal(null);
  });

  it('rejects a manifest reporting a different version than requested, so a skewed provider cannot force a download on every boot', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1' }, [fakeProvider({ manifestVersion: 'v9' })]),
    });

    await until(() => container.querySelector('[data-testid="hydration-error"]') !== null,
      'failure banner appears');

    const err = container.querySelector('[data-testid="hydration-error"]')!;
    expect(err.getAttribute('title')).to.include('v9');
    expect(await catalog.currentVersion('usda')).to.equal(null);
  });

  it('a repository that cannot open lands in the failed state and does not block other sources', async () => {
    const inner = new InMemoryFoodSourceRepository();
    const catalog: FoodSourceRepository = {
      currentVersion: (s) => (s === 'usda'
        ? Promise.reject(new Error('IndexedDB unavailable'))
        : inner.currentVersion(s)),
      hydrate: (s, items, m) => inner.hydrate(s, items, m),
      search: (q, o) => inner.search(q, o),
    };
    const pantryProvider: FoodSourceProvider = {
      name: 'pantry',
      async fetchManifest(version) { return { ...makeManifest(version), source: 'pantry' }; },
      async fetchDataset() {
        return SAMPLE_CATALOG.map((f) => ({ ...f, id: `pantry:${f.sourceId}`, source: 'pantry' }));
      },
    };
    const repo = new InMemoryRepository();
    repo.save({ version: 2, enabledSources: ['usda', 'pantry'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });
    createApp({
      container,
      repo,
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1', pantry: 'v1' }, [fakeProvider(), pantryProvider]),
    });

    await until(
      () => container.querySelector('[data-testid="hydration-error"][data-source="usda"]') !== null,
      'usda reaches the failed state',
    );
    await until(async () => (await inner.currentVersion('pantry')) === 'v1', 'pantry still hydrates');
    await until(
      () => container.querySelector('[data-testid="hydration-banner"]') === null,
      'no source is left on the fetching banner',
    );

    const err = container.querySelector('[data-testid="hydration-error"][data-source="usda"]')!;
    expect(err.getAttribute('title')).to.equal('IndexedDB unavailable');
    expect(err.getAttribute('data-state')).to.equal('first-launch');
  });

  it('keeps using cached catalog when subsequent-launch fetch fails', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    await catalog.hydrate('usda', SAMPLE_CATALOG, makeManifest('v0'));

    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1' }, [fakeProvider({ fetchManifestThrows: 'flaky' })]),
    });

    await until(() => container.querySelector('[data-testid="hydration-error"]') !== null,
      'failure banner appears');

    const err = container.querySelector('[data-testid="hydration-error"]')!;
    expect(err.getAttribute('data-state')).to.equal('cached');
    expect(err.textContent).to.equal("Everyday foods: couldn't update. Using the cached copy (v0).");
    expect(await catalog.currentVersion('usda')).to.equal('v0');
  });

  it('never shows a banner or refetches when the cached version already matches', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    await catalog.hydrate('usda', SAMPLE_CATALOG, makeManifest('v1'));

    let manifestFetches = 0;
    const provider: FoodSourceProvider = {
      name: 'usda',
      async fetchManifest(version) { manifestFetches++; return makeManifest(version); },
      async fetchDataset() { return [...SAMPLE_CATALOG]; },
    };

    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1' }, [provider]),
    });

    const bannerWhileChecking = container.querySelector('[data-testid="hydration-banner"]') !== null;
    expect(bannerWhileChecking, 'no banner while the cached version is being checked').to.equal(false);

    // Give any pending boot work a chance to run.
    await new Promise((r) => setTimeout(r, 20));

    expect(manifestFetches).to.equal(0);
    expect(container.querySelector('[data-testid="hydration-banner"]')).to.equal(null);
  });

  it('aborts hydration when SHA verification fails inside the provider', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1' }, [fakeProvider({ fetchDatasetThrows: 'SHA-256 mismatch' })]),
    });

    await until(() => container.querySelector('[data-testid="hydration-error"]') !== null,
      'error banner');

    const err = container.querySelector('[data-testid="hydration-error"]')!;
    expect(err.textContent).to.match(/couldn't/i);
    expect(await catalog.currentVersion('usda')).to.equal(null);
  });

  it('shows a failed state instead of a stuck banner when a source has no provider', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    const repo = new InMemoryRepository();
    repo.save({ version: 2, enabledSources: ['usda', 'pantry'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });
    createApp({
      container,
      repo,
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1', pantry: 'v1' }, [fakeProvider()]),
    });

    await until(
      () => container.querySelector('[data-testid="hydration-error"][data-source="pantry"]') !== null,
      'pantry reaches a failed state',
    );
    await until(
      () => container.querySelector('[data-testid="hydration-banner"]') === null,
      'no source is left stuck on the fetching banner',
    );
  });

  it('boot hydrates only enabled sources: a wired-but-disabled source fetches nothing and shows no banner', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    let pantryFetches = 0;
    const pantryProvider: FoodSourceProvider = {
      name: 'pantry',
      async fetchManifest(version) { pantryFetches++; return { ...makeManifest(version), source: 'pantry' }; },
      async fetchDataset() { return []; },
    };

    const repo = new InMemoryRepository();
    repo.save({ version: 2, enabledSources: ['usda'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });
    createApp({
      container,
      repo,
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1', pantry: 'v1' }, [fakeProvider(), pantryProvider]),
    });

    await until(async () => (await catalog.currentVersion('usda')) === 'v1', 'usda hydrates');

    expect(pantryFetches).to.equal(0);
    expect(container.querySelector('[data-testid="hydration-banner"][data-source="pantry"]')).to.equal(null);
    expect(container.querySelector('[data-testid="hydration-error"][data-source="pantry"]')).to.equal(null);
    expect(await catalog.currentVersion('pantry')).to.equal(null);
  });

  it('boot skips a source unticked while an earlier one is still downloading', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    let releaseHold!: () => void;
    const hold = new Promise<void>((r) => { releaseHold = r; });

    let pantryFetches = 0;
    const pantryProvider: FoodSourceProvider = {
      name: 'pantry',
      async fetchManifest(version) { return { ...makeManifest(version), source: 'pantry' }; },
      async fetchDataset() { pantryFetches++; return []; },
    };

    const repo = new InMemoryRepository();
    repo.save({ version: 2, enabledSources: ['usda', 'pantry'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

    createApp({
      container, repo, clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1', pantry: 'v1' }, [fakeProvider({ holdUntil: hold }), pantryProvider]),
    });

    // usda (first in wired order) is the source blocking boot's loop; untick
    // pantry before the loop's next iteration ever reaches it.
    await until(() => container.querySelector('[data-testid="hydration-banner"][data-source="usda"]') !== null, 'usda fetch starts');

    (container.querySelector('[data-testid="view-toggle-catalog"]') as HTMLButtonElement).click();
    (container.querySelector('[data-testid="source-picker-toggle"]') as HTMLButtonElement).click();
    (container.querySelector('[data-source="pantry"] [data-testid="source-checkbox"]') as HTMLInputElement).click();

    releaseHold();
    await until(() => container.querySelector('[data-testid="hydration-banner"][data-source="usda"]') === null, 'usda finishes');

    expect(pantryFetches).to.equal(0);
    const pantryBannerGone = container.querySelector('[data-testid="hydration-banner"][data-source="pantry"]') === null;
    expect(pantryBannerGone, 'pantry must never start fetching once unticked mid-boot').to.equal(true);
  });
});

describe('app — log picker', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('user foods still appear in the picker when a catalog is configured', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    const repo = seededRepo();
    createApp({
      container,
      repo,
      clock: fixedClock(),
      catalog: wiredCatalog(catalog, { usda: 'v1' }, [fakeProvider()]),
    });

    await until(async () => (await catalog.currentVersion('usda')) === 'v1', 'catalog hydrated');

    const input = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    input.value = 'banana';
    input.dispatchEvent(new Event('input'));

    const opts = Array.from(container.querySelectorAll('[data-testid="food-option"]')) as HTMLElement[];
    expect(opts.some((o) => o.textContent!.includes('Banana'))).to.equal(true);
  });

  it('switching to Foods view and back clears query and resets picker to default', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });

    const input = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    input.value = 'banana';
    input.dispatchEvent(new Event('input'));

    expect(container.querySelectorAll('[data-testid="food-option"]').length).to.equal(1);

    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();
    (container.querySelector('[data-testid="view-toggle-log"]') as HTMLButtonElement).click();

    const searchInput = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    expect(searchInput.value).to.equal('');
    expect(container.querySelectorAll('[data-testid="food-option"]').length).to.equal(10);
  });
});
