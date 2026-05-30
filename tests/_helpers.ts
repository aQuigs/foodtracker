import type { Clock } from '../src/app.js';
import type { ViewModel } from '../src/ui/view.js';
import { EMPTY_FOOD_FORM } from '../src/ui/view.js';
import { freshState } from '../src/domain/seed.js';
import type { Entry, Food, Meal, State } from '../src/domain/types.js';

const SEED_AT = '2026-01-01T00:00:00.000Z';

export function seedTestFoods(): Food[] {
  return [
    { id: 'seed-oats',      name: 'Oats',                nutritionFacts: { calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5 }, servingSize: 100, servingUnit: 'g',     createdAt: SEED_AT, deletedAt: null },
    { id: 'seed-banana',    name: 'Banana',              nutritionFacts: { calories: 89,  protein: 1.1,  carbs: 22.8, fat: 0.3 }, servingSize: 100, servingUnit: 'g',     createdAt: SEED_AT, deletedAt: null },
    { id: 'seed-chicken',   name: 'Chicken breast',      nutritionFacts: { calories: 165, protein: 31,   carbs: 0,    fat: 3.6 }, servingSize: 100, servingUnit: 'g',     createdAt: SEED_AT, deletedAt: null },
    { id: 'seed-rice',      name: 'White rice (cooked)', nutritionFacts: { calories: 130, protein: 2.7,  carbs: 28,   fat: 0.3 }, servingSize: 100, servingUnit: 'g',     createdAt: SEED_AT, deletedAt: null },
    { id: 'seed-egg',       name: 'Egg',                 nutritionFacts: { calories: 78,  protein: 6.5,  carbs: 0.6,  fat: 5.5 }, servingSize: 1,   servingUnit: 'count', createdAt: SEED_AT, deletedAt: null },
    { id: 'seed-yogurt',    name: 'Greek yogurt',        nutritionFacts: { calories: 59,  protein: 10,   carbs: 3.6,  fat: 0.4 }, servingSize: 100, servingUnit: 'g',     createdAt: SEED_AT, deletedAt: null },
    { id: 'seed-almonds',   name: 'Almonds',             nutritionFacts: { calories: 579, protein: 21,   carbs: 22,   fat: 50  }, servingSize: 100, servingUnit: 'g',     createdAt: SEED_AT, deletedAt: null },
    { id: 'seed-broccoli',  name: 'Broccoli',            nutritionFacts: { calories: 34,  protein: 2.8,  carbs: 7,    fat: 0.4 }, servingSize: 100, servingUnit: 'g',     createdAt: SEED_AT, deletedAt: null },
    { id: 'seed-salmon',    name: 'Salmon',              nutritionFacts: { calories: 208, protein: 20,   carbs: 0,    fat: 13  }, servingSize: 100, servingUnit: 'g',     createdAt: SEED_AT, deletedAt: null },
    { id: 'seed-olive-oil', name: 'Olive oil',           nutritionFacts: { calories: 884, protein: 0,    carbs: 0,    fat: 100 }, servingSize: 100, servingUnit: 'g',     createdAt: SEED_AT, deletedAt: null },
  ];
}

export function seedTestState(): State {
  return { version: 2, foods: seedTestFoods(), meals: [], entries: [] };
}

export const TODAY = '2026-05-23';

export const baseVm: ViewModel = {
  state: seedTestState(),
  today: TODAY,
  now: new Date(`${TODAY}T12:00:00Z`),
  selectedDate: TODAY,
  query: '', selectedFoodId: null, amount: '', logUnit: 'g', error: null,
  view: 'log',
  foodForm: { ...EMPTY_FOOD_FORM },
  foodFormError: null,
  importText: '', importError: null, exportText: '',
  foodsQuery: '',
  expandedDetail: null,
};

export function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

export function fixedClock(now = `${TODAY}T10:00:00.000Z`): Clock {
  let seq = 0;
  return {
    now: () => new Date(now),
    today: () => TODAY,
    newId: () => `id-${++seq}`,
  };
}

export function pickFood(container: HTMLElement, name: string): void {
  const opts = Array.from(container.querySelectorAll('[data-testid="food-option"]')) as HTMLElement[];
  const match = opts.find((o) => o.textContent!.includes(name));
  if (!match) {
    throw new Error(`No food option containing "${name}"`);
  }

  match.click();
}

export function setAmount(container: HTMLElement, amount: string): void {
  const input = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
  input.value = amount;
  input.dispatchEvent(new Event('input'));
}

export function setLogUnit(container: HTMLElement, unit: string): void {
  const sel = container.querySelector('[data-testid="log-unit-select"]') as HTMLSelectElement;
  sel.value = unit;
  sel.dispatchEvent(new Event('change'));
}

export function clickLog(container: HTMLElement): void {
  (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();
}

export function setDateInput(container: HTMLElement, date: string): void {
  const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
  input.value = date;
  input.dispatchEvent(new Event('change'));
}

export function clickFoodsTab(container: HTMLElement): void {
  (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();
}

export function clickLogTab(container: HTMLElement): void {
  (container.querySelector('[data-testid="view-toggle-log"]') as HTMLButtonElement).click();
}

export function chipRow(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-testid="chip-row"]') as HTMLElement;
}

export function chipButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(chipRow(container).querySelectorAll('button')) as HTMLButtonElement[];
}

export function chipLabels(container: HTMLElement): string[] {
  return chipButtons(container).map((b) => b.textContent!.trim());
}

export function entryRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="entry-row"]')) as HTMLElement[];
}

export function findEntryRow(container: HTMLElement, foodName: string): HTMLElement {
  const row = entryRows(container).find((r) => r.textContent!.includes(foodName));
  if (!row) {
    throw new Error(`No entry row containing "${foodName}"`);
  }

  return row;
}

export function entryDetail(container: HTMLElement, entryId?: string): HTMLElement | null {
  const sel = entryId === undefined
    ? '[data-testid="entry-detail"]'
    : `[data-testid="entry-detail"][data-entry-id="${entryId}"]`;
  return container.querySelector(sel) as HTMLElement | null;
}

export const noopHandlers = {
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
  onToggleEntry: () => {},
  onToggleFood: () => {},
  onNewMeal: () => {},
};

export function foodDetail(container: HTMLElement, foodId?: string): HTMLElement | null {
  const sel = foodId === undefined
    ? '[data-testid="food-detail"]'
    : `[data-testid="food-detail"][data-food-id="${foodId}"]`;
  return container.querySelector(sel) as HTMLElement | null;
}

export function withMealsFromEntries(state: State): State {
  const dates = [...new Set(state.entries.map((e) => e.date))];
  const meals: Meal[] = dates.map((date) => ({ id: `m-${date}`, date, position: 0 }));
  const mealByDate = new Map(meals.map((m) => [m.date, m.id]));
  const entries: Entry[] = state.entries.map((e) => ({ ...e, mealId: mealByDate.get(e.date)! }));
  return { ...state, meals: [...state.meals, ...meals], entries };
}
