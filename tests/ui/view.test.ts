import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';

const today = '2026-05-23';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const noopHandlers = {
  onLog: () => {},
  onDelete: () => {},
  onQueryChange: () => {},
  onFoodSelect: () => {},
  onGramsChange: () => {},
  onDateChange: () => {},
  onPrevDate: () => {},
  onNextDate: () => {},
  onJumpToday: () => {},
  onViewChange: () => {},
  onFoodFormChange: () => {},
  onFoodFormSubmit: () => {},
  onEditFood: () => {},
  onSoftDeleteFood: () => {},
  onCancelEdit: () => {},
  onExport: () => {},
  onImport: () => {},
  onImportTextChange: () => {},
  onFoodsQueryChange: () => {},
};

describe('render', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders search input, grams input, and log button', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    expect(container.querySelector('[data-testid="search-input"]')).to.exist;
    expect(container.querySelector('[data-testid="grams-input"]')).to.exist;
    expect(container.querySelector('[data-testid="log-button"]')).to.exist;
  });

  it('shows seed foods in the food picker on first render', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const items = container.querySelectorAll('[data-testid="food-option"]');
    expect(items.length).to.equal(10);
    const names = Array.from(items).map((i) => i.textContent!.trim());
    expect(names).to.include('Oats');
    expect(names).to.include('Banana');
  });

  it('filters food picker by query (case-insensitive substring)', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: 'ban', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const items = container.querySelectorAll('[data-testid="food-option"]');
    expect(items.length).to.equal(1);
    expect(items[0]!.textContent).to.contain('Banana');
  });

  it('renders empty entry list initially', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(0);
  });

  it('renders entry rows with name, grams, integer-rounded cal', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-banana', grams: 120, loggedAt: `${today}T10:00:00Z` },
        { id: 'e2', date: today, foodId: 'seed-oats',   grams: 50,  loggedAt: `${today}T11:00:00Z` },
      ],
    };
    render(container, { state, today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(2);
    expect(rows[0]!.textContent).to.contain('Banana');
    expect(rows[0]!.textContent).to.contain('120');
    expect(rows[0]!.textContent).to.contain('107');
    expect(rows[1]!.textContent).to.contain('Oats');
    expect(rows[1]!.textContent).to.contain('190');
  });

  it('renders totals row with verbose labels (cal / Protein / Carbs / Fat)', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-banana', grams: 120, loggedAt: `${today}T10:00:00Z` },
      ],
    };
    render(container, { state, today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const totals = container.querySelector('[data-testid="totals-row"]');
    expect(totals).to.exist;
    expect(totals!.textContent).to.contain('107 cal');
    expect(totals!.textContent).to.contain('Protein');
    expect(totals!.textContent).to.contain('Carbs');
    expect(totals!.textContent).to.contain('Fat');
    expect(totals!.textContent).to.not.contain('kcal');
  });

  it('only renders entries for selectedDate (date filter)', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'today',     date: today,        foodId: 'seed-banana', grams: 100, loggedAt: `${today}T10:00:00Z` },
        { id: 'yesterday', date: '2026-05-22', foodId: 'seed-oats',   grams: 50,  loggedAt: '2026-05-22T10:00:00Z' },
      ],
    };
    render(container, { state, today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Banana');
  });

  it('renders error message when error is set', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: 'Pick a food.', view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const err = container.querySelector('[data-testid="error-message"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('Pick a food.');
  });

  it('does not render error element when no error', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const err = container.querySelector('[data-testid="error-message"]');
    expect(err).to.equal(null);
  });

  it('selected food option is marked as selected', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: 'seed-banana', gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const selected = container.querySelector('[data-testid="food-option"][data-selected="true"]');
    expect(selected).to.exist;
    expect(selected!.textContent).to.contain('Banana');
  });

  it('preserves query and gramsRaw in inputs across renders', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: 'oat', selectedFoodId: null, gramsRaw: '42', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const searchInput = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    const gramsInput = container.querySelector('[data-testid="grams-input"]') as HTMLInputElement;
    expect(searchInput.value).to.equal('oat');
    expect(gramsInput.value).to.equal('42');
  });

  it('fires onLog with current form values when log button is clicked', () => {
    let called: { foodId: string; gramsRaw: string } | null = null;
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: 'seed-banana', gramsRaw: '100', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, {
      ...noopHandlers,
      onLog: (foodId, gramsRaw) => { called = { foodId, gramsRaw }; },
    });
    const btn = container.querySelector('[data-testid="log-button"]') as HTMLButtonElement;
    btn.click();
    expect(called).to.deep.equal({ foodId: 'seed-banana', gramsRaw: '100' });
  });

  it('fires onDelete with entry id when delete button is clicked', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-banana', grams: 100, loggedAt: `${today}T10:00:00Z` },
      ],
    };
    let deletedId: string | null = null;
    render(container, { state, today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, {
      ...noopHandlers,
      onDelete: (id) => { deletedId = id; },
    });
    const btn = container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement;
    btn.click();
    expect(deletedId).to.equal('e1');
  });

  it('fires onQueryChange when search input changes', () => {
    let last = '';
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, {
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
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, {
      ...noopHandlers,
      onFoodSelect: (foodId) => { id = foodId; },
    });
    const first = container.querySelector('[data-testid="food-option"]') as HTMLElement;
    first.click();
    expect(id).to.match(/^seed-/);
  });

  it('fires onFoodSelect on Enter or Space key when a food option is focused', () => {
    for (const key of ['Enter', ' ']) {
      let id = '';
      render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, {
        ...noopHandlers,
        onFoodSelect: (foodId) => { id = foodId; },
      });
      const first = container.querySelector('[data-testid="food-option"]') as HTMLElement;
      first.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      expect(id, `key=${JSON.stringify(key)}`).to.match(/^seed-/);
    }
  });

  it('fires onGramsChange when grams input changes', () => {
    let last = '';
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, {
      ...noopHandlers,
      onGramsChange: (g) => { last = g; },
    });
    const input = container.querySelector('[data-testid="grams-input"]') as HTMLInputElement;
    input.value = '50';
    input.dispatchEvent(new Event('input'));
    expect(last).to.equal('50');
  });

  it('preserves focus on the same input across renders', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const grams1 = container.querySelector('[data-testid="grams-input"]') as HTMLInputElement;
    grams1.focus();
    expect(document.activeElement).to.equal(grams1);

    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '1', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const grams2 = container.querySelector('[data-testid="grams-input"]') as HTMLInputElement;
    expect(grams2).to.not.equal(grams1);
    expect(document.activeElement).to.equal(grams2);
  });

  it('preserves caret position on text-like inputs across renders', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: 'oat', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const search1 = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    search1.focus();
    search1.setSelectionRange(2, 2);

    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: 'oats', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const search2 = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    expect(document.activeElement).to.equal(search2);
    expect(search2.selectionStart).to.equal(2);
  });

  it('replaces previous render output (no append)', () => {
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    render(container, { state: freshState(), today, now: new Date(today + 'T12:00:00Z'), selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null, view: 'log' as 'log' | 'foods', foodForm: { mode: 'add' as const, foodId: null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' }, foodFormError: null, importText: '', importError: null, exportText: '', foodsQuery: '' }, noopHandlers);
    const buttons = container.querySelectorAll('[data-testid="log-button"]');
    expect(buttons.length).to.equal(1);
  });

  it('does not import persistence', async () => {
    const src = await fetch(new URL('../../src/ui/view.ts', import.meta.url)).then((r) => r.text());
    expect(src).to.not.match(/from\s+['"][^'"]*persistence/);
    expect(src).to.not.match(/localStorage/);
  });
});
