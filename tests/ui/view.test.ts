import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';
import { baseVm, makeContainer, noopHandlers, TODAY as today, withMealsFromEntries } from '../_helpers.js';

describe('render', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders search input, grams input, and log button', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, noopHandlers);
    expect(container.querySelector('[data-testid="search-input"]')).to.exist;
    expect(container.querySelector('[data-testid="amount-input"]')).to.exist;
    expect(container.querySelector('[data-testid="log-button"]')).to.exist;
  });

  it('shows seed foods in the food picker on first render', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, noopHandlers);
    const items = container.querySelectorAll('[data-testid="food-option"]');
    expect(items.length).to.equal(10);
    expect(items[0]!.textContent).to.contain('Almonds');
  });

  it('filters food picker by query (case-insensitive substring)', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today, query: 'ban' }, noopHandlers);
    const items = container.querySelectorAll('[data-testid="food-option"]');
    expect(items.length).to.equal(1);
    expect(items[0]!.textContent).to.contain('Banana');
  });

  it('renders empty entry list initially', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(0);
  });

  it('renders entry rows with name, grams, integer-rounded cal', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', loggedAt: `${today}T10:00:00Z` },
        { id: 'e2', date: today, foodId: 'seed-oats', amount: 50, unit: 'g',   loggedAt: `${today}T11:00:00Z` },
      ],
    };
    render(container, { ...baseVm, state: withMealsFromEntries(state), today, selectedDate: today }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(2);
    expect(rows[0]!.textContent).to.contain('Banana');
    expect(rows[0]!.textContent).to.contain('120');
    expect(rows[0]!.textContent).to.contain('107');
    expect(rows[1]!.textContent).to.contain('Oats');
    expect(rows[1]!.textContent).to.contain('190');
  });

  describe('totals row', () => {
    const stateWithBanana: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', loggedAt: `${today}T10:00:00Z` },
      ],
    };

    it('renders each nutrient on its own line (one <li> per nutrient)', () => {
      render(container, { ...baseVm, state: withMealsFromEntries(stateWithBanana), today, selectedDate: today }, noopHandlers);
      const totals = container.querySelector('[data-testid="totals-row"]')!;
      expect(totals.tagName).to.equal('UL');
      const items = totals.querySelectorAll('li');
      expect(items.length).to.equal(4);
    });

    it('energy row shows "Calories: N cal" (no kcal, no percentage)', () => {
      render(container, { ...baseVm, state: withMealsFromEntries(stateWithBanana), today, selectedDate: today }, noopHandlers);
      const energy = container.querySelector('[data-testid="totals-calories"]')!.textContent!;
      expect(energy).to.equal('Calories: 107 cal');
    });

    it('macro rows show "<Label>: Ng (P%)" with Atwater-based percentage', () => {
      render(container, { ...baseVm, state: withMealsFromEntries(stateWithBanana), today, selectedDate: today }, noopHandlers);
      expect(container.querySelector('[data-testid="totals-protein"]')!.textContent).to.equal('Protein: 1g (5%)');
      expect(container.querySelector('[data-testid="totals-carbs"]')!.textContent).to.equal('Carbs: 27g (102%)');
      expect(container.querySelector('[data-testid="totals-fat"]')!.textContent).to.equal('Fat: 0g (3%)');
    });

    it('omits percentages when total calories is zero', () => {
      render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, noopHandlers);
      const protein = container.querySelector('[data-testid="totals-protein"]')!.textContent!;
      expect(protein).to.equal('Protein: 0g');
      expect(protein).to.not.contain('%');
    });

    it('does not use kcal', () => {
      render(container, { ...baseVm, state: withMealsFromEntries(stateWithBanana), today, selectedDate: today }, noopHandlers);
      expect(container.querySelector('[data-testid="totals-row"]')!.textContent).to.not.contain('kcal');
    });
  });

  it('only renders entries for today (date filter)', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'today',     date: today,        foodId: 'seed-banana', amount: 100, unit: 'g', loggedAt: `${today}T10:00:00Z` },
        { id: 'yesterday', date: '2026-05-22', foodId: 'seed-oats', amount: 50, unit: 'g',   loggedAt: '2026-05-22T10:00:00Z' },
      ],
    };
    render(container, { ...baseVm, state: withMealsFromEntries(state), today, selectedDate: today }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Banana');
  });

  it('renders error message when error is set', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today, query: '', selectedFoodId: null, amount: '', error: 'Pick a food.' }, noopHandlers);
    const err = container.querySelector('[data-testid="error-message"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('Pick a food.');
  });

  it('does not render error element when no error', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, noopHandlers);
    const err = container.querySelector('[data-testid="error-message"]');
    expect(err).to.equal(null);
  });

  it('selected food option is marked as selected', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today, query: '', selectedFoodId: 'seed-banana' }, noopHandlers);
    const selected = container.querySelector('[data-testid="food-option"][data-selected="true"]');
    expect(selected).to.exist;
    expect(selected!.textContent).to.contain('Banana');
  });

  it('preserves query and amount in inputs across renders', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today, query: 'oat', selectedFoodId: null, amount: '42', error: null }, noopHandlers);
    const searchInput = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    const gramsInput = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    expect(searchInput.value).to.equal('oat');
    expect(gramsInput.value).to.equal('42');
  });

  it('fires onLog with current form values when log button is clicked', () => {
    let called: { foodId: string; amount: string; unit: string } | null = null;
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today, query: '', selectedFoodId: 'seed-banana', amount: '100', logUnit: 'oz', error: null }, {
      ...noopHandlers,
      onLog: (foodId, amount, unit) => { called = { foodId, amount, unit }; },
    });
    const btn = container.querySelector('[data-testid="log-button"]') as HTMLButtonElement;
    btn.click();
    expect(called).to.deep.equal({ foodId: 'seed-banana', amount: '100', unit: 'oz' });
  });

  it('log-unit-group marks the active unit button per vm.logUnit', () => {
    render(container, { ...baseVm, logUnit: 'lb' }, noopHandlers);
    const group = container.querySelector('[data-testid="log-unit-group"]') as HTMLElement;
    const active = group.querySelector('[data-active="true"]') as HTMLButtonElement;
    expect(active.getAttribute('data-unit')).to.equal('lb');
  });

  it('log-unit-group offers only [count] for a count food', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-egg', logUnit: 'count' }, noopHandlers);
    const group = container.querySelector('[data-testid="log-unit-group"]') as HTMLElement;
    const units = Array.from(group.querySelectorAll('[data-unit]'))
      .map((b) => b.getAttribute('data-unit'));
    expect(units).to.deep.equal(['count']);
  });

  it('log-unit-group offers only weight units for a gram-based food', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, noopHandlers);
    const group = container.querySelector('[data-testid="log-unit-group"]') as HTMLElement;
    const units = Array.from(group.querySelectorAll('[data-unit]'))
      .map((b) => b.getAttribute('data-unit'));
    expect(units).to.deep.equal(['g', 'oz', 'lb']);
  });

  it('clicking a unit button fires onLogUnitChange with that unit', () => {
    let received: string | null = null;
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, {
      ...noopHandlers,
      onLogUnitChange: (u) => { received = u; },
    });
    const group = container.querySelector('[data-testid="log-unit-group"]') as HTMLElement;
    const ozBtn = group.querySelector('[data-unit="oz"]') as HTMLButtonElement;
    ozBtn.click();
    expect(received).to.equal('oz');
  });

  it('keeps focus on the same unit button after re-render', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, noopHandlers);
    const ozBtn = container.querySelector('[data-testid="log-unit-group"] [data-unit="oz"]') as HTMLButtonElement;
    ozBtn.focus();
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'oz' }, noopHandlers);
    const newOzBtn = container.querySelector('[data-testid="log-unit-group"] [data-unit="oz"]') as HTMLButtonElement;
    expect(document.activeElement).to.equal(newOzBtn);
  });

  it('renders entry rows showing amount and unit (lb)', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-chicken', amount: 0.25, unit: 'lb', loggedAt: `${today}T10:00:00Z` },
      ],
    };
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, noopHandlers);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.textContent).to.contain('0.25 lb');
  });

  it('renders entry rows showing amount and unit (count)', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-egg', amount: 2, unit: 'count', loggedAt: `${today}T10:00:00Z` },
      ],
    };
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, noopHandlers);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.textContent).to.contain('2 count');
  });

  it('flags rows whose unit no longer matches the food (no silent "0 cal")', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-egg', amount: 50, unit: 'g', loggedAt: `${today}T10:00:00Z` },
      ],
    };
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, noopHandlers);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.textContent).to.contain('unit no longer matches');
    expect(row.textContent).to.not.match(/\b0 cal\b/);
    expect(row.getAttribute('data-invalid')).to.equal('true');
  });

  it('totals row shows an "excluded" warning when one or more entries are excluded', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-egg', amount: 50, unit: 'g', loggedAt: `${today}T10:00:00Z` },
      ],
    };
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, noopHandlers);
    const warn = container.querySelector('[data-testid="totals-excluded"]')!;
    expect(warn).to.exist;
    expect(warn.textContent).to.contain('1 entry excluded');
  });

  it('pluralizes the totals-excluded warning when 2+ entries are excluded', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-egg', amount: 50, unit: 'g', loggedAt: `${today}T10:00:00Z` },
        { id: 'e2', date: today, foodId: 'seed-egg', amount: 25, unit: 'g', loggedAt: `${today}T11:00:00Z` },
      ],
    };
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, noopHandlers);
    const warn = container.querySelector('[data-testid="totals-excluded"]')!;
    expect(warn.textContent).to.contain('2 entries excluded');
    expect(warn.textContent).to.not.contain('entry entries');
  });

  it('no excluded-warning when every entry is valid', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-banana', amount: 100, unit: 'g', loggedAt: `${today}T10:00:00Z` },
      ],
    };
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, noopHandlers);
    expect(container.querySelector('[data-testid="totals-excluded"]')).to.equal(null);
  });

  it('fires onDelete with entry id when delete button is clicked', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-banana', amount: 100, unit: 'g', loggedAt: `${today}T10:00:00Z` },
      ],
    };
    let deletedId: string | null = null;
    render(container, { ...baseVm, state: withMealsFromEntries(state), today, selectedDate: today }, {
      ...noopHandlers,
      onDelete: (id) => { deletedId = id; },
    });
    const btn = container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement;
    btn.click();
    expect(deletedId).to.equal('e1');
  });

  it('fires onQueryChange when search input changes', () => {
    let last = '';
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, {
      ...noopHandlers,
      onQueryChange: (q) => { last = q; },
    });
    const input = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    input.value = 'banana';
    input.dispatchEvent(new Event('input'));
    expect(last).to.equal('banana');
  });

  it('fires onFoodSelect when a food option is clicked', () => {
    let id = '';
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, {
      ...noopHandlers,
      onFoodSelect: (foodId) => { id = foodId; },
    });
    const first = container.querySelector('[data-testid="food-option"]') as HTMLElement;
    first.click();
    expect(id).to.equal('seed-almonds');
  });

  it('fires onFoodSelect on Enter or Space key when a food option is focused', () => {
    for (const key of ['Enter', ' ']) {
      let id = '';
      render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, {
        ...noopHandlers,
        onFoodSelect: (foodId) => { id = foodId; },
      });
      const first = container.querySelector('[data-testid="food-option"]') as HTMLElement;
      first.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      expect(id, `key=${JSON.stringify(key)}`).to.equal('seed-almonds');
    }
  });

  it('fires onAmountChange when grams input changes', () => {
    let last = '';
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, {
      ...noopHandlers,
      onAmountChange: (g) => { last = g; },
    });
    const input = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    input.value = '50';
    input.dispatchEvent(new Event('input'));
    expect(last).to.equal('50');
  });

  it('keeps the same input element across renders so focus survives', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, noopHandlers);
    const grams1 = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    grams1.focus();
    expect(document.activeElement).to.equal(grams1);

    render(container, { ...baseVm, state: freshState(), today, selectedDate: today, query: '', selectedFoodId: null, amount: '1', error: null }, noopHandlers);
    const grams2 = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    expect(grams2).to.equal(grams1);
    expect(document.activeElement).to.equal(grams2);
  });

  it('does not clobber the caret on a focused input when re-rendering with the same value', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today, query: 'oat' }, noopHandlers);
    const search = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    search.focus();
    search.setSelectionRange(2, 2);

    render(container, { ...baseVm, state: freshState(), today, selectedDate: today, query: 'oat' }, noopHandlers);
    expect(document.activeElement).to.equal(search);
    expect(search.selectionStart).to.equal(2);
  });

  it('replaces previous render output (no append)', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, noopHandlers);
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, noopHandlers);
    const buttons = container.querySelectorAll('[data-testid="log-button"]');
    expect(buttons.length).to.equal(1);
  });

  it('does not import persistence', async () => {
    const src = await fetch(new URL('../../src/ui/view.ts', import.meta.url)).then((r) => r.text());
    const importLines = src.split('\n').filter((line) => /^import\b/.test(line));
    for (const line of importLines) {
      expect(line).to.not.match(/from\s+['"][^'"]*persistence/);
      expect(line).to.not.match(/localStorage/);
    }
  });
});
