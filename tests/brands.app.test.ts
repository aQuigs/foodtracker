import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { InMemoryFoodSourceRepository } from '../src/persistence/inMemoryFoodSource.js';
import type { FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import { bundleSources, defaultEnabledSources } from '../src/domain/foodSources.js';
import { fixedClock, makeContainer, until, wiredCatalog } from './_helpers.js';
import { brandRow, fakeBrandsProvider, fakeIndex, type FakeBrand } from './brandsFakes.js';

const USDA: SourcedFood[] = [{
  id: 'usda:apple', name: 'Apple',
  nutritionFacts: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: 'apple',
}];

const USDA_MANIFEST: FoodSourceManifest = {
  source: 'usda', version: 'v1', itemCount: USDA.length, sha256: 'a'.repeat(64), generatedAt: '2026-05-29T00:00:00.000Z',
};

const COSTCO_BRANDS: FakeBrand[] = [
  { id: 'kirkland-signature', label: 'Kirkland Signature', rows: [brandRow('kirkland-signature', 'Kirkland Signature', '1', 'Almonds')] },
  { id: 'kirkland', label: 'Kirkland', rows: [brandRow('kirkland', 'Kirkland', '2', 'Mixed nuts')] },
  { id: 'costco', label: 'Costco', rows: [brandRow('costco', 'Costco', '3', 'Rotisserie chicken')] },
];

const MMS: FakeBrand = { id: 'm-ms', label: "M&M's", rows: [brandRow('m-ms', "M&M's", '4', 'Peanut')] };

async function hydratedCatalog(): Promise<InMemoryFoodSourceRepository> {
  const catalog = new InMemoryFoodSourceRepository();
  await catalog.hydrate('usda', USDA, USDA_MANIFEST);
  return catalog;
}

function switchToCatalog(container: HTMLElement): void {
  (container.querySelector('[data-testid="view-toggle-catalog"]') as HTMLButtonElement).click();
}

function expandPicker(container: HTMLElement): void {
  (container.querySelector('[data-testid="source-picker-toggle"]') as HTMLButtonElement).click();
}

function setSourceFilter(container: HTMLElement, q: string): void {
  const input = container.querySelector('[data-testid="source-filter-input"]') as HTMLInputElement;
  input.value = q;
  input.dispatchEvent(new Event('input'));
}

function sourceCheckbox(container: HTMLElement, source: string): HTMLInputElement | null {
  return container.querySelector(`[data-source="${source}"] [data-testid="source-checkbox"]`);
}

function indexStatus(container: HTMLElement): string | null {
  return container.querySelector('[data-testid="source-index-status"]')?.getAttribute('data-state') ?? null;
}

function brandsReady(container: HTMLElement): boolean {
  return container.querySelector('[data-testid="source-brands-hint"]') !== null;
}

function dispatchCatalogQuery(container: HTMLElement, q: string): void {
  const input = container.querySelector('[data-testid="catalog-search-input"]') as HTMLInputElement;
  input.value = q;
  input.dispatchEvent(new Event('input'));
}

function settle(): Promise<void> {
  return new Promise((r) => setTimeout(r, 20));
}

describe('app — brand catalogs', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  describe('the brands index', () => {
    it('is not fetched until something needs it', async () => {
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS });
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(await hydratedCatalog(), { usda: 'v1' }, [], brands) });
      switchToCatalog(container);

      await settle();
      expect(brands.indexFetches).to.equal(0);
      expect(container.querySelector('[data-testid="source-section"][data-section="brands"]')).to.equal(null);
    });

    it('is fetched when the picker opens, shown loading meanwhile, and a copy kept in the catalog cache', async () => {
      const catalog = await hydratedCatalog();
      let release!: () => void;
      const hold = new Promise<void>((r) => { release = r; });
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS, holdIndexUntil: hold });

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, { usda: 'v1' }, [], brands) });
      switchToCatalog(container);
      expandPicker(container);
      expect(indexStatus(container)).to.equal('loading');

      release();
      await until(() => brandsReady(container), 'brands section ready');
      expect(brands.indexFetches).to.equal(1);
      expect(await catalog.getMeta('brands-index')).to.deep.equal(fakeIndex(COSTCO_BRANDS));
    });

    it('is fetched again on the next boot, so a dataset rebuilt at the same version is never read through the cached copy', async () => {
      const catalog = await hydratedCatalog();
      await catalog.setMeta('brands-index', fakeIndex(COSTCO_BRANDS));
      const rebuilt = COSTCO_BRANDS.map((b) => (b.id === 'kirkland' ? { ...b, label: 'Kirkland Classic' } : b));
      const brands = fakeBrandsProvider({ brands: rebuilt });

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, { usda: 'v1' }, [], brands) });
      switchToCatalog(container);
      expandPicker(container);
      setSourceFilter(container, 'kirkland classic');

      await until(() => sourceCheckbox(container, 'brand:kirkland') !== null, 'the fetched index names the brand');
      expect(brands.indexFetches).to.equal(1);
      expect(await catalog.getMeta('brands-index')).to.deep.equal(fakeIndex(rebuilt));
    });

    it('falls back to the cached copy when the index cannot be fetched, but not to one from another version', async () => {
      const catalog = await hydratedCatalog();
      await catalog.setMeta('brands-index', fakeIndex(COSTCO_BRANDS));
      const offline = fakeBrandsProvider({ brands: COSTCO_BRANDS, fetchIndexThrows: 'offline' });

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, { usda: 'v1' }, [], offline) });
      switchToCatalog(container);
      expandPicker(container);
      await until(() => brandsReady(container), 'brands section ready from the cached copy');
      expect(offline.indexFetches).to.equal(1);

      container.remove();
      container = makeContainer();
      await catalog.setMeta('brands-index', fakeIndex(COSTCO_BRANDS, '0'));
      const stale = fakeBrandsProvider({ brands: COSTCO_BRANDS, fetchIndexThrows: 'offline' });

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, { usda: 'v1' }, [], stale) });
      switchToCatalog(container);
      expandPicker(container);
      await until(() => indexStatus(container) === 'failed', 'a cached copy of another version is not used');
    });

    it('shows a failed load in the Brands section and tries again when the picker is reopened', async () => {
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS, fetchIndexThrows: 'HTTP 500' });
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(await hydratedCatalog(), { usda: 'v1' }, [], brands) });
      switchToCatalog(container);
      expandPicker(container);

      await until(() => indexStatus(container) === 'failed', 'index shows failed');
      expect(container.querySelector('[data-testid="source-index-status"]')!.getAttribute('title')).to.equal('HTTP 500');

      expandPicker(container);
      expandPicker(container);
      await until(() => brands.indexFetches === 2, 'a second attempt is made');
    });
  });

  describe('stores', () => {
    it('ticking a store turns on every brand it bundles and downloads each behind one banner; unticking it turns them all off', async () => {
      const catalog = await hydratedCatalog();
      let release!: () => void;
      const hold = new Promise<void>((r) => { release = r; });
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS, holdDatasetUntil: hold });
      const repo = new InMemoryRepository();

      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, { usda: 'v1' }, [], brands) });
      switchToCatalog(container);
      expandPicker(container);
      sourceCheckbox(container, 'costco')!.click();

      expect(repo.load().enabledSources).to.deep.equal([...defaultEnabledSources(), ...bundleSources('costco')]);
      expect(sourceCheckbox(container, 'costco')!.checked).to.equal(true);

      await until(() => brands.datasetFetches.length === 3, 'every bundled brand is fetched');
      expect([...brands.datasetFetches].sort()).to.deep.equal([...bundleSources('costco')].sort());
      await until(() => container.querySelector('[data-testid="hydration-banner"][data-sources="3"]') !== null, 'the three downloads share one banner');
      expect(container.querySelectorAll('[data-testid="hydration-banner"]')).to.have.lengthOf(1);
      expect(container.querySelector('[data-testid="hydration-banner"]')!.textContent).to.equal('3 sources: downloading… 6 KB');

      release();
      await until(() => container.querySelector('[data-testid="hydration-banner"]') === null, 'banner clears');

      dispatchCatalogQuery(container, 'nuts');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"][data-source="brand:kirkland"]') !== null, 'a bundled brand folds into results');

      sourceCheckbox(container, 'costco')!.click();
      expect(repo.load().enabledSources).to.deep.equal(defaultEnabledSources());
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"]') === null, 'its folds leave the results');
    });

    it('a brand unticked on its own leaves its store partly on, and ticking the store again fills it back in', async () => {
      const catalog = await hydratedCatalog();
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS });
      const repo = new InMemoryRepository();

      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, { usda: 'v1' }, [], brands) });
      switchToCatalog(container);
      expandPicker(container);
      sourceCheckbox(container, 'costco')!.click();
      await until(() => brands.datasetFetches.length === 3, 'every bundled brand is fetched');

      setSourceFilter(container, 'kirkland signature');
      await until(() => sourceCheckbox(container, 'brand:kirkland-signature') !== null, 'brand listed');
      sourceCheckbox(container, 'brand:kirkland-signature')!.click();

      setSourceFilter(container, 'costco');
      const store = sourceCheckbox(container, 'costco')!;
      expect(store.checked).to.equal(false);
      expect(store.indeterminate).to.equal(true);
      expect(repo.load().enabledSources).to.not.include('brand:kirkland-signature');

      store.click();
      expect(repo.load().enabledSources).to.include('brand:kirkland-signature');
      expect(sourceCheckbox(container, 'costco')!.checked).to.equal(true);
      // Already cached at the wired version: no second download.
      await settle();
      expect(brands.datasetFetches).to.have.lengthOf(3);
    });
  });

  describe('boot', () => {
    it('hydrates a brand that is on through the index, naming it by its index label from the moment the index lands', async () => {
      const catalog = await hydratedCatalog();
      let release!: () => void;
      const hold = new Promise<void>((r) => { release = r; });
      const brands = fakeBrandsProvider({ brands: [MMS], holdDatasetUntil: hold });
      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'brand:m-ms'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, { usda: 'v1' }, [], brands) });

      await until(() => container.querySelector('[data-testid="hydration-banner"][data-source="brand:m-ms"]')?.textContent === "M&M's: downloading… 2 KB", 'banner carries the index label');
      expect(brands.indexFetches).to.equal(1);

      release();
      await until(() => container.querySelector('[data-testid="hydration-banner"]') === null, 'banner clears');
      expect(await catalog.currentVersion('brand:m-ms')).to.equal('1');

      switchToCatalog(container);
      dispatchCatalogQuery(container, 'peanut');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"][data-source="brand:m-ms"]') !== null, 'fold appears');
      expect(container.querySelector('[data-testid="catalog-fold-toggle"][data-source="brand:m-ms"]')!.textContent).to.include("M&M's (1)");
    });

    it('fails a brand the index does not list, without touching the others', async () => {
      const catalog = await hydratedCatalog();
      const brands = fakeBrandsProvider({ brands: [MMS] });
      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'brand:m-ms', 'brand:gone'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, { usda: 'v1' }, [], brands) });

      await until(() => container.querySelector('[data-testid="hydration-error"][data-source="brand:gone"]') !== null, 'the missing brand fails');
      expect(container.querySelector('[data-testid="hydration-error"][data-source="brand:gone"]')!.textContent).to.equal("Gone: couldn't load. Reload to retry.");
      await until(async () => (await catalog.currentVersion('brand:m-ms')) === '1', 'the listed brand still hydrates');
    });
  });

  describe('a brand unticked mid-download', () => {
    it('gets no banner back from the download\'s later progress or failure', async () => {
      const catalog = await hydratedCatalog();
      let release!: () => void;
      const hold = new Promise<void>((r) => { release = r; });
      const brands = fakeBrandsProvider({ brands: [MMS], holdDatasetUntil: hold, fetchDatasetThrows: 'network down' });
      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'brand:m-ms'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, { usda: 'v1' }, [], brands) });
      await until(() => container.querySelector('[data-testid="hydration-banner"][data-source="brand:m-ms"]') !== null, 'banner appears');

      switchToCatalog(container);
      expandPicker(container);
      await until(() => sourceCheckbox(container, 'brand:m-ms') !== null, 'the brand that is on is listed');
      sourceCheckbox(container, 'brand:m-ms')!.click();
      expect(container.querySelector('[data-testid="hydration-banner"]')).to.equal(null);

      release();
      await settle();
      expect(container.querySelector('[data-testid="hydration-banner"]')).to.equal(null);
      expect(container.querySelector('[data-testid="hydration-error"]')).to.equal(null);
    });
  });
});
