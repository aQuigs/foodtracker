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
});
