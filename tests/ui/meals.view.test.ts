import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { ViewModel, ViewHandlers, FoodFormState } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { Entry, Meal, State } from '../../src/domain/types.js';

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

const meal1: Meal = { id: 'meal-1', date: today, name: 'Meal 1', createdAt: `${today}T08:00:00Z` };
const meal2: Meal = { id: 'meal-2', date: today, name: 'Meal 2', createdAt: `${today}T12:00:00Z` };

const entry1: Entry = {
  id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', grams: 120,
  loggedAt: `${today}T08:30:00Z`, mealId: 'meal-1',
};

const entry2: Entry = {
  id: 'e2', date: today, foodId: 'seed-oats', amount: 50, unit: 'g', grams: 50,
  loggedAt: `${today}T12:30:00Z`, mealId: 'meal-2',
};

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function vm(overrides: Partial<ViewModel> = {}): ViewModel {
  return {
    state: freshState(),
    today,
    now: new Date(`${today}T12:00:00Z`),
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

describe('meals view', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders a heading for each meal in chronological order', () => {
    const state: State = { ...freshState(), meals: [meal1, meal2], entries: [entry1, entry2] };
    render(container, vm({ state, currentMealId: 'meal-2' }), noopHandlers);
    const headings = Array.from(container.querySelectorAll('.meal-heading')).map((h) => h.textContent!.trim());
    expect(headings).to.deep.equal(['Meal 1', 'Meal 2']);
  });

  it('renders a subtotal row for each meal', () => {
    const state: State = { ...freshState(), meals: [meal1, meal2], entries: [entry1, entry2] };
    render(container, vm({ state, currentMealId: 'meal-2' }), noopHandlers);
    const sub1 = container.querySelector(`[data-testid="meal-subtotal-meal-1"]`);
    const sub2 = container.querySelector(`[data-testid="meal-subtotal-meal-2"]`);
    expect(sub1).to.exist;
    expect(sub2).to.exist;
    expect(sub1!.textContent).to.contain('107');
    expect(sub2!.textContent).to.contain('190');
  });

  it('"End meal" button is disabled when current meal has 0 entries', () => {
    const state: State = { ...freshState(), meals: [meal1], entries: [] };
    render(container, vm({ state, currentMealId: 'meal-1' }), noopHandlers);
    const btn = container.querySelector('[data-testid="start-next-meal"]') as HTMLButtonElement;
    expect(btn).to.exist;
    expect(btn.disabled).to.equal(true);
  });

  it('"End meal" button is enabled when current meal has 1+ entries', () => {
    const state: State = { ...freshState(), meals: [meal1], entries: [entry1] };
    render(container, vm({ state, currentMealId: 'meal-1' }), noopHandlers);
    const btn = container.querySelector('[data-testid="start-next-meal"]') as HTMLButtonElement;
    expect(btn).to.exist;
    expect(btn.disabled).to.equal(false);
  });

  it('"End meal" button fires onStartNextMeal when clicked', () => {
    let fired = false;
    const state: State = { ...freshState(), meals: [meal1], entries: [entry1] };
    render(container, vm({ state, currentMealId: 'meal-1' }), {
      ...noopHandlers,
      onStartNextMeal: () => { fired = true; },
    });
    const btn = container.querySelector('[data-testid="start-next-meal"]') as HTMLButtonElement;
    btn.click();
    expect(fired).to.equal(true);
  });

  it('day total is shown at the bottom and sums across all meals', () => {
    const state: State = { ...freshState(), meals: [meal1, meal2], entries: [entry1, entry2] };
    render(container, vm({ state, currentMealId: 'meal-2' }), noopHandlers);
    const totals = container.querySelector('[data-testid="totals-row"]')!.textContent!;
    expect(totals).to.contain('296');
  });
});
