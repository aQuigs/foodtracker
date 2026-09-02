import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { FoodMatch } from '../../src/ui/search.js';
import type { SourcedFood } from '../../src/domain/types.js';
import { baseVm, catalogHits, makeContainer, noopHandlers } from '../_helpers.js';

function sourcedFood(id: string, name: string, calories = 100): SourcedFood {
  return {
    id, name, source: 'usda', sourceId: id,
    nutritionFacts: { calories, protein: 5, carbs: 10, fat: 2 },
    servingSize: 100, servingUnit: 'g',
  };
}

function match(food: SourcedFood, tier = 0): FoodMatch<SourcedFood> {
  return { food, tier, indices: [] };
}

describe('view — Catalog tab', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('header nav has a Catalog toggle next to Log and Foods', () => {
    render(container, baseVm, noopHandlers);
    const nav = container.querySelector('nav.view-toggle')!;
    const toggle = nav.querySelector('[data-testid="view-toggle-catalog"]')!;
    expect(toggle).to.exist;
    expect(toggle.textContent).to.equal('Catalog');
  });

  it('clicking the Catalog toggle fires onViewChange("catalog")', () => {
    let captured = '';
    render(container, baseVm, {
      ...noopHandlers,
      onViewChange: (v) => { captured = v; },
    });
    (container.querySelector('[data-testid="view-toggle-catalog"]') as HTMLButtonElement).click();
    expect(captured).to.equal('catalog');
  });

  it('hides the Catalog toggle when no catalog is configured', () => {
    render(container, { ...baseVm, hasCatalog: false }, noopHandlers);
    const toggle = container.querySelector('[data-testid="view-toggle-catalog"]') as HTMLElement;
    expect(toggle.hidden).to.equal(true);
  });

  it('marks the Catalog toggle active when the catalog view is shown', () => {
    render(container, { ...baseVm, view: 'catalog' }, noopHandlers);
    const toggle = container.querySelector('[data-testid="view-toggle-catalog"]')!;
    expect(toggle.getAttribute('data-active')).to.equal('true');
  });

  it('renders the catalog search section in the catalog view', () => {
    render(container, { ...baseVm, view: 'catalog' }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-search"]')).to.exist;
  });

  it('does not render the catalog search section in the foods view', () => {
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-search"]')).to.equal(null);
  });

  it('does not render the catalog search section in the log view', () => {
    render(container, { ...baseVm, view: 'log' }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-search"]')).to.equal(null);
  });

  it('shows the empty-query hint when catalogHits is absent', () => {
    render(container, { ...baseVm, view: 'catalog' }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.exist;
  });

  it('shows a distinct "no matches" message (not the idle hint) when catalogHits has no rows', () => {
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits([]) }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-empty"]')).to.exist;
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.equal(null);
  });

  it('does not show catalog results rows when catalogHits is absent', () => {
    render(container, { ...baseVm, view: 'catalog' }, noopHandlers);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(0);
  });

  it('renders a row per catalogResult when results are present', () => {
    const rows = [
      match(sourcedFood('usda:1', 'Apple', 52)),
      match(sourcedFood('usda:2', 'Apple juice', 46), 1),
    ];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(2);
  });

  it('does not show the hint when results are present', () => {
    const rows = [
      match(sourcedFood('usda:1', 'Apple', 52)),
    ];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.equal(null);
  });

  it('shows food name and calories with their per-weight basis', () => {
    const rows = [
      match(sourcedFood('usda:1', 'Apple', 52)),
    ];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);
    const row = container.querySelector('[data-testid="catalog-result-row"]')!;
    expect(row.textContent).to.include('Apple');
    expect(row.textContent).to.include('52 cal / 100 g');
  });

  it('labels count-based foods per item, not per weight', () => {
    const egg: SourcedFood = {
      id: 'usda:9', name: 'Egg', source: 'usda', sourceId: '9',
      nutritionFacts: { calories: 71.5, protein: 6.3, carbs: 0.4, fat: 4.8 },
      servingSize: 1, servingUnit: 'count',
    };
    const rows = [
      match(egg),
    ];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);
    const row = container.querySelector('[data-testid="catalog-result-row"]')!;
    expect(row.textContent).to.include('72 cal each');
  });

  it('each result row has an Add button', () => {
    const rows = [
      match(sourcedFood('usda:1', 'Apple', 52)),
    ];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-add-button"]')).to.exist;
  });

  it('fires onImportFood with the sourced food id when Add is clicked', () => {
    let capturedId = '';
    const rows = [
      match(sourcedFood('usda:1', 'Apple', 52)),
    ];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, {
      ...noopHandlers,
      onImportFood: (id) => { capturedId = id; },
    });
    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    expect(capturedId).to.equal('usda:1');
  });

  it('fires onCatalogQueryChange when the catalog search input changes', () => {
    let captured = '';
    render(container, { ...baseVm, view: 'catalog' }, {
      ...noopHandlers,
      onCatalogQueryChange: (q) => { captured = q; },
    });
    const input = container.querySelector('[data-testid="catalog-search-input"]') as HTMLInputElement;
    input.value = 'banana';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.equal('banana');
  });
});

