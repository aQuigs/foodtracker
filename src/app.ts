import { reducer } from './domain/reducer.js';
import type { Food, State, Unit } from './domain/types.js';
import { parseLogIntent } from './ui/intents.js';
import { parseFoodIntent } from './ui/foodIntents.js';
import type { FoodFormInput } from './ui/foodIntents.js';
import { render } from './ui/view.js';
import type { FoodFormField, FoodFormState } from './ui/view.js';
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
};

function foodFormFromFood(food: Food): FoodFormState {
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
    }, {
      onLog: (foodId, raw, unit) => {
        const result = parseLogIntent({ foodId, amountRaw: raw, unit, date: selectedDate }, state.foods, clock);
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
        }

        paint();
      },
      onPrevDate: () => {
        selectedDate = shiftDate(selectedDate, -1);
        paint();
      },
      onNextDate: () => {
        selectedDate = shiftDate(selectedDate, 1);
        paint();
      },
      onJumpToday: () => {
        selectedDate = clock.today();
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
    });
  }

  paint();
}
