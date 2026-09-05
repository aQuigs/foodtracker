import { reducer } from './domain/reducer.js';
import { dailyTotals } from './domain/calc.js';
import { macroShares } from './domain/types.js';
import type { Food, SourcedFood, State, Unit } from './domain/types.js';
import { compatibleUnits } from './domain/units.js';
import { parseLogIntent } from './ui/intents.js';
import { parseFoodIntent } from './ui/foodIntents.js';
import type { FoodFormInput } from './ui/foodIntents.js';
import { render, EMPTY_FOOD_FORM } from './ui/view.js';
import { createFavicon } from './ui/favicon.js';
import type { CatalogHits, ExpandedDetail, FoodFormState, HydrationVm, SourceHydration, ViewHandlers, ViewName } from './ui/view.js';
import { byRank, fuzzyMatch, type FoodMatch } from './ui/search.js';
import { isValidIsoDate, shiftDate } from './domain/date.js';
import { exportState, parseImport } from './ui/importExport.js';
import { CATALOG_TIERS, FOOD_SOURCES, sourceTier } from './domain/foodSources.js';
import { foodNameKey, nameTaken } from './domain/foodNames.js';
import { searchKey } from './domain/searchKey.js';
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
  favicon?: HTMLLinkElement | undefined;
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

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function createApp(opts: AppOptions): void {
  const clock = opts.clock ?? defaultClock;
  const copy = opts.copyToClipboard ?? ((t) => navigator.clipboard?.writeText(t));
  const favicon = opts.favicon ? createFavicon(opts.favicon) : null;

  let state: State = opts.repo.load();
  let selectedDate = clock.today();
  let query = '';
  let selectedFoodId: string | null = null;
  let amount = '';
  let logUnit: Unit = 'g';
  let error: string | null = null;
  let view: ViewName = 'log';
  let foodForm: FoodFormState = { ...EMPTY_FOOD_FORM };
  let foodFormError: string | null = null;
  let importText = '';
  let importError: string | null = null;
  let exportText = '';
  let foodsQuery = '';
  let expandedDetail: ExpandedDetail | null = null;
  let hydration: HydrationVm = { sources: {} };
  let catalogQuery = '';
  let catalogHits: CatalogHits | undefined;
  let catalogMoreExpanded = false;
  let catalogError: string | null = null;
  let catalogGen = 0;

  const { catalog, catalogProviders, catalogVersions } = opts;

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
    catalogHits = undefined;
    catalogMoreExpanded = false;
    catalogError = null;
    catalogGen += 1;
  }

  function refreshCatalogResults(q: string): void {
    if (!catalog) {
      return;
    }

    catalogError = null;
    catalogGen += 1;
    const gen = catalogGen;

    const key = searchKey(q);
    if (key === '') {
      catalogHits = undefined;
      paint();
      return;
    }

    // Hide exactly what Add would refuse — a live food with the same id or
    // name — and nothing more: a soft-deleted import stays findable so it can
    // be revived rather than stranded out of both lists.
    const live = state.foods.filter((f) => f.deletedAt === null);
    const liveIds = new Set(live.map((f) => f.id));
    const liveNames = new Set(live.map((f) => foodNameKey(f.name)));
    // fuzzyMatch never drops a row the repository matched (its query is the
    // same folded key), so shown + alreadyAdded always account for every hit.
    const tier = (sourced: SourcedFood[]) => {
      const fresh = sourced.filter((f) => !liveIds.has(f.id) && !liveNames.has(foodNameKey(f.name)));
      const shown = fuzzyMatch(fresh, q);
      shown.sort(byRank((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name)));
      return { shown, alreadyAdded: sourced.length - fresh.length };
    };

    // Named explicitly so a partition cached under a source this build no
    // longer knows about can't surface rows the UI has no tier for.
    void catalog.search(q, { sources: Object.values(FOOD_SOURCES) }).then((hits) => {
      if (gen !== catalogGen) {
        return;
      }

      const curated = tier(hits.filter((f) => sourceTier(f.source) === CATALOG_TIERS.CURATED));
      const deep = tier(hits.filter((f) => sourceTier(f.source) === CATALOG_TIERS.DEEP));
      catalogHits = {
        query: key,
        shown: { curated: curated.shown, deep: deep.shown },
        alreadyAdded: { curated: curated.alreadyAdded, deep: deep.alreadyAdded },
      };
      paint();
    }, (e: unknown) => {
      if (gen !== catalogGen) {
        return;
      }

      catalogHits = { query: key, shown: { curated: [], deep: [] }, alreadyAdded: { curated: 0, deep: 0 } };
      catalogError = `Couldn't search the catalog (${errorMessage(e)}).`;
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
      // Typing is a new interaction, so the deep tier folds shut; a same-query
      // refresh (import, hydration completing) keeps whatever is expanded.
      catalogMoreExpanded = false;
      refreshCatalogResults(q);
    },
    onToggleCatalogMore: () => {
      catalogMoreExpanded = !catalogMoreExpanded;
      paint();
    },
    onImportFood: (sourcedId) => {
      const hits = catalogHits;
      if (!catalog || !hits) {
        return;
      }

      const hit = hits.shown.curated.find((r) => r.food.id === sourcedId)
        ?? hits.shown.deep.find((r) => r.food.id === sourcedId);
      if (!hit) {
        return;
      }

      const food = sourcedToFood(hit.food);

      // Rows the rule would refuse are hidden, but a row rendered before a
      // same-named add lands can still be clicked; name the reason rather
      // than let the reducer's silent refusal read as a serving-unit change.
      if (nameTaken(food.name, state.foods, food.id)) {
        catalogError = `You already have a food called "${food.name}". Rename or delete it to add this one.`;
        paint();
        return;
      }

      const existing = state.foods.find((f) => f.id === food.id);
      const action = existing && existing.deletedAt !== null
        ? { type: 'ReviveFood' as const, food }
        : { type: 'AddFood' as const, food };

      const next = reducer(state, action);
      if (next === state && action.type === 'ReviveFood') {
        catalogError = 'This food\'s serving unit changed in the catalog. Delete its old entries to add it again.';
        paint();
        return;
      }

      catalogError = null;
      setState(next);

      // The row leaves now, not when the re-search resolves, so the click
      // has a visible effect at once.
      const tier = sourceTier(hit.food.source);
      catalogHits = {
        ...hits,
        shown: { ...hits.shown, [tier]: hits.shown[tier].filter((r) => r.food.id !== food.id) },
        alreadyAdded: { ...hits.alreadyAdded, [tier]: hits.alreadyAdded[tier] + 1 },
      };
      paint();
      refreshCatalogResults(catalogQuery);
    },
  };

  function setSourceStatus(source: string, status: SourceHydration | null): void {
    const { [source]: _previous, ...rest } = hydration.sources;
    hydration = { sources: status === null ? rest : { ...hydration.sources, [source]: status } };
    paint();
  }

  // Every failure, including the repository refusing to open, must land in
  // `failed`: a source left on `fetching` would show the banner forever.
  async function hydrateSource(
    catalog: FoodSourceRepository,
    providers: FoodSourceProvider[],
    source: string,
    expectedVersion: string,
  ): Promise<void> {
    let current: string | null = null;
    try {
      current = await catalog.currentVersion(source);
      if (current === expectedVersion) {
        setSourceStatus(source, null);
        return;
      }

      setSourceStatus(source, { kind: 'fetching', loaded: 0 });

      const provider = providers.find((p) => p.name === source);
      if (!provider) {
        throw new Error(`No provider for source "${source}"`);
      }

      const manifest = await provider.fetchManifest(expectedVersion);
      if (manifest.version !== expectedVersion) {
        throw new Error(`Manifest reports version ${manifest.version}, expected ${expectedVersion}`);
      }

      let shownKb = 0;
      const items = await provider.fetchDataset(manifest, (loaded) => {
        const kb = Math.round(loaded / 1024);
        if (kb !== shownKb) {
          shownKb = kb;
          setSourceStatus(source, { kind: 'fetching', loaded });
        }
      });
      await catalog.hydrate(source, items, manifest);
      setSourceStatus(source, null);

      // A search typed while this source was still downloading silently
      // missed its items; re-run it now that they are searchable.
      if (catalogQuery.trim() !== '') {
        refreshCatalogResults(catalogQuery);
      }
    } catch (e) {
      setSourceStatus(source, { kind: 'failed', cachedVersion: current, message: errorMessage(e) });
    }
  }

  async function hydrateAll(
    catalog: FoodSourceRepository,
    providers: FoodSourceProvider[],
    versions: Record<string, string>,
  ): Promise<void> {
    for (const [source, version] of Object.entries(versions)) {
      await hydrateSource(catalog, providers, source, version);
    }
  }

  function paint(): void {
    render(opts.container, {
      state, today: clock.today(), now: clock.now(), selectedDate, query, selectedFoodId, amount, logUnit, error,
      view, foodForm, foodFormError, importText, importError, exportText, foodsQuery, expandedDetail,
      hydration,
      hasCatalog: catalog !== undefined,
      catalogQuery,
      catalogHits,
      catalogError,
      catalogMoreExpanded,
    }, handlers);
    // The tab icon answers "how is my day going", so it tracks today rather
    // than the date being browsed.
    favicon?.render(macroShares(dailyTotals(state, clock.today())));
  }

  paint();

  if (catalog && catalogProviders && catalogVersions) {
    void hydrateAll(catalog, catalogProviders, catalogVersions);
  }
}
