import { reducer } from './domain/reducer.js';
import type { Food, Meal, State, Unit } from './domain/types.js';
import { parseLogIntent } from './ui/intents.js';
import { parseFoodIntent } from './ui/foodIntents.js';
import type { FoodFormInput } from './ui/foodIntents.js';
import { render } from './ui/view.js';
import type { ChipIndex, FoodFormField, FoodFormState } from './ui/view.js';
import { shiftDate } from './ui/date.js';
import { exportState, parseImport } from './ui/importExport.js';
import type { StateRepository } from './persistence/repository.js';

export type Clock = {
  now: () => Date;
  today: () => string;
  newId: () => string;
};

export const defaultClock: Clock = {
  now: () => new Date(),
  today: () => new Date().toLocaleDateString('sv-SE'),
  newId: () => crypto.randomUUID(),
};

export type AppOptions = {
  container: HTMLElement;
  repo: StateRepository;
  clock?: Clock;
  copyToClipboard?: (text: string) => Promise<void> | void;
};

const emptyFoodForm: FoodFormState = {
  mode: 'add', foodId: null,
  name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '',
  primaryUnit: 'g', weightPerUnitRaw: '',
  chipsRaw: ['', '', '', ''],
};

function foodFormFromFood(food: Food): FoodFormState {
  const chipsRaw: [string, string, string, string] = food.chips !== null
    ? [String(food.chips[0]), String(food.chips[1]), String(food.chips[2]), String(food.chips[3])]
    : ['', '', '', ''];

  return {
    mode: 'edit',
    foodId: food.id,
    name: food.name,
    kcalRaw: String(food.kcalPer100g),
    proteinRaw: String(food.proteinPer100g),
    carbsRaw: String(food.carbsPer100g),
    fatRaw: String(food.fatPer100g),
    primaryUnit: food.primaryUnit,
    weightPerUnitRaw: food.primaryUnit === 'count' ? String(food.weightPerUnit) : '',
    chipsRaw,
  };
}

