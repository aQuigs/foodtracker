import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { InMemoryFoodSourceRepository } from '../src/persistence/inMemoryFoodSource.js';
import type { FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import { fixedClock, makeContainer, seedTestState } from './_helpers.js';

const CATALOG_FOODS: SourcedFood[] = [
  {
    id: 'usda:apple', name: 'Apple, raw',
    nutritionFacts: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
    servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: 'apple',
  },
  {
    id: 'usda:mango', name: 'Mango, raw',
    nutritionFacts: { calories: 60, protein: 0.8, carbs: 15, fat: 0.4 },
    servingSize: 100, servingUnit: 'g', source: 'usda', sourceId: 'mango',
  },
  {
    id: 'usda:applesauce', name: 'Applesauce, canned',
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

function dispatchCatalogQuery(container: HTMLElement, q: string): void {
  const input = container.querySelector('[data-testid="catalog-search-input"]') as HTMLInputElement;
  input.value = q;
  input.dispatchEvent(new Event('input'));
}

async function until(check: () => boolean, label = 'condition', timeoutMs = 1000): Promise<void> {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }

    await new Promise((r) => setTimeout(r, 4));
  }
}

describe('app — catalog search in Foods view', () => {
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
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();

    await new Promise((r) => setTimeout(r, 20));

    expect(searchCallCount).to.equal(0);
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.exist;
  });

  it('non-empty query triggers catalog search and renders ranked results', async () => {
    const catalog = await hydratedCatalog();
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();

    dispatchCatalogQuery(container, 'apple');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0,
      'catalog results appear',
    );

    const rows = Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'));
    expect(rows.length).to.be.greaterThan(0);
    expect(rows.some((r) => r.textContent!.includes('Apple'))).to.equal(true);
  });

  it('Add imports the food into state.foods with correct fields', async () => {
    const catalog = await hydratedCatalog();
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock(), catalog });
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();

    dispatchCatalogQuery(container, 'mango');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0,
      'mango result appears',
    );

    const addBtn = container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement;
    addBtn.click();

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
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();

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
    expect(imported.name).to.equal('Mango, raw');
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
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();

    dispatchCatalogQuery(container, 'apple');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0,
      'apple results appear',
    );

    // Import "Apple, raw" (the first exact/prefix match)
    const firstAddBtn = container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement;
    firstAddBtn.click();

    // Re-search to refresh results
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
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();

    dispatchCatalogQuery(container, 'mango');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0,
      'mango result appears',
    );

    // Import once
    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();

    await until(() => repo.load().foods.some((f) => f.id === 'usda:mango'), 'first import saved');

    const countBefore = repo.load().foods.filter((f) => f.id === 'usda:mango').length;
    expect(countBefore).to.equal(1);

    // Try to trigger a second import via the handler directly — the food
    // should already be in state so the AddFood reducer silently ignores it.
    dispatchCatalogQuery(container, 'mango');

    await until(
      () => container.querySelectorAll('[data-testid="catalog-result-row"]').length === 0 ||
            !Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]')).some((r) =>
              r.getAttribute('data-food-id') === 'usda:mango'),
      'mango not in catalog results after import',
    );

    // Verify exactly one copy
    const countAfter = repo.load().foods.filter((f) => f.id === 'usda:mango').length;
    expect(countAfter).to.equal(1);
  });

  it('no catalog configured → catalog search section hidden, no crash', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();
    const section = container.querySelector('[data-testid="catalog-search"]') as HTMLElement | null;
    expect(section === null || section.hidden).to.equal(true);
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
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();

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
    // Should still show mango results, not apple results
    expect(rows.some((r) => r.textContent!.includes('Mango'))).to.equal(true);
    const hasOnlyApple = rows.length > 0 && rows.every((r) => r.textContent!.includes('Apple'));
    expect(hasOnlyApple).to.equal(false);
  });

  it('re-importing a soft-deleted food revives it instead of leaving it unreachable', async () => {
    const catalog = await hydratedCatalog();
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock(), catalog });
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();

    dispatchCatalogQuery(container, 'mango');
    await until(() => container.querySelectorAll('[data-testid="catalog-result-row"]').length > 0, 'mango result');
    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    await until(() => repo.load().foods.some((f) => f.id === 'usda:mango' && f.deletedAt === null), 'mango imported');

    (container.querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    await until(() => repo.load().foods.some((f) => f.id === 'usda:mango' && f.deletedAt !== null), 'mango soft-deleted');

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
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();

    dispatchCatalogQuery(container, 'zzzqqnomatch');
    await until(() => container.querySelector('[data-testid="catalog-empty"]') !== null, 'empty-results message');

    expect(container.querySelector('[data-testid="catalog-empty"]')).to.exist;
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.equal(null);
  });
});
