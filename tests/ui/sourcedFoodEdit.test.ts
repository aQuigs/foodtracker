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

  it('omits edit button for sourced foods but keeps delete', () => {
    const s = seedTestState();
    s.foods = s.foods.map((f, i) => i === 0 ? { ...f, source: 'usda' } : f);
    render(container, { ...baseVm, view: 'foods', state: s }, noopHandlers);
    const row = rowFor(s.foods[0]!.name);
    expect(row.querySelector('[data-testid="food-edit"]') === null).to.equal(true);
    expect(row.querySelector('[data-testid="food-delete"]') === null).to.equal(false);
  });

  it('keeps edit button for user-owned foods', () => {
    const s = seedTestState();
    render(container, { ...baseVm, view: 'foods', state: s }, noopHandlers);
    const row = rowFor(s.foods[0]!.name);
    expect(row.querySelector('[data-testid="food-edit"]') === null).to.equal(false);
    expect(row.querySelector('[data-testid="food-delete"]') === null).to.equal(false);
  });
});
