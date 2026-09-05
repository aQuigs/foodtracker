import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryFoodSourceRepository } from '../src/persistence/inMemoryFoodSource.js';
import type { FoodSourceProvider } from '../src/persistence/foodSourceProvider.js';
import type { FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import { fixedClock, makeContainer, seededRepo, until, wiredCatalog } from './_helpers.js';

const CATALOG_FOODS: SourcedFood[] = [
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
    itemCount: CATALOG_FOODS.length,
    sha256: 'a'.repeat(64),
    generatedAt: '2026-05-29T00:00:00.000Z',
  };
}

function fakeProvider(items = CATALOG_FOODS): FoodSourceProvider {
  return {
    name: 'usda',
    async fetchManifest(version: string): Promise<FoodSourceManifest> {
      return makeManifest(version);
    },
    async fetchDataset() {
      return [...items];
    },
  };
}

describe('log picker — user foods only', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('picker returns only state.foods even when the catalog has matching items', async () => {
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
    input.value = 'apple';
    input.dispatchEvent(new Event('input'));

    // "Apple, raw" is only in the catalog, not in state.foods — it must NOT appear.
    const opts = Array.from(container.querySelectorAll('[data-testid="food-option"]')) as HTMLElement[];
    const catalogHit = opts.some((o) => o.textContent!.includes('Apple, raw'));
    expect(catalogHit, 'catalog food must not appear in the log picker').to.equal(false);
  });

  it('picker does not show catalog foods even when search matches only catalog', async () => {
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
    input.value = 'mango';
    input.dispatchEvent(new Event('input'));

    // "Mango, raw" is only in the catalog, no user food contains "mango".
    const opts = Array.from(container.querySelectorAll('[data-testid="food-option"]')) as HTMLElement[];
    expect(opts.length, 'no picker items for catalog-only query').to.equal(0);
  });

  it('picker lists user foods when no catalog is configured', () => {
    const repo = seededRepo();

    createApp({ container, repo, clock: fixedClock() });

    const opts = container.querySelectorAll('[data-testid="food-option"]');
    expect(opts.length).to.equal(10);
  });

  it('search input has "Search your foods" placeholder', () => {
    const repo = seededRepo();

    createApp({ container, repo, clock: fixedClock() });

    const search = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    expect(search.placeholder).to.equal('Search your foods');
    expect(search.getAttribute('aria-label')).to.equal('Search your foods');
  });
});