describe('view — Catalog tab "More results" tier', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  const tier1 = [
    match(sourcedFood('usda:1', 'Egg', 143)),
  ];
  const tier2 = [
    match(sourcedFood('usda-full:2', 'Hard-boiled egg', 155)),
    match(sourcedFood('usda-full:3', 'Duck egg', 185)),
  ];

  it('shows a collapsed More results toggle with the count', () => {
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(tier1, tier2) }, noopHandlers);
    const toggle = container.querySelector('[data-testid="catalog-more-toggle"]')!;
    expect(toggle).to.exist;
    expect(toggle.textContent).to.include('More results (2)');
    expect(toggle.textContent, 'collapsed disclosure glyph').to.include('▸');
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(1);
  });

  it('renders tier-2 rows when expanded', () => {
    render(container, {
      ...baseVm, view: 'catalog',
      catalogHits: catalogHits(tier1, tier2), catalogMoreExpanded: true,
    }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="catalog-result-row"]');
    expect(rows.length).to.equal(3);

    const toggle = container.querySelector('[data-testid="catalog-more-toggle"]')!;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(toggle.textContent, 'expanded disclosure glyph').to.include('▾');
  });

  it('does not claim "no matches" when the search itself failed', () => {
    render(container, {
      ...baseVm, view: 'catalog',
      catalogHits: catalogHits([], []), catalogError: 'boom',
    }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-error"]')).to.exist;
    const emptyShown = container.querySelector('[data-testid="catalog-empty"]') !== null;
    expect(emptyShown, 'no "no matches" line under a search error').to.equal(false);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(0);
  });

  it('caps the expanded deep tier at 200 rows and says how many are hidden', () => {
    const many = Array.from({ length: 250 }, (_, i) => match(sourcedFood(`usda-full:${i}`, `Egg ${i}`)));
    render(container, {
      ...baseVm, view: 'catalog',
      catalogHits: catalogHits(tier1, many), catalogMoreExpanded: true,
    }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-more-toggle"]')!.textContent).to.include('More results (250)');
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(1 + 200);
    expect(container.querySelector('[data-testid="catalog-more-cap"]')!.textContent).to.include('200 of 250');
  });

  it('hides the disclosure glyph from assistive tech', () => {
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(tier1, tier2) }, noopHandlers);
    const glyph = container.querySelector('[data-testid="catalog-more-toggle"] [aria-hidden="true"]')!;
    expect(glyph.textContent).to.include('▸');
  });

  it('renders the catalog error directly above the results list, not below it', () => {
    render(container, {
      ...baseVm, view: 'catalog',
      catalogHits: catalogHits([match(sourcedFood('usda:1', 'Apple', 52))]), catalogError: 'boom',
    }, noopHandlers);
    const err = container.querySelector('[data-testid="catalog-error"]')!;
    expect(err.textContent).to.equal('boom');
    expect(err.nextElementSibling!.classList.contains('catalog-results')).to.equal(true);
  });

  it('fires onToggleCatalogMore when the toggle is clicked', () => {
    let fired = 0;
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(tier1, tier2) }, {
      ...noopHandlers,
      onToggleCatalogMore: () => { fired++; },
    });
    (container.querySelector('[data-testid="catalog-more-toggle"]') as HTMLButtonElement).click();
    expect(fired).to.equal(1);
  });

  it('shows no toggle when there are no tier-2 matches', () => {
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(tier1, []) }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-more-toggle"]')).to.equal(null);
  });

  it('lists tier-2 rows directly, with no toggle, when nothing curated matched', () => {
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits([], tier2) }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-more-toggle"]')).to.equal(null);
    expect(container.querySelector('[data-testid="catalog-empty"]')).to.equal(null);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(2);
  });

  it('shows the empty message only when both tiers are empty', () => {
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits([], []) }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-empty"]')).to.exist;
  });

  it('tier-2 rows carry an Add button that fires onImportFood', () => {
    let captured = '';
    render(container, {
      ...baseVm, view: 'catalog',
      catalogHits: catalogHits([], tier2), catalogMoreExpanded: true,
    }, {
      ...noopHandlers,
      onImportFood: (id) => { captured = id; },
    });
    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    expect(captured).to.equal('usda-full:2');
  });
});

