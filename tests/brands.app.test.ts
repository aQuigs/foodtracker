import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { InMemoryFoodSourceRepository } from '../src/persistence/inMemoryFoodSource.js';
import type { SourcedFood } from '../src/domain/types.js';
import { STORE_BUNDLES, brandSource, defaultEnabledSources } from '../src/domain/foodSources.js';
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

const COSTCO_BRANDS: FakeBrand[] = [
  { id: 'kirkland-signature', label: 'Kirkland Signature', rows: [brandRow('kirkland-signature', 'Kirkland Signature', '1', 'Almonds')] },
  { id: 'kirkland', label: 'Kirkland', rows: [brandRow('kirkland', 'Kirkland', '2', 'Mixed nuts')] },
  { id: 'costco', label: 'Costco', rows: [brandRow('costco', 'Costco', '3', 'Rotisserie chicken')] },
];

const COSTCO_SOURCES = STORE_BUNDLES.get('costco')!.brands.map(brandSource);

const MMS: FakeBrand = { id: 'm-ms', label: "M&M's", rows: [brandRow('m-ms', "M&M's", '4', 'Peanut')] };

const CHOBANI: FakeBrand = { id: 'chobani', label: 'Chobani', rows: [brandRow('chobani', 'Chobani', '5', 'Greek yogurt')] };

