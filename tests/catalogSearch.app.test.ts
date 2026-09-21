import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { InMemoryFoodSourceRepository } from '../src/persistence/inMemoryFoodSource.js';
import type { FoodSourceRepository } from '../src/persistence/foodSourceRepository.js';
import type { FoodSourceManifest, SourcedFood, State } from '../src/domain/types.js';
import { defaultEnabledSources } from '../src/domain/foodSources.js';
import { exportState } from '../src/ui/importExport.js';
import {
  confirmDelete, dispatchCatalogQuery, expandPicker, fixedClock, makeContainer,
  setSourceFilter, sourceCheckbox, staticProvider, switchView, until, wiredCatalog,
} from './_helpers.js';
import { brandRow, fakeBrandsProvider, type FakeBrand } from './brandsFakes.js';

const CATALOG_FOODS: SourcedFood[] = [
  {
    id: 'usda:apple', name: 'Apple',
    nutritionFacts: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
    servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: 'apple',
  },
  {
    id: 'usda:mango', name: 'Mango',
    nutritionFacts: { calories: 60, protein: 0.8, carbs: 15, fat: 0.4 },
    servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: 'mango',
  },
  {
    id: 'usda:applesauce', name: 'Applesauce',
    nutritionFacts: { calories: 68, protein: 0.2, carbs: 18, fat: 0.1 },
    servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: 'applesauce',
  },
];

const CATALOG_PROVIDERS = [staticProvider('usda', CATALOG_FOODS), staticProvider('usda-full')];

function makeManifest(): FoodSourceManifest {
  return { source: 'usda', version: 'v1', itemCount: CATALOG_FOODS.length };
}

async function hydratedCatalog(): Promise<InMemoryFoodSourceRepository> {
  const catalog = new InMemoryFoodSourceRepository();
  await catalog.hydrate('usda', CATALOG_FOODS, makeManifest());
  return catalog;
}

