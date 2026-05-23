import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { ViewModel, ViewHandlers, FoodFormState } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { Entry, State, Unit } from '../../src/domain/types.js';

const today = '2026-05-23';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const noopHandlers: ViewHandlers = {
  onLog: () => {},
  onDelete: () => {},
  onQueryChange: () => {},
  onFoodSelect: () => {},
  onAmountChange: () => {},
  onLogUnitChange: () => {},
  onDateChange: () => {},
  onPrevDate: () => {},
  onNextDate: () => {},
  onJumpToday: () => {},
  onViewChange: () => {},
  onFoodFormChange: () => {},
  onFoodFormUnitChange: () => {},
  onFoodFormSubmit: () => {},
  onEditFood: () => {},
  onSoftDeleteFood: () => {},
  onCancelEdit: () => {},
  onExport: () => {},
  onImport: () => {},
  onImportTextChange: () => {},
  onFoodsQueryChange: () => {},
};

const emptyFoodForm: FoodFormState = {
  mode: 'add', foodId: null,
  name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '',
  primaryUnit: 'g', weightPerUnitRaw: '',
};

function vm(overrides: Partial<ViewModel> = {}): ViewModel {
  return {
    state: freshState(),
    today,
    now: new Date(today + 'T12:00:00Z'),
    selectedDate: today,
    query: '',
    selectedFoodId: null,
    amountRaw: '',
    logUnit: 'g',
    error: null,
    view: 'log',
    foodForm: emptyFoodForm,
    foodFormError: null,
    importText: '',
    importError: null,
    exportText: '',
    foodsQuery: '',
    ...overrides,
  };
}

const e = (id: string, foodId: string, amount: number, unit: Unit, grams: number, date = today): Entry => ({
  id, date, foodId, amount, unit, grams, loggedAt: `${date}T10:00:00Z`,
});

