import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { ViewModel, ViewHandlers, FoodFormState } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { Entry, Meal, State, Unit } from '../../src/domain/types.js';

const today = '2026-05-23';

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
  onFoodFormSubmit: () => {},
  onEditFood: () => {},
  onSoftDeleteFood: () => {},
  onCancelEdit: () => {},
  onExport: () => {},
  onImport: () => {},
  onImportTextChange: () => {},
  onFoodsQueryChange: () => {},
  onFoodFormChipsReset: () => {},
  onFoodFormChipChange: () => {},
  onToggleEntry: () => {},
  onEditEntry: () => {},
  onStartNextMeal: () => {},
};

const emptyFoodForm: FoodFormState = {
  mode: 'add', foodId: null,
  name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '',
  primaryUnit: 'g', weightPerUnitRaw: '',
  chipsRaw: ['', '', '', ''],
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
    expandedEntryId: null,
    currentMealId: null,
    ...overrides,
  };
}

const todayMeal: Meal = { id: 'meal-today', date: today, name: 'Meal 1', createdAt: `${today}T09:00:00Z` };
const yesterdayMeal: Meal = { id: 'meal-yesterday', date: '2026-05-22', name: 'Meal 1', createdAt: '2026-05-22T09:00:00Z' };

const e = (id: string, foodId: string, grams: number, date = today, mealId = 'meal-today'): Entry => ({
  id, date, foodId, amount: grams, unit: 'g' as Unit, grams, loggedAt: `${date}T10:00:00Z`, mealId,
});

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('date navigation in view', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders prev/next buttons and a date input', () => {
    render(container, vm(), noopHandlers);
    expect(container.querySelector('[data-testid="prev-date"]')).to.exist;
    expect(container.querySelector('[data-testid="next-date"]')).to.exist;
    expect(container.querySelector('[data-testid="date-input"]')).to.exist;
  });

  it('date input value reflects selectedDate', () => {
    render(container, vm({ selectedDate: '2026-05-20' }), noopHandlers);
    const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    expect(input.value).to.equal('2026-05-20');
  });

  it('hides "Today" shortcut when selectedDate equals today', () => {
    render(container, vm(), noopHandlers);
    expect(container.querySelector('[data-testid="jump-today"]')).to.equal(null);
  });

  it('shows "Today" shortcut when selectedDate ≠ today', () => {
    render(container, vm({ selectedDate: '2026-05-20' }), noopHandlers);
    expect(container.querySelector('[data-testid="jump-today"]')).to.exist;
  });

  it('entry list filters by selectedDate, not today', () => {
    const state: State = {
      ...freshState(),
      meals: [todayMeal, yesterdayMeal],
      entries: [
        e('today',     'seed-banana', 100, today, 'meal-today'),
        e('yesterday', 'seed-oats',    50, '2026-05-22', 'meal-yesterday'),
      ],
    };
    render(container, vm({ state, selectedDate: '2026-05-22', currentMealId: 'meal-yesterday' }), noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Oats');
  });

  it('totals reflect selectedDate, not today', () => {
    const state: State = {
      ...freshState(),
      meals: [todayMeal, yesterdayMeal],
      entries: [
        e('today',     'seed-banana', 100, today, 'meal-today'),
        e('yesterday', 'seed-oats',   100, '2026-05-22', 'meal-yesterday'),
      ],
    };
    render(container, vm({ state, selectedDate: '2026-05-22', currentMealId: 'meal-yesterday' }), noopHandlers);
    const totals = container.querySelector('[data-testid="totals-row"]')!.textContent!;
    expect(totals).to.contain('379');
  });

  it('fires onPrevDate when prev button clicked', () => {
    let fired = false;
    render(container, vm(), {
      ...noopHandlers,
      onPrevDate: () => { fired = true; },
    });
    (container.querySelector('[data-testid="prev-date"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onNextDate when next button clicked', () => {
    let fired = false;
    render(container, vm(), {
      ...noopHandlers,
      onNextDate: () => { fired = true; },
    });
    (container.querySelector('[data-testid="next-date"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onDateChange with new value when date input changes', () => {
    let val = '';
    render(container, vm(), {
      ...noopHandlers,
      onDateChange: (d) => { val = d; },
    });
    const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    input.value = '2026-05-15';
    input.dispatchEvent(new Event('change'));
    expect(val).to.equal('2026-05-15');
  });

  it('fires onJumpToday when today shortcut clicked', () => {
    let fired = false;
    render(container, vm({ selectedDate: '2026-05-20' }), {
      ...noopHandlers,
      onJumpToday: () => { fired = true; },
    });
    (container.querySelector('[data-testid="jump-today"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });
});