export function createApp(opts: AppOptions): void {
  const clock = opts.clock ?? defaultClock;
  const copy = opts.copyToClipboard ?? ((t) => navigator.clipboard?.writeText(t));

  let state: State = opts.repo.load();
  let selectedDate = clock.today();
  let query = '';
  let selectedFoodId: string | null = null;
  let amountRaw = '';
  let logUnit: Unit = 'g';
  let error: string | null = null;
  let view: 'log' | 'foods' = 'log';
  let foodForm: FoodFormState = { ...emptyFoodForm };
  let foodFormError: string | null = null;
  let importText = '';
  let importError: string | null = null;
  let exportText = '';
  let foodsQuery = '';
  let expandedEntryId: string | null = null;
  let currentMealId: string | null = null;

  function mealsForDate(date: string): Meal[] {
    return state.meals
      .filter((m) => m.date === date)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function ensureMealForDate(date: string): string {
    const existing = mealsForDate(date);
    if (existing.length > 0) {
      return existing[existing.length - 1]!.id;
    }

    const mealId = `${date}-meal-1`;
    const meal: Meal = {
      id: mealId,
      date,
      name: 'Meal 1',
      createdAt: clock.now().toISOString(),
    };
    setState(reducer(state, { type: 'StartNextMeal', meal }));
    return mealId;
  }

  currentMealId = mealsForDate(selectedDate).at(-1)?.id ?? null;

  function setState(next: State): void {
    if (next === state) {
      return;
    }

    state = next;
    opts.repo.save(state);
  }

  function paint(): void {
    render(opts.container, {
      state, today: clock.today(), now: clock.now(), selectedDate, query, selectedFoodId,
      amountRaw, logUnit, error,
      view, foodForm, foodFormError, importText, importError, exportText, foodsQuery,
      expandedEntryId,
      currentMealId,
    }, {
      onLog: (foodId, raw, unit) => {
        const mealId = currentMealId ?? ensureMealForDate(selectedDate);
        currentMealId = mealId;

        const result = parseLogIntent({ foodId, amountRaw: raw, unit, date: selectedDate, mealId }, state.foods, clock);
        if (result.kind === 'error') {
          error = result.message;
          paint();
          return;
        }

        setState(reducer(state, result.action));
        amountRaw = '';
        error = null;
        paint();
      },
      onDelete: (entryId) => {
        setState(reducer(state, { type: 'DeleteEntry', entryId }));
        if (expandedEntryId === entryId) {
          expandedEntryId = null;
        }

        error = null;
        paint();
      },
      onQueryChange: (q) => {
        query = q;
        paint();
      },
      onFoodSelect: (id) => {
        selectedFoodId = id;

        const food = state.foods.find((f) => f.id === id);
        if (food) {
          logUnit = food.primaryUnit;
        }

        paint();
      },
      onAmountChange: (a) => {
        amountRaw = a;
        paint();
      },
      onLogUnitChange: (u) => {
        logUnit = u;
        paint();
      },
      onDateChange: (d) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          selectedDate = d;
          currentMealId = mealsForDate(selectedDate).at(-1)?.id ?? null;
        }

        expandedEntryId = null;
        paint();
      },
      onPrevDate: () => {
        selectedDate = shiftDate(selectedDate, -1);
        currentMealId = mealsForDate(selectedDate).at(-1)?.id ?? null;
        expandedEntryId = null;
        paint();
      },
      onNextDate: () => {
        selectedDate = shiftDate(selectedDate, 1);
        currentMealId = mealsForDate(selectedDate).at(-1)?.id ?? null;
        expandedEntryId = null;
        paint();
      },
      onJumpToday: () => {
        selectedDate = clock.today();
        currentMealId = mealsForDate(selectedDate).at(-1)?.id ?? null;
        expandedEntryId = null;
        paint();
      },
      onViewChange: (v) => {
        view = v;
        foodForm = { ...emptyFoodForm };
        foodFormError = null;
        importError = null;
        importText = '';
        exportText = '';
        foodsQuery = '';
        paint();
      },
      onFoodFormChange: (field: FoodFormField, value: string) => {
        foodForm = { ...foodForm, [field]: value };
        paint();
      },
      onFoodFormSubmit: () => {
        const input: FoodFormInput = foodForm.mode === 'edit' && foodForm.foodId !== null
          ? { ...foodForm, mode: 'edit', foodId: foodForm.foodId }
          : { ...foodForm, mode: 'add' };

        const result = parseFoodIntent(input, state.foods, clock);
        if (result.kind === 'error') {
          foodFormError = result.message;
          paint();
          return;
        }

        setState(reducer(state, result.action));
        foodForm = { ...emptyFoodForm };
        foodFormError = null;
        paint();
      },
      onEditFood: (foodId) => {
        const food = state.foods.find((f) => f.id === foodId);
        if (!food || food.deletedAt !== null) {
          return;
        }

        foodForm = foodFormFromFood(food);
        foodFormError = null;
        paint();
      },
      onSoftDeleteFood: (foodId) => {
        setState(reducer(state, { type: 'SoftDeleteFood', foodId, deletedAt: clock.now().toISOString() }));

        if (foodForm.mode === 'edit' && foodForm.foodId === foodId) {
          foodForm = { ...emptyFoodForm };
          foodFormError = null;
        }

        if (selectedFoodId === foodId) {
          selectedFoodId = null;
        }

        paint();
      },
      onCancelEdit: () => {
        foodForm = { ...emptyFoodForm };
        foodFormError = null;
        paint();
      },
      onExport: () => {
        exportText = exportState(state);

        try {
          const result = copy(exportText);
          if (result && typeof (result as Promise<unknown>).catch === 'function') {
            (result as Promise<unknown>).catch(() => {});
          }
        } catch {
          // Clipboard write may throw synchronously when API is unavailable.
        }

        paint();
      },
      onImport: () => {
        const r = parseImport(importText);
        if (r.kind === 'error') {
          importError = r.message;
          paint();
          return;
        }

        setState(reducer(state, { type: 'ReplaceState', state: r.state }));
        importText = '';
        importError = null;

        if (selectedFoodId !== null && !state.foods.some((f) => f.id === selectedFoodId)) {
          selectedFoodId = null;
        }

        paint();
      },
      onImportTextChange: (t) => {
        importText = t;
        paint();
      },
      onFoodsQueryChange: (q) => {
        foodsQuery = q;
        paint();
      },
      onFoodFormChipChange: (index: ChipIndex, value: string) => {
        const next: [string, string, string, string] = [...foodForm.chipsRaw] as [string, string, string, string];
        next[index] = value;
        foodForm = { ...foodForm, chipsRaw: next };
        paint();
      },
      onFoodFormChipsReset: () => {
        foodForm = { ...foodForm, chipsRaw: ['', '', '', ''] };
        paint();
      },
      onToggleEntry: (entryId) => {
        expandedEntryId = expandedEntryId === entryId ? null : entryId;
        paint();
      },
      onEditEntry: (entryId) => {
        const entry = state.entries.find((e) => e.id === entryId);
        if (!entry) {
          return;
        }

        const food = state.foods.find((f) => f.id === entry.foodId);
        if (!food || food.deletedAt !== null) {
          return;
        }

        setState(reducer(state, { type: 'DeleteEntry', entryId }));
        selectedFoodId = entry.foodId;
        amountRaw = String(entry.amount);
        logUnit = entry.unit;
        expandedEntryId = null;
        error = null;
        paint();
      },
      onStartNextMeal: () => {
        const dayMeals = mealsForDate(selectedDate);
        if (dayMeals.length === 0) {
          return;
        }

        const lastMeal = dayMeals[dayMeals.length - 1]!;
        const currentEntryCount = state.entries.filter((e) => e.mealId === lastMeal.id && e.date === selectedDate).length;
        if (currentEntryCount === 0) {
          return;
        }

        const nextIndex = dayMeals.length + 1;
        const newMealId = clock.newId();
        const newMeal: Meal = {
          id: newMealId,
          date: selectedDate,
          name: `Meal ${nextIndex}`,
          createdAt: clock.now().toISOString(),
        };
        setState(reducer(state, { type: 'StartNextMeal', meal: newMeal }));
        currentMealId = newMealId;
        paint();
      },
    });
  }

  paint();
}
