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

describe('view — catalog search section', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders the catalog search section when view is foods', () => {
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-search"]')).to.exist;
  });

  it('does not render catalog search section in log view', () => {
    render(container, { ...baseVm, view: 'log' }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-search"]')).to.equal(null);
  });

  it('shows the empty-query hint when catalogResults is absent', () => {
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.exist;
  });

  it('shows a distinct "no matches" message (not the idle hint) when catalogResults is an empty array', () => {
    render(container, { ...baseVm, view: 'foods', catalogResults: [] }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-empty"]')).to.exist;
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.equal(null);
  });

  it('does not show catalog results rows when catalogResults is absent', () => {
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(0);
  });

  it('renders a row per catalogResult when results are present', () => {
    const catalogResults = [
      { food: sourcedFood('usda:1', 'Apple, raw', 52), tier: 0, indices: [] as ReadonlyArray<readonly [number, number]> },
      { food: sourcedFood('usda:2', 'Apple juice', 46), tier: 1, indices: [] },
    ];
    render(container, { ...baseVm, view: 'foods', catalogResults }, noopHandlers);
    expect(container.querySelectorAll('[data-testid="catalog-result-row"]').length).to.equal(2);
  });

  it('does not show the hint when results are present', () => {
    const catalogResults = [
      { food: sourcedFood('usda:1', 'Apple, raw', 52), tier: 0, indices: [] as ReadonlyArray<readonly [number, number]> },
    ];
    render(container, { ...baseVm, view: 'foods', catalogResults }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-hint"]')).to.equal(null);
  });

  it('shows food name and calories in each result row', () => {
    const catalogResults = [
      { food: sourcedFood('usda:1', 'Apple, raw', 52), indices: [] as ReadonlyArray<readonly [number, number]> },
    ];
    render(container, { ...baseVm, view: 'foods', catalogResults }, noopHandlers);
    const row = container.querySelector('[data-testid="catalog-result-row"]')!;
    expect(row.textContent).to.include('Apple, raw');
    expect(row.textContent).to.include('52');
  });

  it('each result row has an Add button', () => {
    const catalogResults = [
      { food: sourcedFood('usda:1', 'Apple, raw', 52), indices: [] as ReadonlyArray<readonly [number, number]> },
    ];
    render(container, { ...baseVm, view: 'foods', catalogResults }, noopHandlers);
    expect(container.querySelector('[data-testid="catalog-add-button"]')).to.exist;
  });

  it('fires onImportFood with the sourced food id when Add is clicked', () => {
    let capturedId = '';
    const catalogResults = [
      { food: sourcedFood('usda:1', 'Apple, raw', 52), indices: [] as ReadonlyArray<readonly [number, number]> },
    ];
    render(container, { ...baseVm, view: 'foods', catalogResults }, {
      ...noopHandlers,
      onImportFood: (id) => { capturedId = id; },
    });
    (container.querySelector('[data-testid="catalog-add-button"]') as HTMLButtonElement).click();
    expect(capturedId).to.equal('usda:1');
  });

  it('fires onCatalogQueryChange when the catalog search input changes', () => {
    let captured = '';
    render(container, { ...baseVm, view: 'foods' }, {
      ...noopHandlers,
      onCatalogQueryChange: (q) => { captured = q; },
    });
    const input = container.querySelector('[data-testid="catalog-search-input"]') as HTMLInputElement;
    input.value = 'banana';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.equal('banana');
  });
});
