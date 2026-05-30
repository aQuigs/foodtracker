import { reducer } from './domain/reducer.js';
import type { Food, SourcedFood, State, Unit } from './domain/types.js';
import { compatibleUnits } from './domain/units.js';
import { parseLogIntent } from './ui/intents.js';
import { parseFoodIntent } from './ui/foodIntents.js';
import type { FoodFormInput } from './ui/foodIntents.js';
import { render, EMPTY_FOOD_FORM } from './ui/view.js';
import type { ExpandedDetail, FoodFormState, HydrationVm, PickerItem, ViewHandlers } from './ui/view.js';
import { isValidIsoDate, shiftDate } from './domain/date.js';
import { exportState, parseImport } from './ui/importExport.js';
import type { StateRepository } from './persistence/repository.js';
import type { FoodSourceRepository } from './persistence/foodSourceRepository.js';
import type { FoodSourceProvider } from './persistence/foodSourceProvider.js';
import { userPickerOrder } from './ui/search.js';
import { compareForLog } from './ui/recent.js';

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
  catalog?: FoodSourceRepository;
  catalogProviders?: FoodSourceProvider[];
  catalogVersions?: Record<string, string>;
};

function foodFormFromFood(food: Food): FoodFormState {
  return {
    mode: 'edit',
    foodId: food.id,
    name: food.name,
    calories: String(food.nutritionFacts.calories),
    protein:  String(food.nutritionFacts.protein),
    carbs:    String(food.nutritionFacts.carbs),
    fat:      String(food.nutritionFacts.fat),
    servingSize: String(food.servingSize),
    servingUnit: food.servingUnit,
  };
}