describe('view — Catalog results list', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('scrolls back to the top when the query changes, but holds position on a same-query refresh', () => {
    const rows = Array.from({ length: 40 }, (_, i) => match(sourcedFood(`f${i}`, `Apple ${i}`)));
    const vm = { ...baseVm, view: 'catalog' as const, catalogQuery: 'a', catalogHits: catalogHits(rows, [], { query: 'a' }) };
    render(container, vm, noopHandlers);

    const list = container.querySelector('.catalog-results') as HTMLElement;
    list.style.maxHeight = '60px';
    list.style.overflowY = 'auto';
    list.scrollTop = 50;
    expect(list.scrollTop).to.be.greaterThan(0);

    render(container, { ...vm, catalogHits: catalogHits(rows.slice(0, 30), [], { query: 'a' }) }, noopHandlers);
    expect(list.scrollTop).to.be.greaterThan(0);

    // The input already says 'ap' but the rows still answer 'a': a paint in
    // between (hydration progress) must not consume the reset.
    render(container, { ...vm, catalogQuery: 'ap' }, noopHandlers);
    expect(list.scrollTop).to.be.greaterThan(0);

    render(container, { ...vm, catalogQuery: 'ap', catalogHits: catalogHits(rows.slice(0, 30), [], { query: 'ap' }) }, noopHandlers);
    expect(list.scrollTop).to.equal(0);
  });

  it('says when every everyday match is already in your foods and keeps the deep tier folded', () => {
    render(container, {
      ...baseVm, view: 'catalog', catalogQuery: 'egg',
      catalogHits: catalogHits([], [match(sourcedFood('usda-full:noodles', 'Egg noodles'))], { alreadyAdded: { curated: 1, deep: 0 } }),
    }, noopHandlers);

    expect(container.querySelector('[data-testid="catalog-all-added"]')!.textContent).to.equal('All everyday matches are already in your foods.');
    expect(container.querySelector('[data-testid="catalog-more-toggle"]')).to.not.equal(null);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]')).to.have.lengthOf(0);
  });

  it('says when every match, deep tier included, is already in your foods', () => {
    render(container, {
      ...baseVm, view: 'catalog', catalogQuery: 'duck',
      catalogHits: catalogHits([], [], { alreadyAdded: { curated: 0, deep: 1 } }),
    }, noopHandlers);

    expect(container.querySelector('[data-testid="catalog-all-added"]')!.textContent).to.equal('All matches are already in your foods.');
    expect(container.querySelector('[data-testid="catalog-empty"]')).to.equal(null);
    expect(container.querySelector('[data-testid="catalog-more-toggle"]')).to.equal(null);
  });
});
