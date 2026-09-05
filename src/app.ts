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
import type { CatalogGroup, CatalogHits, ExpandedDetail, FoodFormState, HydrationVm, SourceHydration, ViewHandlers, ViewName } from './ui/view.js';
import { byRank, fuzzyMatch, type FoodMatch } from './ui/search.js';
import { isValidIsoDate, shiftDate } from './domain/date.js';
import { exportState, parseImport } from './ui/importExport.js';
import { CATALOG_TIERS, sourceTier } from './domain/foodSources.js';
import { foodIdentityKey, nameTaken } from './domain/foodNames.js';
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

export type CatalogWiring = {
  repository: FoodSourceRepository;
  providers: FoodSourceProvider[];
  versions: Record<string, string>;
};

export type AppOptions = {
  container: HTMLElement;
  favicon?: HTMLLinkElement | undefined;
  repo: StateRepository;
  clock?: Clock;
  copyToClipboard?: (text: string) => Promise<void> | void;
  catalog?: CatalogWiring;
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
  let catalogFolds: Record<string, boolean> = {};
  let catalogError: string | null = null;
  let catalogGen = 0;
  let sourcesExpanded = false;
  let sourcesFilter = '';
  const hydratingSources = new Set<string>();

  const { catalog } = opts;
  // Wired order = registry order filtered to what main.ts actually wired up;
  // the picker and every catalog result group follow this order.
  const catalogSources = Object.keys(catalog?.versions ?? {});

  function enabledWired(): string[] {
    return catalogSources.filter((s) => state.enabledSources.includes(s));
  }

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
    catalogFolds = {};
    catalogError = null;
    catalogGen += 1;
    sourcesExpanded = false;
    sourcesFilter = '';
  }

  // Open iff the query's curated groups have no shown rows and no
  // already-added matches — the rule every non-curated fold defaults to,
  // whether the whole result set is new or one group just joined it.
  function defaultFold(groups: CatalogGroup[]): boolean {
    const curated = groups.filter((g) => sourceTier(g.source) === CATALOG_TIERS.CURATED);
    return curated.every((g) => g.shown.length === 0 && g.alreadyAdded === 0);
  }

  // A new key resets every fold to the default. A same-key refresh (Add,
  // hydration finishing, a source ticked on mid-query) keeps whatever the
  // user already left open or closed, and only fills in the default for a
  // group that has no entry yet — so a fold that just appeared follows the
  // same rule as its siblings instead of starting closed.
  function applyCatalogHits(key: string, groups: CatalogGroup[]): void {
    const sameKey = key === catalogHits?.query;
    const fallback = defaultFold(groups);

    const folds: Record<string, boolean> = {};
    for (const g of groups) {
      if (sourceTier(g.source) === CATALOG_TIERS.CURATED) {
        continue;
      }

      folds[g.source] = sameKey && g.source in catalogFolds ? catalogFolds[g.source]! : fallback;
    }

    catalogFolds = folds;
    catalogHits = { query: key, groups };
    paint();
  }

  function refreshCatalogResults(q: string): void {
    if (!catalog) {
      return;
    }

    catalogError = null;
    catalogGen += 1;
    const gen = catalogGen;

    const key = searchKey(q);
    const sources = enabledWired();
    if (key === '' || sources.length === 0) {
      catalogHits = undefined;
      catalogFolds = {};
      paint();
      return;
    }

    // Hide exactly what Add would refuse — a live food with the same id or
    // identity (name plus brand) — and nothing more: a soft-deleted import
    // stays findable so it can be revived rather than stranded out of both
    // lists.
    const live = state.foods.filter((f) => f.deletedAt === null);
    const liveIds = new Set(live.map((f) => f.id));
    const liveIdentities = new Set(live.map((f) => foodIdentityKey(f)));
    // fuzzyMatch never drops a row the repository matched (its query is the
    // same folded key), so shown + alreadyAdded always account for every hit.
    const groupFor = (source: string, sourced: SourcedFood[]): CatalogGroup => {
      const fresh = sourced.filter((f) => !liveIds.has(f.id) && !liveIdentities.has(foodIdentityKey(f)));
      const shown = fuzzyMatch(fresh, q);
      shown.sort(byRank((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name)));
      return { source, shown, alreadyAdded: sourced.length - fresh.length };
    };

    void catalog.repository.search(q, { sources }).then((hits) => {
      if (gen !== catalogGen) {
        return;
      }

      const bySource = new Map<string, SourcedFood[]>();
      for (const f of hits) {
        const bucket = bySource.get(f.source);
        if (bucket) {
          bucket.push(f);
        } else {
          bySource.set(f.source, [f]);
        }
      }

      applyCatalogHits(key, sources.map((source) => groupFor(source, bySource.get(source) ?? [])));
    }, (e: unknown) => {
      if (gen !== catalogGen) {
        return;
      }

      catalogHits = { query: key, groups: sources.map((source) => ({ source, shown: [], alreadyAdded: 0 })) };
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

        // A source the import turned on may never have been fetched before;
        // guardedHydrate is a no-op for one already current, so this only
        // ever starts the downloads the new state actually needs.
        for (const source of enabledWired()) {
          void guardedHydrate(source);
        }
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
      // applyCatalogHits resets the folds itself once the new key's results
      // land — clearing them here too would win the race against a same-key
      // refresh still in flight and drop a fold the user already opened.
      refreshCatalogResults(q);
    },
    onToggleCatalogFold: (source) => {
      catalogFolds = { ...catalogFolds, [source]: !catalogFolds[source] };
      paint();
    },
    onImportFood: (sourcedId) => {
      const hits = catalogHits;
      if (!catalog || !hits) {
        return;
      }

      const group = hits.groups.find((g) => g.shown.some((r) => r.food.id === sourcedId));
      const hit = group?.shown.find((r) => r.food.id === sourcedId);
      if (!group || !hit) {
        return;
      }

      const food = sourcedToFood(hit.food);

      // Rows the rule would refuse are hidden, but a row rendered before a
      // same-named add lands can still be clicked; name the reason rather
      // than let the reducer's silent refusal read as a serving-unit change.
      if (nameTaken(food, state.foods, food.id)) {
        catalogError = 'You already have this food. Rename or delete the existing one to add it again.';
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
      catalogHits = {
        ...hits,
        groups: hits.groups.map((g) => g.source === group.source
          ? { ...g, shown: g.shown.filter((r) => r.food.id !== food.id), alreadyAdded: g.alreadyAdded + 1 }
          : g),
      };
      paint();
      refreshCatalogResults(catalogQuery);
    },
    onToggleSource: (source, enabled) => {
      setState(reducer(state, { type: 'SetSourceEnabled', source, enabled }));

      if (enabled) {
        void guardedHydrate(source);
      } else {
        // A turned-off source's banner (fetching or failed) no longer
        // describes anything the user can see — it must not outlive the toggle.
        setSourceStatus(source, null);
      }

      refreshCatalogResults(catalogQuery);
    },
    onToggleSourcePicker: () => {
      sourcesExpanded = !sourcesExpanded;
      paint();
    },
    onSourcesFilterChange: (q) => {
      sourcesFilter = q;
      paint();
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

  // The one entry point that starts a source's fetch: every caller (boot, a
  // source ticked on, an import that enables one) goes through the same
  // "not wired", "already fetching", "already in flight" guards — and
  // hydrateSource itself no-ops a source already at its wired version — so
  // none of them can start a second download of the same source.
  function guardedHydrate(source: string): Promise<void> {
    if (!catalog || catalog.versions[source] === undefined) {
      return Promise.resolve();
    }

    if (hydration.sources[source]?.kind === 'fetching') {
      return Promise.resolve();
    }

    if (hydratingSources.has(source)) {
      // An untick clears the banner but does not cancel the fetch already in
      // flight; re-tick must show it again — the fetch's own progress
      // callbacks (or its eventual failure) keep it updated from here.
      setSourceStatus(source, { kind: 'fetching', loaded: 0 });
      return Promise.resolve();
    }

    hydratingSources.add(source);
    return hydrateSource(catalog.repository, catalog.providers, source, catalog.versions[source])
      .finally(() => hydratingSources.delete(source));
  }

  // Re-checks state.enabledSources before each source, not just once at the
  // start, so a source unticked mid-boot — while an earlier one is still
  // downloading — never starts a fetch nobody asked for anymore.
  async function hydrateBoot(): Promise<void> {
    for (const source of catalogSources) {
      if (state.enabledSources.includes(source)) {
        await guardedHydrate(source);
      }
    }
  }

  function paint(): void {
    const today = clock.today();
    render(opts.container, {
      state, today, now: clock.now(), selectedDate, query, selectedFoodId, amount, logUnit, error,
      view, foodForm, foodFormError, importText, importError, exportText, foodsQuery, expandedDetail,
      hydration,
      hasCatalog: catalog !== undefined,
      catalogSources,
      enabledSources: enabledWired(),
      catalogQuery,
      catalogHits,
      catalogError,
      catalogFolds,
      sourcesExpanded,
      sourcesFilter,
    }, handlers);
    // The tab icon answers "how is my day going", so it tracks today rather
    // than the date being browsed.
    favicon?.render(macroShares(dailyTotals(state, today)));
  }

  paint();

  if (catalog) {
    void hydrateBoot();
  }
}