export function createApp(opts: AppOptions): void {
  const clock = opts.clock ?? defaultClock;
  const copy = opts.copyToClipboard ?? ((t) => navigator.clipboard?.writeText(t));

  let state: State = opts.repo.load();
  let selectedDate = clock.today();
  let query = '';
  let selectedFoodId: string | null = null;
  let amount = '';
  let logUnit: Unit = 'g';
  let error: string | null = null;
  let view: 'log' | 'foods' = 'log';
  let foodForm: FoodFormState = { ...EMPTY_FOOD_FORM };
  let foodFormError: string | null = null;
  let importText = '';
  let importError: string | null = null;
  let exportText = '';
  let foodsQuery = '';
  let expandedDetail: ExpandedDetail | null = null;
  let hydration: HydrationVm = { sources: {} };
  let searchGen = 0;
  let searchResults: ReadonlyArray<PickerItem> | undefined = undefined;

  const catalog = opts.catalog;
  const catalogProviders = opts.catalogProviders;
  const catalogVersions = opts.catalogVersions;

  function setState(next: State): void {
    if (next === state) {
      return;
    }

    state = next;
    opts.repo.save(state);
  }

  function changeDate(d: string): void {
    if (d === selectedDate) {
      paint();
      return;
    }

    selectedDate = d;
    expandedDetail = null;
    paint();
  }

  function resetTransient(): void {
    selectedFoodId = null;
    amount = '';
    logUnit = 'g';
    error = null;
    query = '';
    foodsQuery = '';
    foodForm = { ...EMPTY_FOOD_FORM };
    foodFormError = null;
    importText = '';
    importError = null;
    exportText = '';
    expandedDetail = null;
    searchResults = undefined;
  }

  function findSourcedById(id: string): SourcedFood | null {
    const hit = searchResults?.find(
      (r): r is Extract<PickerItem, { origin: 'sourced' }> =>
        r.origin === 'sourced' && r.food.id === id,
    );
    return hit ? hit.food : null;
  }

  function pickedFoodShape(id: string): Food | SourcedFood | null {
    const inState = state.foods.find((f) => f.id === id);

    if (inState && inState.deletedAt === null) {
      return inState;
    }

    return findSourcedById(id);
  }

  function ensureLoggableFood(id: string): boolean {
    const existing = state.foods.find((f) => f.id === id);

    if (existing && existing.deletedAt === null) {
      return true;
    }

    if (existing && existing.deletedAt !== null) {
      setState(reducer(state, { type: 'ReviveFood', foodId: id }));
      refreshSearchResults();
      return true;
    }

    const sourced = findSourcedById(id);

    if (!sourced) {
      return false;
    }

    const materialized: Food = {
      id: sourced.id,
      name: sourced.name,
      nutritionFacts: sourced.nutritionFacts,
      servingSize: sourced.servingSize,
      servingUnit: sourced.servingUnit,
      createdAt: clock.now().toISOString(),
      deletedAt: null,
    };
    setState(reducer(state, { type: 'AddFood', food: materialized }));
    refreshSearchResults();
    return true;
  }

  const handlers: ViewHandlers = {
    onLog: (foodId, amt, unit) => {
      if (foodId) {
        ensureLoggableFood(foodId);
      }

      const result = parseLogIntent({ foodId, amount: amt, unit, date: selectedDate }, state.foods, clock);
      if (result.kind === 'error') {
        error = result.message;
      } else {
        setState(reducer(state, result.action));
        amount = '';
        error = null;
      }

      paint();
    },
    onDelete: (entryId) => {
      setState(reducer(state, { type: 'DeleteEntry', entryId }));
      if (expandedDetail?.kind === 'entry' && expandedDetail.id === entryId) {
        expandedDetail = null;
      }

      error = null;
      paint();
    },
    onQueryChange: (q) => { query = q; paint(); refreshSearchResults(); },
    onFoodSelect: (id) => {
      selectedFoodId = id;
      const food = pickedFoodShape(id);

      if (food) {
        logUnit = compatibleUnits(food)[0] ?? 'g';
      }

      expandedDetail = { kind: 'food', id };
      paint();
    },
    onAmountChange: (a) => { amount = a; paint(); },
    onLogUnitChange: (u) => { logUnit = u; paint(); },
    onDateChange: (d) => {
      if (isValidIsoDate(d)) {
        changeDate(d);
      } else {
        paint();
      }
    },
    onPrevDate: () => changeDate(shiftDate(selectedDate, -1)),
    onNextDate: () => changeDate(shiftDate(selectedDate, 1)),
    onJumpToday: () => changeDate(clock.today()),
    onViewChange: (v) => { view = v; resetTransient(); paint(); },
    onFoodFormChange: (field, value) => {
      foodForm = { ...foodForm, [field]: value };
      paint();
    },
    onFoodFormSubmit: () => {
      const { mode, foodId, ...fields } = foodForm;
      const input: FoodFormInput = mode === 'edit' && foodId !== null
        ? { mode, foodId, ...fields }
        : { mode: 'add', ...fields };
      const result = parseFoodIntent(input, state.foods, state.entries, clock);
      if (result.kind === 'error') {
        foodFormError = result.message;
      } else {
        setState(reducer(state, result.action));
        foodForm = { ...EMPTY_FOOD_FORM };
        foodFormError = null;
      }

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
        foodForm = { ...EMPTY_FOOD_FORM };
        foodFormError = null;
      }

      if (selectedFoodId === foodId) {
        selectedFoodId = null;
      }

      if (expandedDetail?.kind === 'food' && expandedDetail.id === foodId) {
        expandedDetail = null;
      }

      paint();
    },
    onCancelEdit: () => {
      foodForm = { ...EMPTY_FOOD_FORM };
      foodFormError = null;
      paint();
    },
    onExport: () => {
      exportText = exportState(state);
      try {
        const result = copy(exportText);
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {
        // Clipboard write may throw synchronously when API is unavailable.
      }

      paint();
    },
    onImport: () => {
      const r = parseImport(importText, clock.newId);
      if (r.kind === 'error') {
        importError = r.message;
      } else {
        setState(reducer(state, { type: 'ReplaceState', state: r.state }));
        resetTransient();
      }

      paint();
    },
    onImportTextChange: (t) => { importText = t; paint(); },
    onFoodsQueryChange: (q) => { foodsQuery = q; paint(); },
    onToggleEntry: (entryId) => {
      expandedDetail = expandedDetail?.kind === 'entry' && expandedDetail.id === entryId
        ? null
        : { kind: 'entry', id: entryId };
      paint();
    },
    onToggleFood: (foodId) => {
      expandedDetail = expandedDetail?.kind === 'food' && expandedDetail.id === foodId
        ? null
        : { kind: 'food', id: foodId };
      paint();
    },
    onNewMeal: (date) => {
      setState(reducer(state, { type: 'NewMeal', mealId: clock.newId(), date }));
      paint();
    },
  };

  function refreshSearchResults(): void {
    searchGen += 1;
    const gen = searchGen;

    const userItems: PickerItem[] = userPickerOrder(
      state.foods, query, compareForLog(state, clock.now()),
    ).map(({ food, indices }) => ({ origin: 'user' as const, food, indices }));

    if (!catalog) {
      searchResults = userItems;
      paint();
      return;
    }

    catalog.search(query, { limit: 50 }).then((sourced) => {
      if (gen !== searchGen) {
        return;
      }

      const userIds = new Set(userItems.map((i) => i.food.id));
      const sourcedItems: PickerItem[] = sourced
        .filter((f) => !userIds.has(f.id))
        .map((food) => ({ origin: 'sourced' as const, food }));

      searchResults = [...userItems, ...sourcedItems];
      paint();
    });
  }

  async function hydrateAll(): Promise<void> {
    if (!catalog || !catalogProviders || !catalogVersions) {
      return;
    }

    for (const [source, expectedVersion] of Object.entries(catalogVersions)) {
      const current = await catalog.currentVersion(source);
      if (current === expectedVersion) {
        const { [source]: _removed, ...rest } = hydration.sources;
        hydration = { sources: rest };
        paint();
        continue;
      }

      hydration = {
        sources: {
          ...hydration.sources,
          [source]: { kind: 'fetching', loaded: 0, total: 0 },
        },
      };
      paint();

      const provider = catalogProviders.find((p) => p.name === source);
      if (!provider) {
        continue;
      }

      try {
        const manifest = await provider.fetchManifest(expectedVersion);
        const items = await provider.fetchDataset(manifest, (loaded, total) => {
          hydration = {
            sources: {
              ...hydration.sources,
              [source]: { kind: 'fetching', loaded, total },
            },
          };
          paint();
        });

        await catalog.hydrate(source, items, manifest);

        hydration = {
          sources: {
            ...hydration.sources,
            [source]: { kind: 'fetched', version: expectedVersion },
          },
        };
        paint();
        refreshSearchResults();
      } catch (e) {
        const cachedVersion = await catalog.currentVersion(source);
        hydration = {
          sources: {
            ...hydration.sources,
            [source]: {
              kind: 'failed',
              hasCached: cachedVersion !== null,
              cachedVersion,
              message: (e as Error).message,
            },
          },
        };
        paint();
      }
    }
  }

  function paint(): void {
    const vm = {
      state, today: clock.today(), now: clock.now(), selectedDate, query, selectedFoodId, amount, logUnit, error,
      view, foodForm, foodFormError, importText, importError, exportText, foodsQuery, expandedDetail,
      hydration,
    };
    if (searchResults !== undefined) {
      render(opts.container, { ...vm, searchResults }, handlers);
    } else {
      render(opts.container, vm, handlers);
    }
  }

  if (catalog && catalogProviders && catalogVersions) {
    for (const source of Object.keys(catalogVersions)) {
      hydration = {
        sources: {
          ...hydration.sources,
          [source]: { kind: 'fetching', loaded: 0, total: 0 },
        },
      };
    }
  }

  paint();

  if (catalog && catalogProviders && catalogVersions) {
    void hydrateAll();
  }
}
