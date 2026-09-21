import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { InMemoryFoodSourceRepository } from '../src/persistence/inMemoryFoodSource.js';
import type { FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import { bundleSources, defaultEnabledSources } from '../src/domain/foodSources.js';
import type { BrandsProvider } from '../src/persistence/foodSourceProvider.js';
import {
  dispatchCatalogQuery, expandPicker, fixedClock, makeContainer,
  setSourceFilter, sourceCheckbox, staticProvider, switchView, until, wiredCatalog,
} from './_helpers.js';
import { brandRow, fakeBrandList, fakeBrandsProvider, type FakeBrand } from './brandsFakes.js';

const USDA: SourcedFood[] = [{
  id: 'usda:apple', name: 'Apple',
  nutritionFacts: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: 'apple',
}];

const USDA_MANIFEST: FoodSourceManifest = { source: 'usda', version: 'v1', itemCount: USDA.length };

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

function listStatus(container: HTMLElement): string | null {
  return container.querySelector('[data-testid="source-index-status"]')?.getAttribute('data-state') ?? null;
}

function brandsReady(container: HTMLElement): boolean {
  return container.querySelector('[data-testid="source-brands-hint"]') !== null;
}

function settle(): Promise<void> {
  return new Promise((r) => setTimeout(r, 20));
}

function catalogWith(catalog: InMemoryFoodSourceRepository, brands: BrandsProvider) {
  return wiredCatalog(catalog, 'v1', [staticProvider('usda', USDA)], brands);
}

describe('app — brand catalogs', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  describe('the brand list', () => {
    it('is not fetched until something needs it', async () => {
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS });
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(await hydratedCatalog(), brands) });
      switchView(container, 'catalog');

      await settle();
      expect(brands.listFetches).to.deep.equal([]);
      expect(container.querySelector('[data-testid="source-section"][data-section="brands"]')).to.equal(null);
    });

    it('is fetched for the manifest\'s build when the picker opens, shown loading meanwhile, and a copy kept in the catalog cache', async () => {
      const catalog = await hydratedCatalog();
      let release!: () => void;
      const hold = new Promise<void>((r) => { release = r; });
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS, holdListUntil: hold });

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(catalog, brands) });
      switchView(container, 'catalog');
      expandPicker(container);
      expect(listStatus(container)).to.equal('loading');

      release();
      await until(() => brandsReady(container), 'brands section ready');
      expect(brands.listFetches).to.deep.equal(['v1']);
      expect(await catalog.getMeta('brand-list')).to.deep.equal({ version: 'v1', list: fakeBrandList(COSTCO_BRANDS) });
    });

    it('is fetched anew for a new build, never read from the copy an older build left', async () => {
      const catalog = await hydratedCatalog();
      await catalog.setMeta('brand-list', { version: 'v0', list: fakeBrandList(COSTCO_BRANDS) });
      const rebuilt = COSTCO_BRANDS.map((b) => (b.id === 'kirkland' ? { ...b, label: 'Kirkland Classic' } : b));
      const brands = fakeBrandsProvider({ brands: rebuilt });

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(catalog, brands) });
      switchView(container, 'catalog');
      expandPicker(container);
      setSourceFilter(container, 'kirkland classic');

      await until(() => sourceCheckbox(container, 'brand:kirkland') !== null, 'the fetched list names the brand');
      expect(brands.listFetches).to.deep.equal(['v1']);
      expect(await catalog.getMeta('brand-list')).to.deep.equal({ version: 'v1', list: fakeBrandList(rebuilt) });
    });

    it('falls back to the cached copy when the list cannot be fetched, but not to one from another build', async () => {
      const catalog = await hydratedCatalog();
      await catalog.setMeta('brand-list', { version: 'v1', list: fakeBrandList(COSTCO_BRANDS) });
      const offline = fakeBrandsProvider({ brands: COSTCO_BRANDS, fetchListThrows: 'offline' });

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(catalog, offline) });
      switchView(container, 'catalog');
      expandPicker(container);
      await until(() => brandsReady(container), 'brands section ready from the cached copy');
      expect(offline.listFetches).to.deep.equal(['v1']);

      container.remove();
      container = makeContainer();
      await catalog.setMeta('brand-list', { version: 'v0', list: fakeBrandList(COSTCO_BRANDS) });
      const stale = fakeBrandsProvider({ brands: COSTCO_BRANDS, fetchListThrows: 'offline' });

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(catalog, stale) });
      switchView(container, 'catalog');
      expandPicker(container);
      await until(() => listStatus(container) === 'failed', 'a cached copy of another build is not used');
    });

    it('shows a failed load in the Brands section and tries again when the picker is reopened', async () => {
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS, fetchListThrows: 'HTTP 500' });
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(await hydratedCatalog(), brands) });
      switchView(container, 'catalog');
      expandPicker(container);

      await until(() => listStatus(container) === 'failed', 'list shows failed');
      expect(container.querySelector('[data-testid="source-index-status"]')!.getAttribute('title')).to.equal('HTTP 500');

      expandPicker(container);
      expandPicker(container);
      await until(() => brands.listFetches.length === 2, 'a second attempt is made');
    });
  });

  describe('stores', () => {
    it('ticking a store turns on every brand it bundles and downloads each behind one banner; unticking it turns them all off', async () => {
      const catalog = await hydratedCatalog();
      let release!: () => void;
      const hold = new Promise<void>((r) => { release = r; });
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS, holdRowsUntil: hold });
      const repo = new InMemoryRepository();

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, brands) });
      switchView(container, 'catalog');
      expandPicker(container);
      sourceCheckbox(container, 'costco')!.click();

      expect(repo.load().enabledSources).to.deep.equal([...defaultEnabledSources(), ...bundleSources('costco')]);
      expect(sourceCheckbox(container, 'costco')!.checked).to.equal(true);

      await until(() => brands.rowFetches.length === 3, 'every bundled brand is fetched');
      expect([...brands.rowFetches].sort()).to.deep.equal([...bundleSources('costco')].sort());
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

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, brands) });
      switchView(container, 'catalog');
      expandPicker(container);
      sourceCheckbox(container, 'costco')!.click();
      await until(() => brands.rowFetches.length === 3, 'every bundled brand is fetched');

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
      // Already cached at the manifest's build: no second download.
      await settle();
      expect(brands.rowFetches).to.have.lengthOf(3);
    });
  });

  describe('boot', () => {
    it('hydrates a brand that is on without waiting for the brand list, naming it by the list once that lands', async () => {
      const catalog = await hydratedCatalog();
      let releaseList!: () => void;
      const listHold = new Promise<void>((r) => { releaseList = r; });
      let release!: () => void;
      const hold = new Promise<void>((r) => { release = r; });
      const brands = fakeBrandsProvider({ brands: [MMS], holdListUntil: listHold, holdRowsUntil: hold });
      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'brand:m-ms'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, brands) });

      await until(() => container.querySelector('[data-testid="hydration-banner"][data-source="brand:m-ms"]')?.textContent === 'M Ms: downloading… 2 KB', 'the download starts while the list is still on its way');
      expect(brands.rowFetches).to.deep.equal(['brand:m-ms']);

      releaseList();
      await until(() => container.querySelector('[data-testid="hydration-banner"][data-source="brand:m-ms"]')?.textContent === "M&M's: downloading… 2 KB", 'banner carries the list label');
      expect(brands.listFetches).to.deep.equal(['v1']);

      release();
      await until(() => container.querySelector('[data-testid="hydration-banner"]') === null, 'banner clears');
      expect(await catalog.currentVersion('brand:m-ms')).to.equal('v1');

      switchView(container, 'catalog');
      dispatchCatalogQuery(container, 'peanut');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"][data-source="brand:m-ms"]') !== null, 'fold appears');
      expect(container.querySelector('[data-testid="catalog-fold-toggle"][data-source="brand:m-ms"]')!.textContent).to.include("M&M's (1)");
    });

    it('fails a brand its letter file does not hold, without touching the others', async () => {
      const catalog = await hydratedCatalog();
      const brands = fakeBrandsProvider({ brands: [MMS] });
      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'brand:m-ms', 'brand:gone'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, brands) });

      await until(() => container.querySelector('[data-testid="hydration-error"][data-source="brand:gone"]') !== null, 'the missing brand fails');
      expect(container.querySelector('[data-testid="hydration-error"][data-source="brand:gone"]')!.textContent).to.equal("Gone: couldn't load. Reload to retry.");
      await until(async () => (await catalog.currentVersion('brand:m-ms')) === 'v1', 'the listed brand still hydrates');
    });
  });

  describe('a brand unticked mid-download', () => {
    it('gets no banner back from the download\'s later progress or failure', async () => {
      const catalog = await hydratedCatalog();
      let release!: () => void;
      const hold = new Promise<void>((r) => { release = r; });
      const brands = fakeBrandsProvider({ brands: [MMS], holdRowsUntil: hold, fetchRowsThrows: 'network down' });
      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'brand:m-ms'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, brands) });
      await until(() => container.querySelector('[data-testid="hydration-banner"][data-source="brand:m-ms"]') !== null, 'banner appears');

      switchView(container, 'catalog');
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
