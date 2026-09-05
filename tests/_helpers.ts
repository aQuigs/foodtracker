import type { CatalogWiring, Clock } from '../src/app.js';
import type { ViewModel, CatalogHits } from '../src/ui/view.js';
import { EMPTY_FOOD_FORM } from '../src/ui/view.js';
import type { Entry, Food, Meal, SourcedFood, State } from '../src/domain/types.js';
import type { FoodMatch } from '../src/ui/search.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { defaultEnabledSources } from '../src/domain/foodSources.js';
import type { FoodSourceRepository } from '../src/persistence/foodSourceRepository.js';
import type { FoodSourceProvider } from '../src/persistence/foodSourceProvider.js';

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
  return { version: 2, enabledSources: defaultEnabledSources(), foods: seedTestFoods(), meals: [], entries: [] };
}

export function seededRepo(): InMemoryRepository {
  const repo = new InMemoryRepository();
  repo.save(seedTestState());
  return repo;
}

export async function until(
  check: () => boolean | Promise<boolean>,
  label = 'condition',
  timeoutMs = 1000,
): Promise<void> {
  const start = performance.now();
  while (!(await check())) {
    if (performance.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }

    await new Promise((r) => setTimeout(r, 4));
  }
}

export async function rejectionOf(p: Promise<unknown>): Promise<Error> {
  try {
    await p;
  } catch (e) {
    return e as Error;
  }

  throw new Error('expected the promise to reject');
}

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
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
  hydration: { sources: {} },
  hasCatalog: true,
  catalogSources: ['usda', 'usda-full'],
  enabledSources: ['usda', 'usda-full'],
  sourcesExpanded: false,
  sourcesFilter: '',
  catalogQuery: '',
  catalogHits: undefined,
  catalogError: null,
  catalogFolds: {},
};

export function catalogHits(
  curated: ReadonlyArray<FoodMatch<SourcedFood>>,
  deep: ReadonlyArray<FoodMatch<SourcedFood>> = [],
  extra: Partial<{ query: string; alreadyAdded: { curated: number; deep: number } }> = {},
): CatalogHits {
  const alreadyAdded = extra.alreadyAdded ?? { curated: 0, deep: 0 };
  return {
    query: extra.query ?? 'q',
    groups: [
      { source: 'usda', shown: curated, alreadyAdded: alreadyAdded.curated },
      { source: 'usda-full', shown: deep, alreadyAdded: alreadyAdded.deep },
    ],
  };
}

export function wiredCatalog(
  repository: FoodSourceRepository,
  versions: Record<string, string>,
  providers: FoodSourceProvider[] = [],
): CatalogWiring {
  return { repository, providers, versions };
}

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
  const group = container.querySelector('[data-testid="log-unit-group"]') as HTMLElement;
  const btn = group.querySelector(`[data-unit="${unit}"]`) as HTMLButtonElement;
  btn.click();
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
  onCatalogQueryChange: () => {},
  onToggleCatalogFold: () => {},
  onImportFood: () => {},
  onToggleSource: () => {},
  onToggleSourcePicker: () => {},
  onSourcesFilterChange: () => {},
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