describe('render', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders search input, amount input, unit picker, and log button', () => {
    render(container, vm(), noopHandlers);
    expect(container.querySelector('[data-testid="search-input"]')).to.exist;
    expect(container.querySelector('[data-testid="amount-input"]')).to.exist;
    expect(container.querySelector('[data-testid="log-unit"]')).to.exist;
    expect(container.querySelector('[data-testid="log-button"]')).to.exist;
  });

  it('shows seed foods in the food picker on first render', () => {
    render(container, vm(), noopHandlers);
    const items = container.querySelectorAll('[data-testid="food-option"]');
    expect(items.length).to.equal(10);
    const names = Array.from(items).map((i) => i.textContent!.trim());
    expect(names).to.include('Oats');
    expect(names).to.include('Banana');
  });

  it('filters food picker by query (case-insensitive substring)', () => {
    render(container, vm({ query: 'ban' }), noopHandlers);
    const items = container.querySelectorAll('[data-testid="food-option"]');
    expect(items.length).to.equal(1);
    expect(items[0]!.textContent).to.contain('Banana');
  });

  it('renders empty entry list initially', () => {
    render(container, vm(), noopHandlers);
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
  });

  it('renders entry rows with name, amount+unit, integer-rounded cal', () => {
    const state: State = {
      ...freshState(),
      entries: [
        e('e1', 'seed-banana', 120, 'g', 120),
        e('e2', 'seed-oats',    50, 'g',  50),
      ],
    };
    render(container, vm({ state }), noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(2);
    expect(rows[0]!.textContent).to.contain('Banana');
    expect(rows[0]!.textContent).to.contain('120g');
    expect(rows[0]!.textContent).to.contain('107');
    expect(rows[1]!.textContent).to.contain('Oats');
    expect(rows[1]!.textContent).to.contain('50g');
    expect(rows[1]!.textContent).to.contain('190');
  });

  it('renders count entry as "{amount} count"', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-egg', 2, 'count', 100)],
    };
    render(container, vm({ state }), noopHandlers);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.textContent).to.contain('Egg');
    expect(row.textContent).to.contain('2 count');
  });

  it('renders ounce and pound entries with the original unit, not resolved grams', () => {
    const state: State = {
      ...freshState(),
      entries: [
        e('e1', 'seed-chicken', 4,    'oz', 113.398),
        e('e2', 'seed-chicken', 0.25, 'lb', 113.398),
      ],
    };
    render(container, vm({ state }), noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows[0]!.textContent).to.contain('4oz');
    expect(rows[1]!.textContent).to.contain('0.25lb');
  });

  it('renders totals row with verbose labels (cal / Protein / Carbs / Fat)', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-banana', 120, 'g', 120)],
    };
    render(container, vm({ state }), noopHandlers);
    const totals = container.querySelector('[data-testid="totals-row"]')!;
    expect(totals.textContent).to.contain('107 cal');
    expect(totals.textContent).to.contain('Protein');
    expect(totals.textContent).to.contain('Carbs');
    expect(totals.textContent).to.contain('Fat');
    expect(totals.textContent).to.not.contain('kcal');
  });

  it('only renders entries for selectedDate (date filter)', () => {
    const state: State = {
      ...freshState(),
      entries: [
        e('today',     'seed-banana', 100, 'g', 100, today),
        e('yesterday', 'seed-oats',    50, 'g',  50, '2026-05-22'),
      ],
    };
    render(container, vm({ state }), noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Banana');
  });

  it('renders error message when error is set', () => {
    render(container, vm({ error: 'Pick a food.' }), noopHandlers);
    const err = container.querySelector('[data-testid="error-message"]')!;
    expect(err.textContent).to.contain('Pick a food.');
  });

  it('does not render error element when no error', () => {
    render(container, vm(), noopHandlers);
    expect(container.querySelector('[data-testid="error-message"]')).to.equal(null);
  });

  it('selected food option is marked as selected', () => {
    render(container, vm({ selectedFoodId: 'seed-banana' }), noopHandlers);
    const selected = container.querySelector('[data-testid="food-option"][data-selected="true"]')!;
    expect(selected.textContent).to.contain('Banana');
  });

  it('preserves query and amountRaw in inputs across renders', () => {
    render(container, vm({ query: 'oat', amountRaw: '42' }), noopHandlers);
    const searchInput = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    const amountInput = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    expect(searchInput.value).to.equal('oat');
    expect(amountInput.value).to.equal('42');
  });

  it('amount input placeholder/label is unit-neutral (no g hardcoded) for count entries', () => {
    render(container, vm({ selectedFoodId: 'seed-egg', logUnit: 'count' }), noopHandlers);
    const input = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    expect(input.placeholder.toLowerCase()).to.not.contain('g');
    expect((input.getAttribute('aria-label') ?? '').toLowerCase()).to.not.contain('g');
  });

  it('log unit picker reflects logUnit and offers all units', () => {
    render(container, vm({ logUnit: 'lb' }), noopHandlers);
    const select = container.querySelector('[data-testid="log-unit"]') as HTMLSelectElement;
    expect(select.value).to.equal('lb');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).to.deep.equal(['g', 'oz', 'lb', 'count']);
  });

  it('fires onLog with current form values when log button is clicked', () => {
    let called: { foodId: string; amountRaw: string; unit: Unit } | null = null;
    render(container, vm({ selectedFoodId: 'seed-banana', amountRaw: '100', logUnit: 'g' }), {
      ...noopHandlers,
      onLog: (foodId, amountRaw, unit) => { called = { foodId, amountRaw, unit }; },
    });
    (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();
    expect(called).to.deep.equal({ foodId: 'seed-banana', amountRaw: '100', unit: 'g' });
  });

  it('fires onDelete with entry id when delete button is clicked', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-banana', 100, 'g', 100)],
    };
    let deletedId: string | null = null;
    render(container, vm({ state }), {
      ...noopHandlers,
      onDelete: (id) => { deletedId = id; },
    });
    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    expect(deletedId).to.equal('e1');
  });

  it('fires onQueryChange when search input changes', () => {
    let last = '';
    render(container, vm(), {
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
    render(container, vm(), {
      ...noopHandlers,
      onFoodSelect: (foodId) => { id = foodId; },
    });
    (container.querySelector('[data-testid="food-option"]') as HTMLElement).click();
    expect(id).to.match(/^seed-/);
  });

  it('fires onFoodSelect on Enter or Space key when a food option is focused', () => {
    for (const key of ['Enter', ' ']) {
      let id = '';
      render(container, vm(), {
        ...noopHandlers,
        onFoodSelect: (foodId) => { id = foodId; },
      });
      const first = container.querySelector('[data-testid="food-option"]') as HTMLElement;
      first.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      expect(id, `key=${JSON.stringify(key)}`).to.match(/^seed-/);
    }
  });

  it('fires onAmountChange when amount input changes', () => {
    let last = '';
    render(container, vm(), {
      ...noopHandlers,
      onAmountChange: (a) => { last = a; },
    });
    const input = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    input.value = '50';
    input.dispatchEvent(new Event('input'));
    expect(last).to.equal('50');
  });

  it('fires onLogUnitChange when unit dropdown changes', () => {
    let last: Unit | null = null;
    render(container, vm(), {
      ...noopHandlers,
      onLogUnitChange: (u) => { last = u; },
    });
    const select = container.querySelector('[data-testid="log-unit"]') as HTMLSelectElement;
    select.value = 'oz';
    select.dispatchEvent(new Event('change'));
    expect(last).to.equal('oz');
  });

  it('preserves focus on the same input across renders', () => {
    render(container, vm(), noopHandlers);
    const amount1 = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    amount1.focus();
    expect(document.activeElement).to.equal(amount1);

    render(container, vm({ amountRaw: '1' }), noopHandlers);
    const amount2 = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    expect(amount2).to.not.equal(amount1);
    expect(document.activeElement).to.equal(amount2);
  });

  it('preserves caret position on text-like inputs across renders', () => {
    render(container, vm({ query: 'oat' }), noopHandlers);
    const search1 = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    search1.focus();
    search1.setSelectionRange(2, 2);

    render(container, vm({ query: 'oats' }), noopHandlers);
    const search2 = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    expect(document.activeElement).to.equal(search2);
    expect(search2.selectionStart).to.equal(2);
  });

  it('replaces previous render output (no append)', () => {
    render(container, vm(), noopHandlers);
    render(container, vm(), noopHandlers);
    expect(container.querySelectorAll('[data-testid="log-button"]').length).to.equal(1);
  });

  it('does not import persistence', async () => {
    const src = await fetch(new URL('../../src/ui/view.ts', import.meta.url)).then((r) => r.text());
    expect(src).to.not.match(/from\s+['"][^'"]*persistence/);
    expect(src).to.not.match(/localStorage/);
  });
});