describe('app — Catalog tab', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('empty query shows the hint and does not call catalog.search', async () => {
    let searchCallCount = 0;
    const catalog = await hydratedCatalog();
    const origSearch = catalog.search.bind(catalog);
    catalog.search = async (...args) => {
      searchCallCount++;
      return origSearch(...args);
    };

    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    await new Promise((r) => setTimeout(r, 20));

    expect(searchCallCount).to.equal(0);
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.exist;
  });

  it('non-empty query triggers catalog search and renders ranked results', async () => {
    const catalog = await hydratedCatalog();
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'apple');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0,
      'catalog results appear',
    );

    const rows = Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'));
    expect(rows.length).to.be.greaterThan(0);
    expect(rows.some((r) => r.textContent!.includes('Apple'))).to.equal(true);
  });

  it('Add imports the food into the Foods list', async () => {
    const catalog = await hydratedCatalog();
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'mango');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0,
      'mango result appears',
    );

    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();

    switchView(container, 'foods');

    await until(
      () => Array.from(container.querySelectorAll('[data-testid="food-row-name"]'))
        .some((el) => el.textContent!.includes('Mango')),
      'Mango appears in foods list',
    );

    const foodRows = Array.from(container.querySelectorAll('[data-testid="food-row-name"]'));
    expect(foodRows.some((r) => r.textContent!.includes('Mango'))).to.equal(true);
  });

  it('imported food has correct nutrition, serving, source, and createdAt', async () => {
    const catalog = await hydratedCatalog();
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'mango');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0,
      'mango result appears',
    );

    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();

    await until(() => {
      const saved = repo.load();
      return saved.foods.some((f) => f.id === 'usda:mango');
    }, 'mango saved to repo');

    const saved = repo.load();
    const imported = saved.foods.find((f) => f.id === 'usda:mango')!;
    expect(imported.name).to.equal('Mango');
    expect(imported.nutritionFacts.calories).to.equal(60);
    expect(imported.nutritionFacts.protein).to.equal(0.8);
    expect(imported.servingSize).to.equal(100);
    expect(imported.servingUnit).to.equal('g');
    expect(imported.source).to.equal('usda');
    expect(imported.deletedAt).to.equal(null);
    expect(imported.createdAt).to.be.a('string');
  });

  it('imported food no longer appears in catalog results', async () => {
    const catalog = await hydratedCatalog();
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'apple');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0,
      'apple results appear',
    );

    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    dispatchCatalogQuery(container, 'apple');

    await until(() => {
      const rows = Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'));
      const saved = repo.load();
      const importedId = saved.foods.find((f) => f.source === 'usda')?.id;
      if (!importedId) {
        return false;
      }

      return !rows.some((r) => r.getAttribute('data-food-id') === importedId);
    }, 'imported food deduped from catalog results');

    const saved = repo.load();
    const importedFood = saved.foods.find((f) => f.source === 'usda')!;
    const rows = Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'));
    expect(rows.some((r) => r.getAttribute('data-food-id') === importedFood.id)).to.equal(false);
  });

  it('re-importing the same food is idempotent — no duplicate in state.foods', async () => {
    const catalog = await hydratedCatalog();
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'mango');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0,
      'mango result appears',
    );

    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();

    await until(() => repo.load().foods.some((f) => f.id === 'usda:mango'), 'first import saved');

    const countBefore = repo.load().foods.filter((f) => f.id === 'usda:mango').length;
    expect(countBefore).to.equal(1);

    // The food is already in state, so it is deduped out of fresh results and
    // the AddFood reducer would silently ignore a second import anyway.
    dispatchCatalogQuery(container, 'mango');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length === 0 ||
            !Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]')).some((r) =>
              r.getAttribute('data-food-id') === 'usda:mango'),
      'mango not in catalog results after import',
    );

    const countAfter = repo.load().foods.filter((f) => f.id === 'usda:mango').length;
    expect(countAfter).to.equal(1);
  });

  it('Add removes the row before the re-search resolves', async () => {
    const catalog = await hydratedCatalog();
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'mango');
    await until(() => container.querySelector('[data-food-id="usda:mango"]') !== null, 'mango row');

    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-food-id="usda:mango"]')).to.equal(null);
  });

  it('hides a catalog food whose name one of your foods already uses and says every match is already yours', async () => {
    const catalog = await hydratedCatalog();
    const repo = new InMemoryRepository();
    repo.save({
      version: 2,
      enabledSources: defaultEnabledSources(),
      foods: [{
        id: 'mine', name: 'apple',
        nutritionFacts: { calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
        servingSize: 1, servingUnit: 'count',
        createdAt: '2026-05-01T00:00:00Z', deletedAt: null,
      }],
      meals: [], entries: [], recipes: [], recipeLogs: [],
    });
    createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'apple');
    await until(() => container.querySelector('[data-food-id="usda:applesauce"]') !== null, 'applesauce row');

    expect(container.querySelector('[data-food-id="usda:apple"]')).to.equal(null);
    expect(repo.load().foods).to.have.lengthOf(1);

    dispatchCatalogQuery(container, 'apple ');
    await until(() => container.querySelector('[data-food-id="usda:applesauce"]') !== null, 'applesauce row again');

    (container.querySelector('[data-food-id="usda:applesauce"] [data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    await until(() => container.querySelector('[data-testid="catalog-all-added"]') !== null, 'all-added hint');
    expect(container.querySelector('[data-testid="catalog-all-added"]')!.textContent).to.equal('All matches are already in your foods.');
  });

  it('a query that is only punctuation shows the idle hint rather than "no matches"', async () => {
    const catalog = await hydratedCatalog();
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, '!!!');
    await until(() => container.querySelector('[data-testid="catalog-hint"]') !== null, 'idle hint');
    expect(container.querySelector('[data-testid="catalog-empty"]')).to.equal(null);
  });

  it('no catalog configured → Catalog toggle hidden, no crash', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    const toggle = container.querySelector('[data-testid="view-toggle-catalog"]') as HTMLElement;
    expect(toggle.hidden).to.equal(true);
  });

  it('stale async response from an earlier query is ignored', async () => {
    const catalog = await hydratedCatalog();

    let resolveFirst!: (v: SourcedFood[]) => void;
    let resolveCount = 0;
    const origSearch = catalog.search.bind(catalog);
    catalog.search = async (query, opts) => {
      if (resolveCount++ === 0) {
        return new Promise<SourcedFood[]>((r) => { resolveFirst = r; });
      }

      return origSearch(query, opts);
    };

    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    // First query ("apple") is held
    dispatchCatalogQuery(container, 'apple');

    // Second query ("mango") resolves immediately
    dispatchCatalogQuery(container, 'mango');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0,
      'mango results appear',
    );

    const mangoBefore = Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'))
      .some((r) => r.textContent!.includes('Mango'));
    expect(mangoBefore).to.equal(true);

    // Now the stale first query resolves — it should be ignored
    const appleResults = await origSearch('apple', { limit: 50 });
    resolveFirst(appleResults);

    await new Promise((r) => setTimeout(r, 20));

    const rows = Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'));
    expect(rows.some((r) => r.textContent!.includes('Mango'))).to.equal(true);
    const hasOnlyApple = rows.length > 0 && rows.every((r) => r.textContent!.includes('Apple'));
    expect(hasOnlyApple).to.equal(false);
  });

  it('re-importing a soft-deleted food revives it instead of leaving it unreachable', async () => {
    const catalog = await hydratedCatalog();
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'mango');
    await until(() => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0, 'mango result');
    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    await until(() => repo.load().foods.some((f) => f.id === 'usda:mango' && f.deletedAt === null), 'mango imported');

    switchView(container, 'foods');
    (container.querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    confirmDelete(container);
    await until(() => repo.load().foods.some((f) => f.id === 'usda:mango' && f.deletedAt !== null), 'mango soft-deleted');

    switchView(container, 'catalog');
    dispatchCatalogQuery(container, 'mango');
    await until(
      () => Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'))
        .some((r) => r.getAttribute('data-food-id') === 'usda:mango'),
      'soft-deleted food reappears in catalog results',
    );

    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    await until(() => {
      const ms = repo.load().foods.filter((f) => f.id === 'usda:mango');
      return ms.length === 1 && ms[0]!.deletedAt === null;
    }, 'mango revived');

    const ms = repo.load().foods.filter((f) => f.id === 'usda:mango');
    expect(ms.length).to.equal(1);
    expect(ms[0]!.deletedAt).to.equal(null);
  });

  it('a search with no matches shows a distinct empty message, not the idle hint', async () => {
    const catalog = await hydratedCatalog();
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'zzzqqnomatch');
    await until(() => container.querySelector('[data-testid="catalog-empty"]') !== null, 'empty-results message');

    expect(container.querySelector('[data-testid="catalog-empty"]')).to.exist;
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.equal(null);
  });

  it('clears the catalog search box when leaving and returning to the Catalog tab', async () => {
    const catalog = await hydratedCatalog();
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'mango');
    await until(() => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0, 'mango results');

    switchView(container, 'log');
    switchView(container, 'catalog');

    const input = container.querySelector('[data-testid="catalog-search-input"]') as HTMLInputElement;
    expect(input.value).to.equal('');
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.exist;
  });

  describe('More results tier (usda-full source)', () => {
    const FULL_FOODS: SourcedFood[] = [
      {
        id: 'usda-full:hb', name: 'Hard-boiled egg',
        nutritionFacts: { calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6 },
        servingSize: 100, servingUnit: 'g', source: 'usda-full', sourceId: 'hb',
      },
      {
        id: 'usda-full:duck', name: 'Duck egg',
        nutritionFacts: { calories: 185, protein: 12.8, carbs: 1.5, fat: 13.8 },
        servingSize: 100, servingUnit: 'g', source: 'usda-full', sourceId: 'duck',
      },
    ];

    async function twoTierCatalog(): Promise<InMemoryFoodSourceRepository> {
      const catalog = new InMemoryFoodSourceRepository();
      await catalog.hydrate('usda', [{
        id: 'usda:egg', name: 'Egg',
        nutritionFacts: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
        servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: 'egg',
      }], makeManifest());
      await catalog.hydrate('usda-full', FULL_FOODS,
        { ...makeManifest(), source: 'usda-full', itemCount: FULL_FOODS.length });
      return catalog;
    }

    it('shows curated hits plus a collapsed fold toggle with the tier-2 count', async () => {
      const catalog = await twoTierCatalog();
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'egg');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"]') !== null, 'fold toggle');

      const rows = Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'));
      expect(rows.some((r) => /egg/i.test(r.textContent!))).to.equal(true);
      expect(rows.some((r) => r.textContent!.includes('Hard-boiled'))).to.equal(false);

      const toggle = container.querySelector('[data-testid="catalog-fold-toggle"]')!;
      expect(toggle.textContent).to.include('All USDA foods (2)');
      expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    });

    it('a query with only tier-2 hits shows its fold already open, and Add imports one into the foods list', async () => {
      const catalog = await twoTierCatalog();
      const repo = new InMemoryRepository();
      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'duck');
      await until(
        () => container.querySelector('[data-testid="catalog-result-row"][data-food-id="usda-full:duck"]') !== null,
        'duck egg row visible without expanding anything',
      );
      const toggle = container.querySelector('[data-testid="catalog-fold-toggle"]');
      expect(toggle).to.exist;
      expect(toggle!.getAttribute('aria-expanded')).to.equal('true');

      (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
      await until(() => repo.load().foods.some((f) => f.id === 'usda-full:duck'), 'duck egg imported');

      const imported = repo.load().foods.find((f) => f.id === 'usda-full:duck')!;
      expect(imported.name).to.equal('Duck egg');
      expect(imported.source).to.equal('usda-full');
    });

    it('adding the only curated hit keeps the deep tier folded and says the everyday matches are already yours', async () => {
      const catalog = await twoTierCatalog();
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'egg');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"]') !== null, 'more toggle');

      (container.querySelector('[data-food-id="usda:egg"] [data-testid="catalog-add-button"]') as HTMLButtonElement).click();
      await until(() => container.querySelector('[data-testid="catalog-all-added"]') !== null, 'all-added hint');

      expect(container.querySelector('[data-testid="catalog-fold-toggle"]')!.textContent).to.include('All USDA foods (2)');
      expect(container.querySelectorAll('[data-testid="catalog-result-row"]')).to.have.lengthOf(0);
    });

    it('adding the only deep-tier hit says every match is already yours instead of "no matches"', async () => {
      const catalog = await twoTierCatalog();
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'duck');
      await until(() => container.querySelector('[data-food-id="usda-full:duck"]') !== null, 'duck row');

      (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
      expect(container.querySelector('[data-testid="catalog-all-added"]')!.textContent).to.equal('All matches are already in your foods.');
      expect(container.querySelector('[data-testid="catalog-empty"]')).to.equal(null);

      await until(() => container.querySelector('[data-testid="catalog-all-added"]') !== null, 'hint survives the re-search');
      expect(container.querySelector('[data-testid="catalog-empty"]')).to.equal(null);
    });

    it('says why Add was refused when two catalog rows share a name and one is already yours', async () => {
      const catalog = new InMemoryFoodSourceRepository();
      await catalog.hydrate('usda', [CATALOG_FOODS[1]!], makeManifest());
      await catalog.hydrate('usda-full', [{
        id: 'usda-full:mango2', name: 'Mango',
        nutritionFacts: { calories: 61, protein: 0.8, carbs: 15, fat: 0.4 },
        servingSize: 100, servingUnit: 'g', source: 'usda-full', sourceId: 'mango2',
      }], { ...makeManifest(), source: 'usda-full', itemCount: 1 });
      const repo = new InMemoryRepository();
      repo.save({
        version: 2, enabledSources: defaultEnabledSources(), meals: [], entries: [], recipes: [], recipeLogs: [],
        foods: [{
          id: 'usda:mango', name: 'Mango', source: 'usda',
          nutritionFacts: { calories: 60, protein: 0.8, carbs: 15, fat: 0.4 },
          servingSize: 100, servingUnit: 'g',
          createdAt: '2026-05-01T00:00:00Z', deletedAt: '2026-05-02T00:00:00Z',
        }],
      });
      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'mango');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"]') !== null, 'fold');
      (container.querySelector('[data-testid="catalog-fold-toggle"]') as HTMLButtonElement).click();
      await until(() => container.querySelector('[data-food-id="usda-full:mango2"]') !== null, 'deep row');

      (container.querySelector('[data-food-id="usda-full:mango2"] [data-testid="catalog-add-button"]') as HTMLButtonElement).click();
      (container.querySelector('[data-food-id="usda:mango"] [data-testid="catalog-add-button"]') as HTMLButtonElement).click();

      expect(container.querySelector('[data-testid="catalog-error"]')!.textContent).to.include('You already have this food.');
      expect(repo.load().foods.find((f) => f.id === 'usda:mango')!.deletedAt).to.not.equal(null);
    });

    it('importing from the expanded tier keeps it expanded', async () => {
      const catalog = await twoTierCatalog();
      const repo = new InMemoryRepository();
      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'egg');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"]') !== null, 'more toggle');
      (container.querySelector('[data-testid="catalog-fold-toggle"]') as HTMLButtonElement).click();

      await until(
        () => container.querySelector('[data-testid="catalog-result-row"][data-food-id="usda-full:hb"]') !== null,
        'hard-boiled egg row visible',
      );

      const row = container.querySelector('[data-testid="catalog-result-row"][data-food-id="usda-full:hb"]')!;
      (row.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
      await until(() => repo.load().foods.some((f) => f.id === 'usda-full:hb'), 'imported');

      await until(
        () => container.querySelector('[data-testid="catalog-fold-toggle"]')?.getAttribute('aria-expanded') === 'true',
        'tier stays expanded after import',
      );
      await until(
        () => container.querySelector('[data-testid="catalog-result-row"][data-food-id="usda-full:duck"]') !== null,
        'remaining tier-2 row still visible',
      );
    });

    it('finishing hydration of the full source surfaces its matches for the active query', async () => {
      const catalog = new InMemoryFoodSourceRepository();
      await catalog.hydrate('usda', [{
        id: 'usda:egg', name: 'Egg',
        nutritionFacts: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
        servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: 'egg',
      }], { ...makeManifest(), version: 'v1' });

      let releaseDataset!: () => void;
      const gate = new Promise<void>((r) => { releaseDataset = r; });
      const provider = {
        name: 'usda-full',
        fetchRows: async () => { await gate; return FULL_FOODS; },
      };

      createApp({
        container, repo: new InMemoryRepository(), clock: fixedClock(),
        catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda'), provider]),
      });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'egg');
      await until(() => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0, 'tier-1 results');
      expect(container.querySelector('[data-testid="catalog-fold-toggle"]')).to.equal(null);

      releaseDataset();

      await until(
        () => container.querySelector('[data-testid="catalog-fold-toggle"]') !== null,
        'deep tier appears once hydrated',
      );
    });

    it('a new query collapses the expanded tier again', async () => {
      const catalog = await twoTierCatalog();
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'egg');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"]') !== null, 'more toggle');
      (container.querySelector('[data-testid="catalog-fold-toggle"]') as HTMLButtonElement).click();
      await until(
        () => container.querySelector('[data-testid="catalog-fold-toggle"]')!.getAttribute('aria-expanded') === 'true',
        'expanded',
      );

      dispatchCatalogQuery(container, 'eg');
      await until(
        () => container.querySelector('[data-testid="catalog-fold-toggle"]')?.getAttribute('aria-expanded') === 'false',
        'collapsed again on new query',
      );
    });

    it('defaults every fold open when the query has no curated rows, and closed when it does', async () => {
      const catalog = await twoTierCatalog();
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'duck');
      await until(() => container.querySelector('[data-testid="catalog-fold-toggle"]') !== null, 'fold appears');
      expect(container.querySelector('[data-testid="catalog-fold-toggle"]')!.getAttribute('aria-expanded')).to.equal('true');

      dispatchCatalogQuery(container, 'egg');
      await until(
        () => container.querySelector('[data-testid="catalog-fold-toggle"]')?.getAttribute('aria-expanded') === 'false',
        'fold defaults closed once curated rows exist',
      );
    });

    it('a same-key query edit does not collapse a fold the default rule opened', async () => {
      const catalog = await twoTierCatalog();
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'duck');
      await until(
        () => container.querySelector('[data-testid="catalog-fold-toggle"]')?.getAttribute('aria-expanded') === 'true',
        'fold opens by default',
      );

      // "duck" and "duck " share a search key, so this is a same-key refresh,
      // not a new query — the default the first search picked must survive it.
      dispatchCatalogQuery(container, 'duck ');
      await until(
        () => container.querySelector('[data-testid="catalog-result-row"][data-food-id="usda-full:duck"]') !== null,
        'duck row still shown after the same-key refresh',
      );
      expect(container.querySelector('[data-testid="catalog-fold-toggle"]')!.getAttribute('aria-expanded')).to.equal('true');
    });
  });

  it('a failing catalog search clears the previous rows and shows the error', async () => {
    const inner = await hydratedCatalog();
    let fail = false;
    const catalog: FoodSourceRepository = {
      currentVersion: (s) => inner.currentVersion(s),
      hydrate: (s, items, m) => inner.hydrate(s, items, m),
      search: (q, o) => (fail ? Promise.reject(new Error('IDB read failed')) : inner.search(q, o)),
      getMeta: (k) => inner.getMeta(k),
      setMeta: (k, v) => inner.setMeta(k, v),
    };
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'apple');
    await until(() => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0, 'apple rows');

    fail = true;
    dispatchCatalogQuery(container, 'mango');
    await until(() => container.querySelector('[data-testid="catalog-error"]') !== null, 'error shown');

    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(0);
    expect(container.querySelector('[data-testid="catalog-error"]')!.textContent).to.include('IDB read failed');
    const emptyShown = container.querySelector('[data-testid="catalog-empty"]') !== null;
    expect(emptyShown, 'a failed search must not claim there were no matches').to.equal(false);
  });

  it('surfaces an error and keeps the food deleted when reviving a serving-axis-changed import that has entries', async () => {
    // Catalog now serves the food with a flipped serving axis (g -> count).
    const catalog = new InMemoryFoodSourceRepository();
    await catalog.hydrate('usda', [{
      id: 'usda:egg', name: 'Egg', source: 'usda', sourceId: 'egg',
      nutritionFacts: { calories: 70, protein: 6, carbs: 0, fat: 5 },
      servingSize: 1, servingUnit: 'count',
    }], makeManifest());

    // Existing state: the import is soft-deleted (still 'g') and has a logged entry.
    const repo = new InMemoryRepository();
    repo.save({
      version: 2,
      enabledSources: defaultEnabledSources(),
      foods: [{
        id: 'usda:egg', name: 'Egg', source: 'usda',
        nutritionFacts: { calories: 70, protein: 6, carbs: 0, fat: 5 },
        servingSize: 50, servingUnit: 'g',
        createdAt: '2026-01-01T00:00:00.000Z', deletedAt: '2026-01-02T00:00:00.000Z',
      }],
      meals: [{ id: 'm1', date: '2026-01-01', position: 0 }],
      entries: [{ id: 'e1', date: '2026-01-01', foodId: 'usda:egg', amount: 100, unit: 'g', mealId: 'm1', loggedAt: '2026-01-01T00:00:00.000Z' }],
      recipes: [], recipeLogs: [],
    });

    createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', CATALOG_PROVIDERS) });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'egg');
    await until(
      () => Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'))
        .some((r) => r.getAttribute('data-food-id') === 'usda:egg'),
      'egg appears as importable',
    );

    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    await until(() => container.querySelector('[data-testid="catalog-error"]') !== null, 'catalog error shown');

    expect(container.querySelector('[data-testid="catalog-error"]')).to.exist;
    expect(repo.load().foods.find((f) => f.id === 'usda:egg')!.deletedAt).to.not.equal(null);

    // Searching again is a new interaction: the import error must not shadow it.
    dispatchCatalogQuery(container, 'zzzqqnomatch');
    await until(() => container.querySelector('[data-testid="catalog-empty"]') !== null, 'empty-results message');

    expect(container.querySelector('[data-testid="catalog-error"]')).to.equal(null);
  });

  describe('Source picker', () => {
    function manifestFor(source: string, itemCount: number): FoodSourceManifest {
      return { source, version: 'v1', itemCount };
    }

    // A brand's row only appears once the brand list has loaded and a filter
    // finds it (or it is already on), so ticking one is: open, type, tick.
    async function tickBrand(c: HTMLElement, source: string, filter: string): Promise<HTMLInputElement> {
      setSourceFilter(c, filter);
      await until(() => sourceCheckbox(c, source) !== null, `${source} listed`);
      const box = sourceCheckbox(c, source)!;
      box.click();
      return box;
    }

    const KIRKLAND = 'brand:kirkland-signature';
    const KIRKLAND_FOODS: SourcedFood[] = [brandRow('kirkland-signature', 'Kirkland Signature', '1', 'Apple sauce cups', 70)];
    const kirkland: FakeBrand = { id: 'kirkland-signature', label: 'Kirkland Signature', rows: KIRKLAND_FOODS };

    it('ticking an off brand hydrates it, and its rows join the current query under its own fold; its rows are fetched once even if ticked twice mid-download', async () => {
      const catalog = await hydratedCatalog();
      let releaseHold!: () => void;
      const hold = new Promise<void>((r) => { releaseHold = r; });
      const brands = fakeBrandsProvider({ brands: [kirkland], holdRowsUntil: hold });

      createApp({
        container, repo: new InMemoryRepository(), clock: fixedClock(),
        catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')], brands),
      });
      switchView(container, 'catalog');
      dispatchCatalogQuery(container, 'apple');
      await until(() => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0, 'usda apple rows');

      expandPicker(container);
      setSourceFilter(container, 'kirkland');
      await until(() => sourceCheckbox(container, KIRKLAND) !== null, 'brand listed');
      const box = sourceCheckbox(container, KIRKLAND)!;
      // Two enable events in a row (a double-fire, or off/on before the first
      // request lands) must still only start one download.
      box.checked = true;
      box.dispatchEvent(new Event('change'));
      box.checked = true;
      box.dispatchEvent(new Event('change'));

      await until(() => container.querySelector(`[data-testid="hydration-banner"][data-source="${KIRKLAND}"]`) !== null, 'brand banner appears');
      await until(() => brands.rowFetches.length > 0, 'rows requested');
      expect(brands.rowFetches).to.deep.equal([KIRKLAND]);

      releaseHold();

      await until(() => container.querySelector(`[data-testid="catalog-fold-toggle"][data-source="${KIRKLAND}"]`) !== null, 'brand fold appears');
      expect(brands.rowFetches).to.deep.equal([KIRKLAND]);
    });

    it('unticking a brand removes its fold from the next search', async () => {
      const catalog = await hydratedCatalog();
      await catalog.hydrate(KIRKLAND, KIRKLAND_FOODS, manifestFor(KIRKLAND, KIRKLAND_FOODS.length));

      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: [...defaultEnabledSources(), KIRKLAND], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')], fakeBrandsProvider({ brands: [kirkland] })) });
      switchView(container, 'catalog');
      dispatchCatalogQuery(container, 'apple');
      await until(() => container.querySelector(`[data-testid="catalog-fold-toggle"][data-source="${KIRKLAND}"]`) !== null, 'brand fold appears');

      expandPicker(container);
      await until(() => sourceCheckbox(container, KIRKLAND) !== null, 'the brand that is on is listed');
      sourceCheckbox(container, KIRKLAND)!.click();

      await until(() => container.querySelector(`[data-testid="catalog-fold-toggle"][data-source="${KIRKLAND}"]`) === null, 'brand fold removed');
    });

    it('unticking a brand clears its hydration banner, including a failed one', async () => {
      const catalog = await hydratedCatalog();
      const brands = fakeBrandsProvider({ brands: [kirkland], fetchRowsThrows: 'network down' });

      createApp({
        container, repo: new InMemoryRepository(), clock: fixedClock(),
        catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')], brands),
      });
      switchView(container, 'catalog');

      expandPicker(container);
      await tickBrand(container, KIRKLAND, 'kirkland');
      await until(() => container.querySelector(`[data-testid="hydration-error"][data-source="${KIRKLAND}"]`) !== null, 'brand error banner appears');

      sourceCheckbox(container, KIRKLAND)!.click();
      const bannerGone = container.querySelector(`[data-testid="hydration-error"][data-source="${KIRKLAND}"]`) === null;
      expect(bannerGone, 'hydration error banner should clear once the brand is off').to.equal(true);
    });

    it('re-ticking a brand while its download is still in flight shows the banner again, with only one fetch', async () => {
      const catalog = await hydratedCatalog();
      let releaseHold!: () => void;
      const hold = new Promise<void>((r) => { releaseHold = r; });
      const brands = fakeBrandsProvider({ brands: [kirkland], holdRowsUntil: hold });

      createApp({
        container, repo: new InMemoryRepository(), clock: fixedClock(),
        catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')], brands),
      });
      switchView(container, 'catalog');

      expandPicker(container);
      await tickBrand(container, KIRKLAND, 'kirkland');
      await until(() => container.querySelector(`[data-testid="hydration-banner"][data-source="${KIRKLAND}"]`) !== null, 'brand banner appears');

      // Untick while the fetch is still in flight — the banner clears, but
      // nothing cancels the download already underway.
      sourceCheckbox(container, KIRKLAND)!.click();
      const bannerGoneAfterUntick = container.querySelector(`[data-testid="hydration-banner"][data-source="${KIRKLAND}"]`) === null;
      expect(bannerGoneAfterUntick, 'banner should clear on untick').to.equal(true);

      sourceCheckbox(container, KIRKLAND)!.click();
      await until(() => container.querySelector(`[data-testid="hydration-banner"][data-source="${KIRKLAND}"]`) !== null, 'banner reappears on re-tick');

      releaseHold();
      await until(() => container.querySelector(`[data-testid="hydration-banner"][data-source="${KIRKLAND}"]`) === null, 'banner clears once the fetch resolves');
      expect(brands.rowFetches).to.deep.equal([KIRKLAND]);
    });

    it('a brand ticked on mid-query gets its fold opened by the same default rule as its siblings', async () => {
      const catalog = await hydratedCatalog();
      await catalog.hydrate(KIRKLAND, KIRKLAND_FOODS, manifestFor(KIRKLAND, KIRKLAND_FOODS.length));

      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')], fakeBrandsProvider({ brands: [kirkland] })) });
      switchView(container, 'catalog');

      // "cups" matches only the brand fixture, not any curated usda food, so
      // once the brand joins the result set its curated tier is still empty.
      dispatchCatalogQuery(container, 'cups');
      await until(() => container.querySelector('[data-testid="catalog-empty"]') !== null, 'no matches while the brand is off');

      expandPicker(container);
      await tickBrand(container, KIRKLAND, 'kirkland');

      await until(() => container.querySelector(`[data-testid="catalog-fold-toggle"][data-source="${KIRKLAND}"]`) !== null, 'brand fold appears');
      expect(container.querySelector(`[data-testid="catalog-fold-toggle"][data-source="${KIRKLAND}"]`)!.getAttribute('aria-expanded')).to.equal('true');
    });

    it('re-ticking a brand already cached at the manifest\'s build fetches nothing and shows no banner', async () => {
      const catalog = await hydratedCatalog();
      await catalog.hydrate(KIRKLAND, KIRKLAND_FOODS, manifestFor(KIRKLAND, KIRKLAND_FOODS.length));

      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: defaultEnabledSources(), foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      const brands = fakeBrandsProvider({ brands: [kirkland] });
      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')], brands) });
      switchView(container, 'catalog');

      expandPicker(container);
      await tickBrand(container, KIRKLAND, 'kirkland');

      await new Promise((r) => setTimeout(r, 20));
      expect(brands.rowFetches).to.deep.equal([]);
      expect(container.querySelector('[data-testid="hydration-banner"]')).to.equal(null);
    });

    it('shows the no-sources hint and never calls the repository when every source is off', async () => {
      const catalog = await hydratedCatalog();
      let searchCalls = 0;
      const origSearch = catalog.search.bind(catalog);
      catalog.search = async (...args) => { searchCalls++; return origSearch(...args); };

      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: [], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')]) });
      switchView(container, 'catalog');
      dispatchCatalogQuery(container, 'apple');

      await new Promise((r) => setTimeout(r, 20));
      expect(searchCalls).to.equal(0);
      expect(container.querySelector('[data-testid="catalog-no-sources"]')).to.exist;
    });

    it('calls search with the static sources in wired order, then the brands that are on in id order', async () => {
      const catalog = await hydratedCatalog();
      await catalog.hydrate('brand:costco', [], manifestFor('brand:costco', 0));
      await catalog.hydrate('brand:heb', [], manifestFor('brand:heb', 0));

      let capturedSources: string[] | undefined;
      const origSearch = catalog.search.bind(catalog);
      catalog.search = async (q, o) => { capturedSources = o.sources; return origSearch(q, o); };

      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: ['brand:heb', 'usda', 'brand:costco'], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      // The state array's order is deliberately scrambled, so this also
      // proves search follows wiring, not that order.
      const brands = fakeBrandsProvider({ brands: [{ id: 'costco', label: 'Costco', rows: [] }, { id: 'heb', label: 'H-E-B', rows: [] }] });
      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')], brands) });
      switchView(container, 'catalog');
      dispatchCatalogQuery(container, 'apple');

      await until(() => capturedSources !== undefined, 'search called');
      expect(capturedSources).to.deep.equal(['usda', 'brand:costco', 'brand:heb']);
    });

    it('importing a state that enables an off brand hydrates it', async () => {
      const catalog = await hydratedCatalog();
      const brands = fakeBrandsProvider({ brands: [kirkland] });

      createApp({
        container, repo: new InMemoryRepository(), clock: fixedClock(),
        catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')], brands),
      });

      const imported: State = { version: 2, enabledSources: ['usda', KIRKLAND], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] };
      switchView(container, 'foods');
      const ta = container.querySelector('[data-testid="import-textarea"]') as HTMLTextAreaElement;
      ta.value = exportState(imported);
      ta.dispatchEvent(new Event('input'));
      (container.querySelector('[data-testid="import-button"]') as HTMLButtonElement).click();

      switchView(container, 'catalog');
      dispatchCatalogQuery(container, 'cups');

      await until(
        () => container.querySelector(`[data-testid="catalog-result-row"][data-food-id="${KIRKLAND}:1"]`) !== null,
        'brand row appears once loaded',
      );
      expect(brands.rowFetches).to.deep.equal([KIRKLAND]);
    });

    it('a brand query finds only the matching brand, and its tag carries through Add and into the Log picker', async () => {
      const catalog = await hydratedCatalog();
      const almonds = [brandRow('kirkland-signature', 'Kirkland Signature', 'almonds', 'Almonds', 579)];
      await catalog.hydrate(KIRKLAND, almonds, manifestFor(KIRKLAND, almonds.length));

      const repo = new InMemoryRepository();
      repo.save({ version: 2, enabledSources: [...defaultEnabledSources(), KIRKLAND], foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] });

      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')], fakeBrandsProvider({ brands: [kirkland] })) });
      switchView(container, 'catalog');
      dispatchCatalogQuery(container, 'kirkland almonds');

      // The query has no curated (usda) hits, so every fold opens by default —
      // no need to click the brand's toggle to see its rows.
      await until(
        () => container.querySelector('[data-testid="catalog-result-row"]') !== null,
        'brand row appears',
      );

      const toggles = Array.from(container.querySelectorAll('[data-testid="catalog-fold-toggle"]'));
      expect(toggles.map((t) => t.getAttribute('data-source'))).to.deep.equal([KIRKLAND]);

      const row = container.querySelector('[data-testid="catalog-result-row"]')!;
      expect(row.querySelector('[data-testid="source-tag"]')!.textContent).to.equal('Kirkland Signature');

      (row.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();

      switchView(container, 'foods');
      await until(
        () => Array.from(container.querySelectorAll('[data-testid="food-row"]')).some((r) => r.textContent!.includes('Almonds')),
        'Almonds appears in the Foods list',
      );
      const foodsRow = Array.from(container.querySelectorAll('[data-testid="food-row"]')).find((r) => r.textContent!.includes('Almonds'))!;
      expect(foodsRow.querySelector('[data-testid="source-tag"]')!.textContent).to.equal('Kirkland Signature');

      switchView(container, 'log');
      const searchInput = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
      searchInput.value = 'kirkland';
      searchInput.dispatchEvent(new Event('input'));

      await until(() => container.querySelector('[data-testid="food-option"]') !== null, 'log picker finds the brand food');
      const option = container.querySelector('[data-testid="food-option"]')!;
      expect(option.textContent).to.include('Almonds');
      expect(option.querySelector('[data-testid="source-tag"]')!.textContent).to.equal('Kirkland Signature');
    });

    it('adding one brand\'s row does not hide a same-named row from a different brand', async () => {
      const catalog = await hydratedCatalog();
      await catalog.hydrate(KIRKLAND, [brandRow('kirkland-signature', 'Kirkland Signature', 'almonds', 'Almonds', 579)], manifestFor(KIRKLAND, 1));
      await catalog.hydrate('brand:great-value', [brandRow('great-value', 'Great Value', 'almonds', 'Almonds', 575)], manifestFor('brand:great-value', 1));

      const repo = new InMemoryRepository();
      repo.save({
        version: 2, enabledSources: [...defaultEnabledSources(), KIRKLAND, 'brand:great-value'],
        foods: [], meals: [], entries: [], recipes: [], recipeLogs: [],
      });

      const brands = fakeBrandsProvider({ brands: [kirkland, { id: 'great-value', label: 'Great Value', rows: [] }] });
      createApp({ container, repo, clock: fixedClock(), catalog: wiredCatalog(catalog, 'v1', [staticProvider('usda')], brands) });
      switchView(container, 'catalog');
      dispatchCatalogQuery(container, 'almonds');

      await until(
        () => container.querySelectorAll('[data-testid="catalog-result-row"]').length >= 2,
        'both brands\' rows appear',
      );

      (container.querySelector(`[data-food-id="${KIRKLAND}:almonds"] [data-testid="catalog-add-button"]`) as HTMLButtonElement).click();

      await until(() => container.querySelector(`[data-food-id="${KIRKLAND}:almonds"]`) === null, 'Kirkland row removed after Add');

      const otherRowGone = container.querySelector('[data-food-id="brand:great-value:almonds"]') === null;
      expect(otherRowGone, 'the Great Value row should still be offered').to.equal(false);
      expect(container.querySelector('[data-testid="catalog-all-added"]')).to.equal(null);
    });
  });
});
