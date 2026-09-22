import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { CatalogHits } from '../../src/ui/catalogResults.js';
import type { FoodMatch } from '../../src/ui/search.js';
import type { SourcedFood } from '../../src/domain/types.js';
import { baseVm, catalogHits, makeContainer, noopHandlers } from '../_helpers.js';

function sourcedFood(id: string, name: string, calories = 100, source = 'usda', brand?: string): SourcedFood {
  return {
    id, name, source, sourceId: id,
    ...(brand === undefined ? {} : { brand }),
    nutritionFacts: { calories, protein: 5, carbs: 10, fat: 2 },
    servingSize: 100, servingUnit: 'g',
  };
}

function match(
  food: SourcedFood,
  tier = 0,
  indices: ReadonlyArray<readonly [number, number]> = [],
  brandIndices: ReadonlyArray<readonly [number, number]> = [],
): FoodMatch<SourcedFood> {
  return { food, tier, indices, brandIndices };
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

  it('mounts the source picker above the search input', () => {
    render(container, { ...baseVm, view: 'catalog' }, noopHandlers);
    const section = container.querySelector('[data-testid="catalog-search"]')!;
    const picker = section.querySelector('[data-testid="source-picker"]');
    const search = section.querySelector('[data-testid="catalog-search-input"]');
    expect(picker).to.exist;
    expect(search).to.exist;

    const children = Array.from(section.children);
    expect(children.indexOf(picker as Element)).to.be.lessThan(children.indexOf(search as Element));
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

  // enabledSources — not state.enabledSources — is what the view trusts: it is
  // already the wired-order intersection app.ts computed, so a stale or
  // differently-shaped state.enabledSources must not affect rendering.
  it('shows the no-sources hint instead of any query state when no wired source is enabled', () => {
    render(container, {
      ...baseVm, view: 'catalog', state: { ...baseVm.state, enabledSources: ['usda'] }, enabledSources: [],
    }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-no-sources"]')).to.exist;
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.equal(null);
  });

  it('shows the no-sources hint even over stale results, when no wired source is enabled', () => {
    render(container, {
      ...baseVm, view: 'catalog', state: { ...baseVm.state, enabledSources: ['usda'] }, enabledSources: [],
      catalogHits: catalogHits([match(sourcedFood('usda:1', 'Apple', 52))]),
    }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-no-sources"]')).to.exist;
    expect(container.querySelector('[data-testid="catalog-result-row"]')).to.equal(null);
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
    expect(row.querySelector('.row-summary')!.textContent).to.equal('52 cal');
    expect(row.querySelector('.row-detail')!.textContent).to.equal('100 g');
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
    expect(row.querySelector('.row-summary')!.textContent).to.equal('72 cal each');
    expect(row.querySelector('.row-detail')!.textContent).to.equal('');
  });

  it('leads with the pieces for a food that has them', () => {
    const drink: SourcedFood = {
      id: 'brand:chobani:1', name: 'Mixed berry vanilla drink', brand: 'Chobani', source: 'brand:chobani', sourceId: '1',
      nutritionFacts: { calories: 169, protein: 8, carbs: 25, fat: 3 },
      servingSize: 296, servingUnit: 'ml', pieces: { perServing: 1, noun: 'bottle' },
    };
    const rows = [match(drink)];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);
    const row = container.querySelector('[data-testid="catalog-result-row"]')!;
    expect(row.querySelector('.row-summary')!.textContent).to.equal('169 cal');
    expect(row.querySelector('.row-detail')!.textContent).to.equal('Chobani 1 bottle · 296 ml');
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

describe('view — Catalog results, one ranked list across sources', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders every enabled source\'s hits as one list, with no section headers', () => {
    const hits: CatalogHits = {
      query: 'egg',
      rows: [
        match(sourcedFood('usda:1', 'Egg', 143)),
        match(sourcedFood('usda-full:2', 'Hard-boiled egg', 155, 'usda-full')),
        match(sourcedFood('brand:costco:1', 'Egg bites', 90, 'brand:costco', 'Costco')),
      ],
      alreadyAdded: 0,
    };
    render(container, { ...baseVm, view: 'catalog', catalogHits: hits }, noopHandlers);

    const resultsList = container.querySelector('.catalog-results')!;
    expect(resultsList.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(3);
    expect(resultsList.children).to.have.lengthOf(3);
  });

  it('caps the merged list at 200 rows, however the hits split across sources, and says how many are hidden', () => {
    const usdaRows = Array.from({ length: 120 }, (_, i) => match(sourcedFood(`usda:${i}`, `Egg ${i}`)));
    const fullRows = Array.from({ length: 120 }, (_, i) => match(sourcedFood(`usda-full:${i}`, `Egg full ${i}`, 100, 'usda-full')));
    const hits: CatalogHits = { query: 'egg', rows: [...usdaRows, ...fullRows], alreadyAdded: 0 };
    render(container, { ...baseVm, view: 'catalog', catalogHits: hits }, noopHandlers);

    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(200);
    expect(container.querySelector('[data-testid="catalog-more-cap"]')!.textContent).to.include('200 of 240');
  });

  it('shows neither empty-result hint under a search error, whether or not a match was hidden as already added', () => {
    render(container, {
      ...baseVm, view: 'catalog',
      catalogHits: catalogHits([]), catalogError: 'boom',
    }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-error"]')).to.exist;
    expect(container.querySelector('[data-testid="catalog-empty"]')).to.equal(null);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(0);

    render(container, {
      ...baseVm, view: 'catalog',
      catalogHits: catalogHits([], { alreadyAdded: 1 }), catalogError: 'boom',
    }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-all-added"]')).to.equal(null);
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
});

describe('view — Catalog brand tags', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('shows the pack label on a brand hit and no tag on a USDA hit', () => {
    const rows = [
      match(sourcedFood('brand:costco:1', 'Almonds', 100, 'brand:costco', 'Costco')),
      match(sourcedFood('usda:1', 'Almonds', 100, 'usda')),
    ];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);

    const resultRows = Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'));
    const costcoRow = resultRows.find((r) => r.getAttribute('data-food-id') === 'brand:costco:1')!;
    const usdaRow = resultRows.find((r) => r.getAttribute('data-food-id') === 'usda:1')!;

    expect(costcoRow.querySelector('[data-testid="source-tag"]')!.textContent).to.equal('Costco');
    expect(usdaRow.querySelector('[data-testid="source-tag"]')).to.equal(null);
  });

  it('names the Add button by the full label, so two same-named packs\' buttons read apart', () => {
    const rows = [
      match(sourcedFood('brand:costco:1', 'Almonds', 100, 'brand:costco', 'Costco')),
      match(sourcedFood('usda:1', 'Almonds', 100, 'usda')),
    ];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);

    const resultRows = Array.from(container.querySelectorAll('[data-testid="catalog-result-row"]'));
    const costcoRow = resultRows.find((r) => r.getAttribute('data-food-id') === 'brand:costco:1')!;
    const usdaRow = resultRows.find((r) => r.getAttribute('data-food-id') === 'usda:1')!;

    expect(costcoRow.querySelector('[data-testid="catalog-add-button"]')!.getAttribute('aria-label')).to.equal('Add Almonds Costco');
    expect(usdaRow.querySelector('[data-testid="catalog-add-button"]')!.getAttribute('aria-label')).to.equal('Add Almonds');
  });

  it('keeps the name and its brand tag apart, on separate lines', () => {
    const rows = [match(sourcedFood('brand:costco:1', 'Almonds', 100, 'brand:costco', 'Costco'))];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);

    const nameSpan = container.querySelector('.row-name')!;
    expect(nameSpan.textContent).to.equal('Almonds');

    // A plain space text node ahead of the serving size, not just the tag's
    // own padding, so the line reads "Costco 100 g" to assistive tech
    // instead of "Costco100 g".
    const detail = container.querySelector('.row-detail')!;
    expect(detail.textContent).to.equal('Costco 100 g');
  });

  it('highlights matched brand characters inside the tag', () => {
    const rows = [match(sourcedFood('brand:costco:1', 'Almonds', 100, 'brand:costco', 'Costco'), 0, [], [[0, 3]])];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);

    const tag = container.querySelector('[data-testid="source-tag"]')!;
    const mark = tag.querySelector('mark');
    expect(mark).to.exist;
    expect(mark!.textContent).to.equal('Cos');
  });

  it('leaves the tag unhighlighted when only the name matched', () => {
    const rows = [match(sourcedFood('brand:costco:1', 'Almonds', 100, 'brand:costco', 'Costco'), 0, [[0, 3]], [])];
    render(container, { ...baseVm, view: 'catalog', catalogHits: catalogHits(rows) }, noopHandlers);

    const tag = container.querySelector('[data-testid="source-tag"]')!;
    expect(tag.querySelector('mark')).to.equal(null);
  });
});

describe('view — Catalog results list', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('scrolls back to the top when the query changes, but holds position on a same-query refresh', () => {
    const rows = Array.from({ length: 40 }, (_, i) => match(sourcedFood(`f${i}`, `Apple ${i}`)));
    const vm = { ...baseVm, view: 'catalog' as const, catalogQuery: 'a', catalogHits: catalogHits(rows, { query: 'a' }) };
    render(container, vm, noopHandlers);

    const list = container.querySelector('.catalog-results') as HTMLElement;
    list.style.maxHeight = '60px';
    list.style.overflowY = 'auto';
    list.scrollTop = 50;
    expect(list.scrollTop).to.be.greaterThan(0);

    render(container, { ...vm, catalogHits: catalogHits(rows.slice(0, 30), { query: 'a' }) }, noopHandlers);
    expect(list.scrollTop).to.be.greaterThan(0);

    // The input already says 'ap' but the rows still answer 'a': a paint in
    // between (hydration progress) must not consume the reset.
    render(container, { ...vm, catalogQuery: 'ap' }, noopHandlers);
    expect(list.scrollTop).to.be.greaterThan(0);

    render(container, { ...vm, catalogQuery: 'ap', catalogHits: catalogHits(rows.slice(0, 30), { query: 'ap' }) }, noopHandlers);
    expect(list.scrollTop).to.equal(0);
  });

  it('keeps the row the user was looking at in view when a same-query refresh reorders rows above it', () => {
    const rows = Array.from({ length: 40 }, (_, i) => match(sourcedFood(`f${i}`, `Apple ${i}`)));
    const vm = { ...baseVm, view: 'catalog' as const, catalogQuery: 'a', catalogHits: catalogHits(rows, { query: 'a' }) };
    render(container, vm, noopHandlers);

    const list = container.querySelector('.catalog-results') as HTMLElement;
    list.style.maxHeight = '150px';
    list.style.overflowY = 'auto';

    const rowEls = () => Array.from(list.querySelectorAll('[data-testid="catalog-result-row"]')) as HTMLElement[];
    list.scrollTop = rowEls()[20]!.offsetTop + 5;

    const anchored = rowEls().find((r) => r.offsetTop + r.offsetHeight > list.scrollTop)!;
    const anchoredId = anchored.getAttribute('data-food-id')!;
    const offsetInView = list.scrollTop - anchored.offsetTop;

    // Five higher-ranked rows land ahead of the original forty, as a source
    // ticked mid-query would produce once the same query resolves again.
    const extra = Array.from({ length: 5 }, (_, i) => match(sourcedFood(`new${i}`, `New ${i}`)));
    render(container, { ...vm, catalogHits: catalogHits([...extra, ...rows], { query: 'a' }) }, noopHandlers);

    const afterRebuild = list.querySelector(`[data-food-id="${anchoredId}"]`) as HTMLElement;
    expect(list.scrollTop - afterRebuild.offsetTop).to.equal(offsetInView);
  });

  it('leaves scrollTop as it is when the anchored row is gone from a same-query refresh', () => {
    const rows = Array.from({ length: 40 }, (_, i) => match(sourcedFood(`f${i}`, `Apple ${i}`)));
    const vm = { ...baseVm, view: 'catalog' as const, catalogQuery: 'a', catalogHits: catalogHits(rows, { query: 'a' }) };
    render(container, vm, noopHandlers);

    const list = container.querySelector('.catalog-results') as HTMLElement;
    list.style.maxHeight = '150px';
    list.style.overflowY = 'auto';

    const rowEls = () => Array.from(list.querySelectorAll('[data-testid="catalog-result-row"]')) as HTMLElement[];
    list.scrollTop = rowEls()[20]!.offsetTop + 5;
    const before = list.scrollTop;

    const anchoredId = rowEls().find((r) => r.offsetTop + r.offsetHeight > list.scrollTop)!.getAttribute('data-food-id')!;

    // The anchored row was just added, so it is gone from the re-search.
    const remaining = rows.filter((r) => r.food.id !== anchoredId);
    render(container, { ...vm, catalogHits: catalogHits(remaining, { query: 'a' }) }, noopHandlers);

    expect(list.scrollTop).to.equal(before);
  });

  it('says all matches are already in your foods, and shows no rows, when every match is hidden as already added', () => {
    render(container, {
      ...baseVm, view: 'catalog', catalogQuery: 'duck',
      catalogHits: catalogHits([], { alreadyAdded: 1 }),
    }, noopHandlers);

    expect(container.querySelector('[data-testid="catalog-all-added"]')!.textContent).to.equal('All matches are already in your foods.');
    expect(container.querySelector('[data-testid="catalog-empty"]')).to.equal(null);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]')).to.have.lengthOf(0);
  });

  it('says no matches for that search when nothing was hidden as already added either', () => {
    render(container, {
      ...baseVm, view: 'catalog', catalogQuery: 'zzz',
      catalogHits: catalogHits([]),
    }, noopHandlers);

    expect(container.querySelector('[data-testid="catalog-empty"]')!.textContent).to.equal('No matches for that search.');
    expect(container.querySelector('[data-testid="catalog-all-added"]')).to.equal(null);
  });
});
