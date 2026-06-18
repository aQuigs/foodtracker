import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { InMemoryFoodSourceRepository } from '../src/persistence/inMemoryFoodSource.js';
import type { FoodSourceProvider } from '../src/persistence/foodSourceProvider.js';
import type { FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import { fixedClock, makeContainer, seedTestState } from './_helpers.js';

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
      return { ...makeManifest(opts.manifestVersion ?? version) };
    },
    async fetchDataset(_manifest, onProgress) {
      if (opts.fetchDatasetThrows) {
        throw new Error(opts.fetchDatasetThrows);
      }
      if (opts.emitProgress) {
        onProgress?.(500, 1000);
        onProgress?.(1000, 1000);
      }
      if (opts.holdUntil) {
        await opts.holdUntil;
      }
      return [...(opts.items ?? SAMPLE_CATALOG)];
    },
  };
}


// Wait until the app reaches a state predicate. Drains microtasks repeatedly.
async function until(check: () => boolean, label = 'condition', timeoutMs = 1000): Promise<void> {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((r) => setTimeout(r, 4));
  }
}

describe('app — catalog hydration boot flow', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('does not change behavior when no catalog is provided (back-compat)', async () => {
    const repo = new InMemoryRepository();
    repo.save(seedTestState());
    createApp({ container, repo, clock: fixedClock() });
    expect(container.querySelectorAll('[data-testid="food-option"]').length).to.equal(10);
    expect(container.querySelector('[data-testid="hydration-banner"]')).to.equal(null);
  });

  it('shows the hydration banner during first-launch fetch', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog,
      catalogProviders: [fakeProvider()],
      catalogVersions: { usda: 'v1' },
    });

    // Immediately after createApp, the banner is on screen (fetch is pending).
    expect(container.querySelector('[data-testid="hydration-banner"]')).to.exist;
  });

  it('clears the banner and populates the catalog after a successful fetch', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog,
      catalogProviders: [fakeProvider()],
      catalogVersions: { usda: 'v1' },
    });

    await until(() => container.querySelector('[data-testid="hydration-banner"]') === null,
      'banner clears');

    expect(await catalog.count('usda')).to.equal(SAMPLE_CATALOG.length);
    expect(await catalog.currentVersion('usda')).to.equal('v1');
  });

  it('renders progress bytes on the banner when provider emits progress', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    let releaseHold!: () => void;
    const hold = new Promise<void>((r) => { releaseHold = r; });
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog,
      catalogProviders: [fakeProvider({ emitProgress: true, holdUntil: hold })],
      catalogVersions: { usda: 'v1' },
    });

    await until(() => {
      const banner = container.querySelector('[data-testid="hydration-banner"]');
      return banner !== null && banner.textContent!.includes('1000');
    }, 'banner shows 1000 bytes');

    releaseHold();
  });

  it('shows first-launch failure banner when fetch fails and IndexedDB is empty', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog,
      catalogProviders: [fakeProvider({ fetchManifestThrows: 'network down' })],
      catalogVersions: { usda: 'v1' },
    });

    await until(() => container.querySelector('[data-testid="hydration-error"]') !== null,
      'failure banner appears');

    const err = container.querySelector('[data-testid="hydration-error"]')!;
    expect(err.textContent).to.match(/couldn't|reload/i);
    expect(err.getAttribute('data-state')).to.equal('first-launch');
    expect(await catalog.isHydrated('usda')).to.equal(false);
  });

  it('keeps using cached catalog when subsequent-launch fetch fails', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    // Pre-hydrate with an older version.
    await catalog.hydrate('usda', SAMPLE_CATALOG, makeManifest('v0'));

    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog,
      catalogProviders: [fakeProvider({ fetchManifestThrows: 'flaky' })],
      catalogVersions: { usda: 'v1' },
    });

    await until(() => container.querySelector('[data-testid="hydration-error"]') !== null,
      'failure banner appears');

    const err = container.querySelector('[data-testid="hydration-error"]')!;
    expect(err.getAttribute('data-state')).to.equal('cached');
    expect(await catalog.currentVersion('usda')).to.equal('v0');
  });

  it('does not refetch when the cached version matches the expected version', async () => {
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
      catalog,
      catalogProviders: [provider],
      catalogVersions: { usda: 'v1' },
    });

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
      catalog,
      catalogProviders: [fakeProvider({ fetchDatasetThrows: 'SHA-256 mismatch' })],
      catalogVersions: { usda: 'v1' },
    });

    await until(() => container.querySelector('[data-testid="hydration-error"]') !== null,
      'error banner');

    const err = container.querySelector('[data-testid="hydration-error"]')!;
    expect(err.textContent).to.match(/couldn't/i);
    expect(await catalog.isHydrated('usda')).to.equal(false);
  });
});

describe('app — log picker with catalog present', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('user foods still appear in the picker when a catalog is configured', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    const repo = new InMemoryRepository();
    repo.save(seedTestState());
    createApp({
      container,
      repo,
      clock: fixedClock(),
      catalog,
      catalogProviders: [fakeProvider()],
      catalogVersions: { usda: 'v1' },
    });

    await until(() => container.querySelector('[data-testid="hydration-banner"]') === null);

    const input = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    input.value = 'banana';
    input.dispatchEvent(new Event('input'));

    const opts = Array.from(container.querySelectorAll('[data-testid="food-option"]')) as HTMLElement[];
    expect(opts.some((o) => o.textContent!.includes('Banana'))).to.equal(true);
  });

  it('shows a failed state instead of a stuck banner when a source has no provider', async () => {
    const catalog = new InMemoryFoodSourceRepository();
    createApp({
      container,
      repo: new InMemoryRepository(),
      clock: fixedClock(),
      catalog,
      catalogProviders: [fakeProvider()],
      catalogVersions: { usda: 'v1', pantry: 'v1' },
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

  it('switching to Foods view and back clears query and resets picker to default', () => {
    const repo = new InMemoryRepository();
    repo.save(seedTestState());
    createApp({ container, repo, clock: fixedClock() });

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
