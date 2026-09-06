import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { baseVm, makeContainer, noopHandlers, seedTestState } from '../_helpers.js';

describe('foods list — sourced foods', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  function rowFor(name: string): Element {
    const rows = Array.from(container.querySelectorAll('[data-testid="food-row"]'));
    return rows.find(
      (r) => r.querySelector('[data-testid="food-row-name"]')?.textContent?.trim() === name,
    )!;
  }

  function button(row: Element, testid: string): HTMLButtonElement {
    return row.querySelector(`[data-testid="${testid}"]`) as HTMLButtonElement;
  }

  it('renders a disabled edit button for sourced foods and keeps delete enabled', () => {
    const s = seedTestState();
    s.foods = s.foods.map((f, i) => i === 0 ? { ...f, source: 'usda' } : f);
    render(container, { ...baseVm, view: 'foods', state: s }, noopHandlers);
    const row = rowFor(s.foods[0]!.name);
    expect(button(row, 'food-edit').disabled).to.equal(true);
    expect(button(row, 'food-edit').getAttribute('aria-label')).to.include('can\'t be edited');
    expect(button(row, 'food-delete').disabled).to.equal(false);
  });

  it('keeps the edit button enabled for user-owned foods', () => {
    const s = seedTestState();
    render(container, { ...baseVm, view: 'foods', state: s }, noopHandlers);
    const row = rowFor(s.foods[0]!.name);
    expect(button(row, 'food-edit').disabled).to.equal(false);
    expect(button(row, 'food-delete').disabled).to.equal(false);
  });

  it('names a brand-tagged food\'s Delete and Edit buttons by its full label, so two same-named packs read apart', () => {
    const s = seedTestState();
    s.foods = [...s.foods, {
      id: 'costco-almonds', name: 'Almonds', source: 'costco',
      nutritionFacts: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      servingSize: 100, servingUnit: 'g', createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    }];
    render(container, { ...baseVm, view: 'foods', state: s }, noopHandlers);
    // The visible row name includes the brand tag, so it can't be matched by
    // exact text like rowFor() does — find the row by its food id instead.
    const row = container.querySelector('[data-testid="food-row"][data-food-id="costco-almonds"]')!;
    expect(button(row, 'food-delete').getAttribute('aria-label')).to.include('Costco');
    expect(button(row, 'food-edit').getAttribute('aria-label')).to.include('Costco');
  });

  it('leaves an untagged food\'s Delete and Edit labels as the plain name', () => {
    const s = seedTestState();
    render(container, { ...baseVm, view: 'foods', state: s }, noopHandlers);
    const row = rowFor(s.foods[0]!.name);
    expect(button(row, 'food-delete').getAttribute('aria-label')).to.equal(`Delete ${s.foods[0]!.name}`);
  });
});