async function hydratedCatalog(): Promise<InMemoryFoodSourceRepository> {
  const catalog = new InMemoryFoodSourceRepository();
  await catalog.hydrate('usda', USDA, 'v1');
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
      await catalog.setMeta('brand-list', { version: 'v0', list: fakeBrandList([CHOBANI]) });
      const rebuilt = [{ ...CHOBANI, label: 'Chobani Classic' }];
      const brands = fakeBrandsProvider({ brands: rebuilt });

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(catalog, brands) });
      switchView(container, 'catalog');
      expandPicker(container);
      setSourceFilter(container, 'chobani classic');

      await until(() => sourceCheckbox(container, 'brand:chobani') !== null, 'the fetched list names the brand');
      expect(brands.listFetches).to.deep.equal(['v1']);
      expect(await catalog.getMeta('brand-list')).to.deep.equal({ version: 'v1', list: fakeBrandList(rebuilt) });
    });

    it('is read from the copy the catalog cache keeps at the manifest\'s build, without a fetch; never from a copy of another build', async () => {
      const catalog = await hydratedCatalog();
      await catalog.setMeta('brand-list', { version: 'v1', list: fakeBrandList(COSTCO_BRANDS) });
      const offline = fakeBrandsProvider({ brands: COSTCO_BRANDS, fetchListThrows: 'offline' });

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(catalog, offline) });
      switchView(container, 'catalog');
      expandPicker(container);
      await until(() => brandsReady(container), 'brands section ready from the cached copy');
      expect(offline.listFetches).to.deep.equal([]);

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

      await until(() => listStatus(container) === 'failed', 'the second attempt fails too');
      setSourceFilter(container, 'kirk');
      await until(() => brands.listFetches.length === 3, 'a filter typed after a failure tries again');
    });

    it('is fetched once for the session, however often the picker reopens or its filter changes', async () => {
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS });
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(await hydratedCatalog(), brands) });
      switchView(container, 'catalog');
      expandPicker(container);
      await until(() => brandsReady(container), 'brands section ready');

      setSourceFilter(container, 'kirk');
      expandPicker(container);
      expandPicker(container);
      setSourceFilter(container, 'cost');
      await settle();
      expect(brands.listFetches).to.deep.equal(['v1']);
    });
  });

  describe('stores', () => {
    it('ticking a store turns on its own id and downloads each house brand behind one banner; unticking it turns them all off', async () => {
      const catalog = await hydratedCatalog();
      let release!: () => void;
      const hold = new Promise<void>((r) => { release = r; });
      const brands = fakeBrandsProvider({ brands: COSTCO_BRANDS, holdRowsUntil: hold });
      const repo = new InMemoryRepository();

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, brands) });
      switchView(container, 'catalog');
      expandPicker(container);
      sourceCheckbox(container, 'costco')!.click();

      expect(repo.load().enabledSources).to.deep.equal([...defaultEnabledSources(), 'costco']);
      expect(sourceCheckbox(container, 'costco')!.checked).to.equal(true);
      expect(container.querySelector('[data-testid="source-picker-toggle"]')!.textContent).to.include('Sources (2 on)');

      await until(() => brands.rowFetches.length === 3, 'every house brand is fetched');
      expect([...brands.rowFetches].sort()).to.deep.equal([...COSTCO_SOURCES].sort());
      expect(brands.batches.map((b) => [...b].sort())).to.deep.equal([[...COSTCO_SOURCES].sort()]);
      await until(() => container.querySelector('[data-testid="hydration-banner"][data-sources="3"]') !== null, 'the three downloads share one banner');
      expect(container.querySelectorAll('[data-testid="hydration-banner"]')).to.have.lengthOf(1);
      // Kirkland Signature and Kirkland share the k letter file; Costco has c.
      expect(container.querySelector('[data-testid="hydration-banner"]')!.textContent).to.equal('3 sources: downloading… 4 KB');

      release();
      await until(() => container.querySelector('[data-testid="hydration-banner"]') === null, 'banner clears');

      dispatchCatalogQuery(container, 'nuts');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"][data-source="brand:kirkland"]') !== null, 'a house brand folds into results');

      sourceCheckbox(container, 'costco')!.click();
      expect(repo.load().enabledSources).to.deep.equal(defaultEnabledSources());
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"]') === null, 'its folds leave the results');
    });

    it('downloads each later pick in a batch of its own', async () => {
      const brands = fakeBrandsProvider({ brands: [...COSTCO_BRANDS, CHOBANI] });
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(await hydratedCatalog(), brands) });
      switchView(container, 'catalog');
      expandPicker(container);

      sourceCheckbox(container, 'costco')!.click();
      await until(() => brands.rowFetches.length === 3, 'every house brand is fetched');

      setSourceFilter(container, 'chobani');
      await until(() => sourceCheckbox(container, 'brand:chobani') !== null, 'the brand is listed');
      sourceCheckbox(container, 'brand:chobani')!.click();
      await until(() => brands.rowFetches.length === 4, 'the brand is fetched');

      expect(brands.batches.map((b) => [...b].sort())).to.deep.equal([[...COSTCO_SOURCES].sort(), ['brand:chobani']]);
    });

    it('searches a brand reached twice — by its store and by itself — once', async () => {
      const catalog = await hydratedCatalog();
      for (const brand of COSTCO_BRANDS) {
        await catalog.hydrate(brandSource(brand.id), brand.rows, 'v1');
      }

      let searched: string[] | undefined;
      const search = catalog.search.bind(catalog);
      catalog.search = async (q, o) => { searched = o.sources; return search(q, o); };

      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'costco', 'brand:kirkland'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, fakeBrandsProvider({ brands: COSTCO_BRANDS })) });
      switchView(container, 'catalog');
      dispatchCatalogQuery(container, 'nuts');

      const fold = '[data-testid="catalog-fold-toggle"][data-source="brand:kirkland"]';
      await until(() => container.querySelector(fold) !== null, 'the house brand folds into results');
      expect(searched).to.deep.equal(['usda', ...[...COSTCO_SOURCES].sort()]);
      expect(container.querySelectorAll(fold)).to.have.lengthOf(1);
      expect(container.querySelectorAll('[data-testid="catalog-result-row"][data-food-id="brand:kirkland:2"]')).to.have.lengthOf(1);
    });

    it('keeps its house brands out of the Brands search', async () => {
      const brands = fakeBrandsProvider({ brands: [...COSTCO_BRANDS, CHOBANI] });
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: catalogWith(await hydratedCatalog(), brands) });
      switchView(container, 'catalog');
      expandPicker(container);
      await until(() => brandsReady(container), 'brands section ready');

      setSourceFilter(container, 'kirkland');
      expect(container.querySelector('[data-testid="source-option"][data-source^="brand:"]')).to.equal(null);

      setSourceFilter(container, 'chobani');
      expect(sourceCheckbox(container, 'brand:chobani')).to.not.equal(null);
    });
  });

  describe('boot', () => {
    it('hydrates and searches a brand that is on without the brand list: its banner reads its id, its fold its rows\' label', async () => {
      const catalog = await hydratedCatalog();
      let release!: () => void;
      const hold = new Promise<void>((r) => { release = r; });
      const brands = fakeBrandsProvider({ brands: [MMS], holdRowsUntil: hold });
      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'brand:m-ms'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, brands) });

      await until(() => container.querySelector('[data-testid="hydration-banner"][data-source="brand:m-ms"]')?.textContent === 'M Ms: downloading… 2 KB', 'the download starts');
      expect(brands.rowFetches).to.deep.equal(['brand:m-ms']);

      release();
      await until(() => container.querySelector('[data-testid="hydration-banner"]') === null, 'banner clears');
      expect(await catalog.currentVersion('brand:m-ms')).to.equal('v1');

      switchView(container, 'catalog');
      dispatchCatalogQuery(container, 'peanut');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"][data-source="brand:m-ms"]') !== null, 'fold appears');
      expect(container.querySelector('[data-testid="catalog-fold-toggle"][data-source="brand:m-ms"]')!.textContent).to.include("M&M's (1)");
      expect(brands.listFetches).to.deep.equal([]);
    });

    it('downloads every brand that is on in one batch, whether on by itself or through its store', async () => {
      const catalog = await hydratedCatalog();
      const brands = fakeBrandsProvider({ brands: [...COSTCO_BRANDS, CHOBANI] });
      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'costco', 'brand:chobani'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, brands) });
      await until(async () => (await catalog.currentVersion('brand:kirkland-signature')) === 'v1', 'the last brand hydrates');

      expect(brands.batches).to.deep.equal([['brand:chobani', ...[...COSTCO_SOURCES].sort()]]);
    });

    it('hydrates a brand its letter file does not hold as empty at this build: no error, no download next boot, still listed to turn off', async () => {
      const catalog = await hydratedCatalog();
      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'brand:m-ms', 'brand:gone'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, fakeBrandsProvider({ brands: [MMS] })) });
      await until(async () => (await catalog.currentVersion('brand:gone')) === 'v1', 'the missing brand is recorded at this build');
      await until(async () => (await catalog.currentVersion('brand:m-ms')) === 'v1', 'the listed brand hydrates');
      expect(container.querySelector('[data-testid="hydration-error"]')).to.equal(null);

      container.remove();
      container = makeContainer();
      const reboot = fakeBrandsProvider({ brands: [MMS] });
      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, reboot) });
      await settle();
      expect(reboot.rowFetches).to.deep.equal([]);

      switchView(container, 'catalog');
      expandPicker(container);
      await until(() => brandsReady(container), 'brands section ready');
      const gone = sourceCheckbox(container, 'brand:gone')!;
      expect(gone.checked).to.equal(true);
      expect(gone.disabled).to.equal(false);
      expect(container.querySelector('[data-source="brand:gone"] label')!.textContent).to.equal('Gone');

      gone.click();
      expect(repo.load().enabledSources).to.deep.equal(['usda', 'brand:m-ms']);
    });

    it('hydrates a brand this build lists without rows as empty, and keeps it free to turn off with its note', async () => {
      const catalog = await hydratedCatalog();
      const tiny: FakeBrand = { id: 'tiny-co', label: 'Tiny Co', rows: [brandRow('tiny-co', 'Tiny Co', '9', 'Crisps')], listedOnly: true };
      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['usda', 'brand:tiny-co'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: catalogWith(catalog, fakeBrandsProvider({ brands: [tiny] })) });
      await until(async () => (await catalog.currentVersion('brand:tiny-co')) === 'v1', 'the listed-only brand is recorded at this build');
      expect(container.querySelector('[data-testid="hydration-error"]')).to.equal(null);

      switchView(container, 'catalog');
      expandPicker(container);
      await until(() => brandsReady(container), 'brands section ready');
      const checkbox = sourceCheckbox(container, 'brand:tiny-co')!;
      expect(checkbox.checked).to.equal(true);
      expect(checkbox.disabled).to.equal(false);
      expect(container.querySelector('[data-source="brand:tiny-co"] .source-count')!.textContent).to.equal('not included (1 item)');
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
