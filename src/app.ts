import { reducer } from './domain/reducer.js';
import type { Food, SourcedFood, State, Unit } from './domain/types.js';
import { compatibleUnits } from './domain/units.js';
import { parseLogIntent } from './ui/intents.js';
import { parseFoodIntent } from './ui/foodIntents.js';
import type { FoodFormInput } from './ui/foodIntents.js';
import { render, EMPTY_FOOD_FORM } from './ui/view.js';
import type { ExpandedDetail, FoodFormState, HydrationVm, ViewHandlers } from './ui/view.js';
import { byRank, fuzzyMatch, preferNonFuzzy, type FoodMatch } from './ui/search.js';
import { isValidIsoDate, shiftDate } from './domain/date.js';
import { exportState, parseImport } from './ui/importExport.js';
import type { StateRepository } from './persistence/repository.js';
import type { FoodSourceRepository } from './persistence/foodSourceRepository.js';
import type { FoodSourceProvider } from './persistence/foodSourceProvider.js';

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
  let catalogQuery = '';
  let catalogResults: ReadonlyArray<FoodMatch<SourcedFood>> | undefined = undefined;
  let catalogGen = 0;

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
    catalogQuery = '';
    catalogResults = undefined;
    catalogGen += 1;
  }

  function refreshCatalogResults(q: string): void {
    if (!catalog) {
      return;
    }

    catalogGen += 1;
    const gen = catalogGen;

    if (q.trim() === '') {
      catalogResults = undefined;
      paint();
      return;
    }

    catalog.search(q, { limit: 50 }).then((sourced) => {
      if (gen !== catalogGen) {
        return;
      }

      // Dedupe only against live foods so a soft-deleted import can be found
      // and revived, not stranded out of both the foods list and the catalog.
      const liveIds = new Set(state.foods.filter((f) => f.deletedAt === null).map((f) => f.id));
      const candidates = sourced.filter((f) => !liveIds.has(f.id));
      const allMatches = fuzzyMatch(candidates, q);
      const filtered = preferNonFuzzy(allMatches);
      filtered.sort(byRank((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name)));

      catalogResults = filtered;
      paint();
    });
  }

  function sourcedToFood(sf: SourcedFood): Food {
    return {
      id: sf.id,
      name: sf.name,
      nutritionFacts: sf.nutritionFacts,
      servingSize: sf.servingSize,
      servingUnit: sf.servingUnit,
      createdAt: clock.now().toISOString(),
      deletedAt: null,
      source: sf.source,
    };
  }

  const handlers: ViewHandlers = {
    onLog: (foodId, amt, unit) => {
      const result = parseLogIntent({ foodId, amount: amt, unit, date: selectedDate }, state.foods, clock);
      if (result.kind === 'error') {
        error = result.message;
        paint();
        return;
      }

      setState(reducer(state, result.action));
      amount = '';
      error = null;
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
    onQueryChange: (q) => { query = q; paint(); },
    onFoodSelect: (id) => {
      selectedFoodId = id;
      const food = state.foods.find((f) => f.id === id && f.deletedAt === null);

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
    onCatalogQueryChange: (q) => {
      catalogQuery = q;
      refreshCatalogResults(q);
    },
    onImportFood: (sourcedId) => {
      if (!catalog) {
        return;
      }

      const hit = catalogResults?.find((r) => r.food.id === sourcedId);
      if (!hit) {
        return;
      }

      const food = sourcedToFood(hit.food);
      const existing = state.foods.find((f) => f.id === food.id);
      const action = existing && existing.deletedAt !== null
        ? { type: 'ReviveFood' as const, food }
        : { type: 'AddFood' as const, food };
      setState(reducer(state, action));
      refreshCatalogResults(catalogQuery);
    },
  };

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
        hydration = {
          sources: {
            ...hydration.sources,
            [source]: {
              kind: 'failed',
              hasCached: current !== null,
              cachedVersion: current,
              message: `No provider for source "${source}"`,
            },
          },
        };
        paint();
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
      hasCatalog: catalog !== undefined,
    };
    if (catalogResults !== undefined) {
      render(opts.container, { ...vm, catalogResults }, handlers);
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
