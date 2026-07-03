import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { SourcedFood } from '../../src/domain/types.js';
import { baseVm, makeContainer, noopHandlers } from '../_helpers.js';

function sourcedFood(id: string, name: string, calories = 100): SourcedFood {
  return {
    id, name, source: 'usda', sourceId: id,
    nutritionFacts: { calories, protein: 5, carbs: 10, fat: 2 },
    servingSize: 100, servingUnit: 'g',
  };
}

describe('view — Catalog tab', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('header nav has a Catalog toggle next to Log and Foods', () => {
    render(container, { ...baseVm, hasCatalog: true }, noopHandlers);
    const nav = container.querySelector('nav.view-toggle')!;
    const toggle = nav.querySelector('[data-testid="view-toggle-catalog"]')!;
    expect(toggle).to.exist;
    expect(toggle.textContent).to.equal('Catalog');
  });

  it('clicking the Catalog toggle fires onViewChange("catalog")', () => {
    let captured = '';
    render(container, { ...baseVm, hasCatalog: true }, {
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
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true }, noopHandlers);
    const toggle = container.querySelector('[data-testid="view-toggle-catalog"]')!;
    expect(toggle.getAttribute('data-active')).to.equal('true');
  });

  it('renders the catalog search section in the catalog view', () => {
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-search"]')).to.exist;
  });

  it('does not render the catalog search section in the foods view', () => {
    render(container, { ...baseVm, view: 'foods', hasCatalog: true }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-search"]')).to.equal(null);
  });

  it('does not render the catalog search section in the log view', () => {
    render(container, { ...baseVm, view: 'log', hasCatalog: true }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-search"]')).to.equal(null);
  });

  it('shows the empty-query hint when catalogResults is absent', () => {
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.exist;
  });

  it('shows a distinct "no matches" message (not the idle hint) when catalogResults is an empty array', () => {
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true, catalogResults: [] }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-empty"]')).to.exist;
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.equal(null);
  });

  it('does not show catalog results rows when catalogResults is absent', () => {
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true }, noopHandlers);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(0);
  });

  it('renders a row per catalogResult when results are present', () => {
    const catalogResults = [
      { food: sourcedFood('usda:1', 'Apple', 52), tier: 0, indices: [] as ReadonlyArray<readonly [number, number]> },
      { food: sourcedFood('usda:2', 'Apple juice', 46), tier: 1, indices: [] },
    ];
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true, catalogResults }, noopHandlers);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(2);
  });

  it('does not show the hint when results are present', () => {
    const catalogResults = [
      { food: sourcedFood('usda:1', 'Apple', 52), tier: 0, indices: [] as ReadonlyArray<readonly [number, number]> },
    ];
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true, catalogResults }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.equal(null);
  });

  it('shows food name and calories with their per-weight basis', () => {
    const catalogResults = [
      { food: sourcedFood('usda:1', 'Apple', 52), indices: [] as ReadonlyArray<readonly [number, number]> },
    ];
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true, catalogResults }, noopHandlers);
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
    const catalogResults = [
      { food: egg, indices: [] as ReadonlyArray<readonly [number, number]> },
    ];
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true, catalogResults }, noopHandlers);
    const row = container.querySelector('[data-testid="catalog-result-row"]')!;
    expect(row.textContent).to.include('72 cal each');
  });

  it('each result row has an Add button', () => {
    const catalogResults = [
      { food: sourcedFood('usda:1', 'Apple', 52), indices: [] as ReadonlyArray<readonly [number, number]> },
    ];
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true, catalogResults }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-add-button"]')).to.exist;
  });

  it('fires onImportFood with the sourced food id when Add is clicked', () => {
    let capturedId = '';
    const catalogResults = [
      { food: sourcedFood('usda:1', 'Apple', 52), indices: [] as ReadonlyArray<readonly [number, number]> },
    ];
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true, catalogResults }, {
      ...noopHandlers,
      onImportFood: (id) => { capturedId = id; },
    });
    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    expect(capturedId).to.equal('usda:1');
  });

  it('fires onCatalogQueryChange when the catalog search input changes', () => {
    let captured = '';
    render(container, { ...baseVm, view: 'catalog', hasCatalog: true }, {
      ...noopHandlers,
      onCatalogQueryChange: (q) => { captured = q; },
    });
    const input = container.querySelector('[data-testid="catalog-search-input"]') as HTMLInputElement;
    input.value = 'banana';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.equal('banana');
  });
});
