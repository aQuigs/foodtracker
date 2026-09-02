import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { InMemoryFoodSourceRepository } from '../src/persistence/inMemoryFoodSource.js';
import type { FoodSourceRepository } from '../src/persistence/foodSourceRepository.js';
import type { FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import type { ViewName } from '../src/ui/view.js';
import { fixedClock, makeContainer, until } from './_helpers.js';

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

function makeManifest(): FoodSourceManifest {
  return {
    source: 'usda', version: 'v1',
    itemCount: CATALOG_FOODS.length,
    sha256: 'a'.repeat(64),
    generatedAt: '2026-05-29T00:00:00.000Z',
  };
}

async function hydratedCatalog(): Promise<InMemoryFoodSourceRepository> {
  const catalog = new InMemoryFoodSourceRepository();
  await catalog.hydrate('usda', CATALOG_FOODS, makeManifest());
  return catalog;
}

function switchView(container: HTMLElement, view: ViewName): void {
  (container.querySelector(`[data-testid="view-toggle-${view}"]`) as HTMLButtonElement).click();
}

function dispatchCatalogQuery(container: HTMLElement, q: string): void {
  const input = container.querySelector('[data-testid="catalog-search-input"]') as HTMLInputElement;
  input.value = q;
  input.dispatchEvent(new Event('input'));
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

    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
    switchView(container, 'catalog');

    await new Promise((r) => setTimeout(r, 20));

    expect(searchCallCount).to.equal(0);
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.exist;
  });

  it('non-empty query triggers catalog search and renders ranked results', async () => {
    const catalog = await hydratedCatalog();
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
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
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
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
    createApp({ container, repo, clock: fixedClock(), catalog });
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
    createApp({ container, repo, clock: fixedClock(), catalog });
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
    createApp({ container, repo, clock: fixedClock(), catalog });
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
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'mango');
    await until(() => container.querySelector('[data-food-id="usda:mango"]') !== null, 'mango row');

    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-food-id="usda:mango"]')).to.equal(null);
  });

  it('refuses to add a catalog food whose name one of your foods already uses, and says so', async () => {
    const catalog = await hydratedCatalog();
    const repo = new InMemoryRepository();
    repo.save({
      version: 2,
      foods: [{
        id: 'mine', name: 'apple',
        nutritionFacts: { calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
        servingSize: 1, servingUnit: 'count',
        createdAt: '2026-05-01T00:00:00Z', deletedAt: null,
      }],
      meals: [], entries: [],
    });
    createApp({ container, repo, clock: fixedClock(), catalog });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'apple');
    await until(() => container.querySelector('[data-food-id="usda:apple"]') !== null, 'apple row');

    (container.querySelector('[data-food-id="usda:apple"] [data-testid="catalog-add-button"]') as HTMLButtonElement).click();

    const err = container.querySelector('[data-testid="catalog-error"]')!;
    expect(err.textContent).to.include('already have a food called');
    expect(err.textContent).to.include('Apple');
    expect(repo.load().foods).to.have.lengthOf(1);
    expect(container.querySelector('[data-food-id="usda:apple"]')).to.not.equal(null);
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

    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
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
    createApp({ container, repo, clock: fixedClock(), catalog });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'mango');
    await until(() => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0, 'mango result');
    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    await until(() => repo.load().foods.some((f) => f.id === 'usda:mango' && f.deletedAt === null), 'mango imported');

    switchView(container, 'foods');
    (container.querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
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
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
    switchView(container, 'catalog');

    dispatchCatalogQuery(container, 'zzzqqnomatch');
    await until(() => container.querySelector('[data-testid="catalog-empty"]') !== null, 'empty-results message');

    expect(container.querySelector('[data-testid="catalog-empty"]')).to.exist;
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.equal(null);
  });

  it('clears the catalog search box when leaving and returning to the Catalog tab', async () => {
    const catalog = await hydratedCatalog();
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
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

    it('shows curated hits plus a collapsed More results toggle with the tier-2 count', async () => {
      const catalog = await twoTierCatalog();
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'egg');
      await until(() => container.querySelector('[data-testid="catalog-more-toggle"]') !== null, 'more toggle');

      const rows = Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'));
      expect(rows.some((r) => /egg/i.test(r.textContent!))).to.equal(true);
      expect(rows.some((r) => r.textContent!.includes('Hard-boiled'))).to.equal(false);

      const toggle = container.querySelector('[data-testid="catalog-more-toggle"]')!;
      expect(toggle.textContent).to.include('More results (2)');
    });

    it('a query with only tier-2 hits lists them directly, and Add imports one into the foods list', async () => {
      const catalog = await twoTierCatalog();
      const repo = new InMemoryRepository();
      createApp({ container, repo, clock: fixedClock(), catalog });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'duck');
      await until(
        () => container.querySelector('[data-testid="catalog-result-row"][data-food-id="usda-full:duck"]') !== null,
        'duck egg row visible without expanding anything',
      );
      expect(container.querySelector('[data-testid="catalog-more-toggle"]')).to.equal(null);

      (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
      await until(() => repo.load().foods.some((f) => f.id === 'usda-full:duck'), 'duck egg imported');

      const imported = repo.load().foods.find((f) => f.id === 'usda-full:duck')!;
      expect(imported.name).to.equal('Duck egg');
      expect(imported.source).to.equal('usda-full');
    });

    it('adding the only curated hit keeps the deep tier folded and says the everyday matches are already yours', async () => {
      const catalog = await twoTierCatalog();
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'egg');
      await until(() => container.querySelector('[data-testid="catalog-more-toggle"]') !== null, 'more toggle');

      (container.querySelector('[data-food-id="usda:egg"] [data-testid="catalog-add-button"]') as HTMLButtonElement).click();
      await until(() => container.querySelector('[data-testid="catalog-all-added"]') !== null, 'all-added hint');

      expect(container.querySelector('[data-testid="catalog-more-toggle"]')!.textContent).to.include('More results (2)');
      expect(container.querySelectorAll('[data-testid="catalog-result-row"]')).to.have.lengthOf(0);
    });

    it('importing from the expanded tier keeps it expanded', async () => {
      const catalog = await twoTierCatalog();
      const repo = new InMemoryRepository();
      createApp({ container, repo, clock: fixedClock(), catalog });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'egg');
      await until(() => container.querySelector('[data-testid="catalog-more-toggle"]') !== null, 'more toggle');
      (container.querySelector('[data-testid="catalog-more-toggle"]') as HTMLButtonElement).click();

      await until(
        () => container.querySelector('[data-testid="catalog-result-row"][data-food-id="usda-full:hb"]') !== null,
        'hard-boiled egg row visible',
      );

      const row = container.querySelector('[data-testid="catalog-result-row"][data-food-id="usda-full:hb"]')!;
      (row.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
      await until(() => repo.load().foods.some((f) => f.id === 'usda-full:hb'), 'imported');

      await until(
        () => container.querySelector('[data-testid="catalog-more-toggle"]')?.getAttribute('aria-expanded') === 'true',
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
      const fullManifest = { ...makeManifest(), source: 'usda-full', version: '1', itemCount: FULL_FOODS.length };
      const provider = {
        name: 'usda-full',
        fetchManifest: async () => fullManifest,
        fetchDataset: async () => { await gate; return FULL_FOODS; },
      };

      createApp({
        container, repo: new InMemoryRepository(), clock: fixedClock(), catalog,
        catalogProviders: [provider],
        catalogVersions: { usda: 'v1', 'usda-full': '1' },
      });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'egg');
      await until(() => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0, 'tier-1 results');
      expect(container.querySelector('[data-testid="catalog-more-toggle"]')).to.equal(null);

      releaseDataset();

      await until(
        () => container.querySelector('[data-testid="catalog-more-toggle"]') !== null,
        'deep tier appears once hydrated',
      );
    });

    it('a new query collapses the expanded tier again', async () => {
      const catalog = await twoTierCatalog();
      createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
      switchView(container, 'catalog');

      dispatchCatalogQuery(container, 'egg');
      await until(() => container.querySelector('[data-testid="catalog-more-toggle"]') !== null, 'more toggle');
      (container.querySelector('[data-testid="catalog-more-toggle"]') as HTMLButtonElement).click();
      await until(
        () => container.querySelector('[data-testid="catalog-more-toggle"]')!.getAttribute('aria-expanded') === 'true',
        'expanded',
      );

      dispatchCatalogQuery(container, 'eg');
      await until(
        () => container.querySelector('[data-testid="catalog-more-toggle"]')?.getAttribute('aria-expanded') === 'false',
        'collapsed again on new query',
      );
    });
  });

  it('a failing catalog search clears the previous rows and shows the error', async () => {
    const inner = await hydratedCatalog();
    let fail = false;
    const catalog: FoodSourceRepository = {
      currentVersion: (s) => inner.currentVersion(s),
      hydrate: (s, items, m) => inner.hydrate(s, items, m),
      search: (q, o) => (fail ? Promise.reject(new Error('IDB read failed')) : inner.search(q, o)),
    };
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
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
      foods: [{
        id: 'usda:egg', name: 'Egg', source: 'usda',
        nutritionFacts: { calories: 70, protein: 6, carbs: 0, fat: 5 },
        servingSize: 50, servingUnit: 'g',
        createdAt: '2026-01-01T00:00:00.000Z', deletedAt: '2026-01-02T00:00:00.000Z',
      }],
      meals: [{ id: 'm1', date: '2026-01-01', position: 0 }],
      entries: [{ id: 'e1', date: '2026-01-01', foodId: 'usda:egg', amount: 100, unit: 'g', mealId: 'm1', loggedAt: '2026-01-01T00:00:00.000Z' }],
    });

    createApp({ container, repo, clock: fixedClock(), catalog });
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
});
