import { reducer } from './domain/reducer.js';
import { dailyTotals } from './domain/calc.js';
import { macroShares } from './domain/types.js';
import type { Food, Recipe, SourcedFood, State, Unit } from './domain/types.js';
import type { BrandList, BrandListCopy, CatalogManifest } from './domain/dataFiles.js';
import { compatibleUnits } from './domain/units.js';
import { parseLogIntent } from './ui/intents.js';
import { parseDeleteFoodIntent, parseFoodIntent } from './ui/foodIntents.js';
import type { FoodFormInput } from './ui/foodIntents.js';
import { draftForRecipe, parseRecipeIntent, parseRecipeLogIntent } from './ui/recipeIntents.js';
import type { RecipeDraft, RecipeFormInput } from './ui/recipeIntents.js';
import { render, EMPTY_FOOD_FORM } from './ui/view.js';
import { createFavicon } from './ui/favicon.js';
import type { CatalogGroup, CatalogHits, DeletePrompt, ExpandedDetail, FoodFormState, HydrationVm, SourceHydration, ViewHandlers, ViewName } from './ui/view.js';
import { foodLabel } from './ui/foodTitle.js';
import { recipeLogLabel } from './ui/recipeLogLabel.js';
import { searchPicker } from './ui/logPicker.js';
import { EMPTY_RECIPE_FORM } from './ui/recipeEditor.js';
import type { RecipeFormState } from './ui/recipeEditor.js';
import { byRank, fuzzyMatch, type FoodMatch } from './ui/search.js';
import { isValidIsoDate, shiftDate } from './domain/date.js';
import { backupFileName, exportState, parseImport } from './ui/importExport.js';
import { CATALOG_TIERS, brandDirectory, brandIdOf, expandStores, isStore, sourceTier } from './domain/foodSources.js';
import { sharedLoad } from './domain/sharedLoad.js';
import { isBrandListCopy, isCatalogManifest } from './domain/validate.js';
import { foodIdentityKey, nameTaken } from './domain/foodNames.js';
import type { BrandListVm } from './ui/sourcePicker.js';
import { searchKey } from './domain/searchKey.js';
import { DEFAULT_TREND_RANGE } from './domain/trends.js';
import type { TrendRangeKey } from './domain/trends.js';
import type { StateRepository } from './persistence/repository.js';
import type { FoodSourceRepository } from './persistence/foodSourceRepository.js';
import type { BrandProviders, BrandsProvider, FoodSourceProvider } from './persistence/foodSourceProvider.js';

// Where the catalog cache keeps its copies of the manifest and the brand
// list between boots.
const MANIFEST_KEY = 'catalog-manifest';
const BRAND_LIST_KEY = 'brand-list';

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
  fetchManifest: () => Promise<CatalogManifest>;
  // The static sources, in picker and fold order.
  providers: FoodSourceProvider[];
  brands: BrandsProvider;
};

export type AppOptions = {
  container: HTMLElement;
  favicon?: HTMLLinkElement | undefined;
  repo: StateRepository;
  clock?: Clock;
  copyToClipboard?: (text: string) => Promise<void> | void;
  saveFile?: (name: string, text: string) => void;
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

function downloadJson(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;

  // Some browsers ignore a download click on an anchor outside the document.
  document.body.append(link);
  link.click();
  link.remove();

  // Revoking in the same task can cancel the download the click just started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function recipeFormFromRecipe(recipe: Recipe): RecipeFormState {
  return {
    mode: 'edit',
    recipeId: recipe.id,
    name: recipe.name,
    items: recipe.items.map((i) => ({ foodId: i.foodId, amount: String(i.amount), unit: i.unit })),
    foodQuery: '',
  };
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Network first, so a new build is seen as soon as it deploys; the copy kept
// in the catalog cache is what an offline boot falls back to. Copy writes
// are not awaited: a cache that refuses one costs a later boot, not this
// session.
async function fetchManifest(wiring: CatalogWiring): Promise<CatalogManifest> {
  try {
    const manifest = await wiring.fetchManifest();
    void wiring.repository.setMeta(MANIFEST_KEY, manifest).catch(() => {});
    return manifest;
  } catch (e) {
    const copy = await wiring.repository.getMeta(MANIFEST_KEY).catch(() => undefined);
    if (isCatalogManifest(copy)) {
      return copy;
    }

    throw e;
  }
}

// Copy first: the list names no build, so its copy carries the version it
// came from, and one at the manifest's build is that build's list.
async function fetchBrandList(wiring: CatalogWiring, version: string): Promise<BrandList> {
  const copy = await wiring.repository.getMeta(BRAND_LIST_KEY).catch(() => undefined);
  if (isBrandListCopy(copy) && copy.version === version) {
    return copy.list;
  }

  const list = await wiring.brands.fetchList(version);
  const fresh: BrandListCopy = { version, list };
  void wiring.repository.setMeta(BRAND_LIST_KEY, fresh).catch(() => {});
  return list;
}

export function createApp(opts: AppOptions): void {
  const clock = opts.clock ?? defaultClock;
  const copy = opts.copyToClipboard ?? ((t) => navigator.clipboard?.writeText(t));
  const saveFile = opts.saveFile ?? downloadJson;
  const favicon = opts.favicon ? createFavicon(opts.favicon) : null;

  let state: State = opts.repo.load();
  let selectedDate = clock.today();
  let query = '';
  let selectedFoodId: string | null = null;
  let amount = '';
  let logUnit: Unit = 'g';
  let error: string | null = null;
  let lastLoggedEntryId: string | null = null;
  let view: ViewName = 'log';
  let foodForm: FoodFormState = { ...EMPTY_FOOD_FORM };
  let foodFormError: string | null = null;
  let importText = '';
  let importError: string | null = null;
  let exportText = '';
  let foodsQuery = '';
  let foodsError: string | null = null;
  let recipesQuery = '';
  let recipeForm: RecipeFormState = { ...EMPTY_RECIPE_FORM };
  let recipeFormError: string | null = null;
  let recipeDraft: RecipeDraft | null = null;
  let expandedDetail: ExpandedDetail | null = null;
  // The delete the dialog is asking about, carrying the work it would do.
  let pendingDelete: (DeletePrompt & { run: () => void }) | null = null;
  let hydration: HydrationVm = { sources: {} };
  let catalogQuery = '';
  let catalogHits: CatalogHits | undefined;
  let catalogFolds: Record<string, boolean> = {};
  let catalogError: string | null = null;
  let catalogGen = 0;
  let sourcesExpanded = false;
  let sourcesFilter = '';
  const hydratingSources = new Set<string>();
  let brandList: BrandListVm = { kind: 'idle' };
  let trendRange: TrendRangeKey = DEFAULT_TREND_RANGE;
  let trendSelected: string | null = null;

  const { catalog } = opts;
  // The picker and every catalog result group follow wired order.
  const catalogSources = catalog?.providers.map((p) => p.name) ?? [];

  // What is on, split once: the static sources in wired order, and the
  // stores and brands as the enabled list names them.
  function enabledSplit(): { statics: string[]; brandPicks: string[] } {
    return {
      statics: catalogSources.filter((s) => state.enabledSources.includes(s)),
      brandPicks: state.enabledSources.filter((s) => isStore(s) || brandIdOf(s) !== null),
    };
  }

  // What the picker shows as on.
  function enabledPicks(): string[] {
    const { statics, brandPicks } = enabledSplit();
    return [...statics, ...brandPicks];
  }

  // The concrete sources search and hydration work on: the static sources,
  // then every brand that is on — by itself or through its store — once, in
  // id order.
  function enabledWired(): string[] {
    const { statics, brandPicks } = enabledSplit();
    return [...statics, ...expandStores(brandPicks).sort()];
  }

  // The build every source is expected at, fetched once per session; a
  // failed load is forgotten, so the next need tries again. Only a wired
  // catalog asks for it.
  const manifest = sharedLoad(() => {
    if (catalog === undefined) {
      return Promise.reject(new Error('No food catalog wired'));
    }

    return fetchManifest(catalog);
  });

  // Only the picker reads the brand list — a brand that is on hydrates and
  // is named without it — so it loads when the picker opens, and a session
  // that never opens it never pays for it. Its state is its memo: a load in
  // flight or done is not started again; a failed one is, on the next open
  // or filter keystroke.
  function showBrandList(wiring: CatalogWiring): void {
    if (brandList.kind === 'loading' || brandList.kind === 'ready') {
      return;
    }

    brandList = { kind: 'loading' };
    manifest.get().then(({ version }) => fetchBrandList(wiring, version)).then((list) => {
      brandList = { kind: 'ready', brands: brandDirectory(list) };
      paint();
    }, (e: unknown) => {
      brandList = { kind: 'failed', message: errorMessage(e) };
      paint();
    });
  }

  // Undefined for a static source this wiring did not wire.
  function providerFor(wiring: CatalogWiring, source: string, brands: BrandProviders): FoodSourceProvider | undefined {
    const id = brandIdOf(source);
    return id === null ? wiring.providers.find((p) => p.name === source) : brands(id);
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
    lastLoggedEntryId = null;
    paint();
  }

  function resetTransient(): void {
    selectedFoodId = null;
    amount = '';
    logUnit = 'g';
    error = null;
    lastLoggedEntryId = null;
    query = '';
    foodsQuery = '';
    foodsError = null;
    recipesQuery = '';
    recipeFormError = null;
    recipeDraft = null;
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
    trendRange = DEFAULT_TREND_RANGE;
    trendSelected = null;
  }

  // The one definition of "form back to empty" — the recipe form's fields
  // otherwise survive a tab switch (the natural flow is to notice a food is
  // missing, add it on another tab, and come back), so only these call sites
  // clear them. The error is transient view state rather than user input, so
  // resetTransient clears it independently on every tab switch — a Save
  // refusal shouldn't keep pointing at a form the user has since fixed
  // elsewhere.
  function resetRecipeForm(): void {
    recipeForm = { ...EMPTY_RECIPE_FORM };
    recipeFormError = null;
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

  function applyImport(raw: string): void {
    const r = parseImport(raw, clock.newId);
    if (r.kind === 'error') {
      importError = r.message;
    } else {
      setState(reducer(state, { type: 'ReplaceState', state: r.state }));
      resetTransient();
      resetRecipeForm();

      // A source the import turned on may never have been fetched before;
      // hydrating one already current is a no-op, so this only ever starts
      // the downloads the new state actually needs.
      void hydrateTogether((hydrate) => Promise.all(enabledWired().map(hydrate)));
    }

    paint();
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
      ...(sf.brand === undefined ? {} : { brand: sf.brand }),
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
      lastLoggedEntryId = result.action.entry.id;
      amount = '';
      error = null;
      paint();
    },
    onDelete: (entryId) => {
      const entry = state.entries.find((e) => e.id === entryId);
      const food = entry && state.foods.find((f) => f.id === entry.foodId);
      if (!entry || !food) {
        return;
      }

      pendingDelete = {
        kind: 'entry',
        id: entryId,
        message: `Delete ${food.name}, ${entry.amount} ${entry.unit} from this day?`,
        run: () => {
          setState(reducer(state, { type: 'DeleteEntry', entryId }));
          if (expandedDetail?.kind === 'entry' && expandedDetail.id === entryId) {
            expandedDetail = null;
          }

          error = null;
        },
      };
      paint();
    },
    // The log row acts on the selection, but the picker shows only what the
    // query matches, so a selection ends the moment its row leaves the list;
    // Log it can never act on a food or recipe card the user cannot see.
    onQueryChange: (q) => {
      query = q;
      const shown = searchPicker(state, q, clock.now()).map((m) => m.food);
      const draft = recipeDraft;
      if (draft && !shown.some((i) => i.kind === 'recipe' && i.id === draft.recipeId)) {
        recipeDraft = null;
      }

      if (selectedFoodId !== null && !shown.some((i) => i.kind === 'food' && i.id === selectedFoodId)) {
        selectedFoodId = null;
        expandedDetail = null;
      }

      paint();
    },
    onFoodSelect: (id) => {
      selectedFoodId = id;
      recipeDraft = null;
      const food = state.foods.find((f) => f.id === id && f.deletedAt === null);

      if (food) {
        logUnit = compatibleUnits(food)[0] ?? 'g';
      }

      expandedDetail = { kind: 'food', id };
      error = null;
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
      const result = parseFoodIntent(input, state, clock);
      if (result.kind === 'error') {
        foodFormError = result.message;
      } else {
        setState(reducer(state, result.action));
        foodForm = { ...EMPTY_FOOD_FORM };
        foodFormError = null;
        foodsError = null;
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
      foodsError = null;
      paint();
    },
    onSoftDeleteFood: (foodId) => {
      const food = state.foods.find((f) => f.id === foodId && f.deletedAt === null);
      if (!food) {
        return;
      }

      const result = parseDeleteFoodIntent(foodId, state, clock);
      if (result.kind === 'error') {
        foodsError = result.message;
        paint();
        return;
      }

      foodsError = null;
      pendingDelete = {
        kind: 'food',
        id: foodId,
        message: `Remove ${foodLabel(food)} from your foods? Entries that already use it are kept.`,
        run: () => {
          setState(reducer(state, result.action));
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
        },
      };
      paint();
    },
    onConfirmDelete: () => {
      const pending = pendingDelete;
      if (!pending) {
        return;
      }

      pendingDelete = null;
      pending.run();
      paint();
    },
    onCancelDelete: () => {
      pendingDelete = null;
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
    onImport: () => applyImport(importText),
    onImportTextChange: (t) => { importText = t; paint(); },
    onDownloadBackup: () => saveFile(backupFileName(clock.today()), exportState(state)),
    onUploadBackup: (file) => {
      void file.text().then(applyImport, (e) => {
        importError = `Couldn't read that file (${errorMessage(e)}).`;
        paint();
      });
    },
    onFoodsQueryChange: (q) => { foodsQuery = q; foodsError = null; paint(); },
    onRecipesQueryChange: (q) => { recipesQuery = q; paint(); },
    onRecipeFormNameChange: (name) => { recipeForm = { ...recipeForm, name }; paint(); },
    onRecipeFormFoodQueryChange: (q) => { recipeForm = { ...recipeForm, foodQuery: q }; paint(); },
    onRecipeFormAddItem: (foodId) => {
      const food = state.foods.find((f) => f.id === foodId && f.deletedAt === null);
      if (!food || recipeForm.items.some((i) => i.foodId === foodId)) {
        return;
      }

      recipeForm = {
        ...recipeForm,
        items: [...recipeForm.items, { foodId, amount: String(food.servingSize), unit: food.servingUnit }],
        foodQuery: '',
      };
      paint();
    },
    onRecipeFormItemAmountChange: (foodId, amount) => {
      recipeForm = {
        ...recipeForm,
        items: recipeForm.items.map((i) => i.foodId === foodId ? { ...i, amount } : i),
      };
      paint();
    },
    onRecipeFormItemUnitChange: (foodId, unit) => {
      recipeForm = {
        ...recipeForm,
        items: recipeForm.items.map((i) => i.foodId === foodId ? { ...i, unit } : i),
      };
      paint();
    },
    onRecipeFormRemoveItem: (foodId) => {
      recipeForm = { ...recipeForm, items: recipeForm.items.filter((i) => i.foodId !== foodId) };
      paint();
    },
    onRecipeFormSubmit: () => {
      const { mode, recipeId, foodQuery: _foodQuery, ...fields } = recipeForm;
      const input: RecipeFormInput = mode === 'edit' && recipeId !== null
        ? { mode, recipeId, ...fields }
        : { mode: 'add', ...fields };
      const result = parseRecipeIntent(input, state, clock);
      if (result.kind === 'error') {
        recipeFormError = result.message;
      } else {
        setState(reducer(state, result.action));
        resetRecipeForm();
      }

      paint();
    },
    onRecipeFormCancel: () => {
      resetRecipeForm();
      paint();
    },
    onEditRecipe: (recipeId) => {
      const recipe = state.recipes.find((r) => r.id === recipeId && r.deletedAt === null);
      if (!recipe) {
        return;
      }

      recipeForm = recipeFormFromRecipe(recipe);
      recipeFormError = null;
      paint();
    },
    onSoftDeleteRecipe: (recipeId) => {
      const recipe = state.recipes.find((r) => r.id === recipeId && r.deletedAt === null);
      if (!recipe) {
        return;
      }

      pendingDelete = {
        kind: 'recipe',
        id: recipeId,
        message: `Remove ${recipe.name} from your recipes? Days that already logged it are kept.`,
        run: () => {
          setState(reducer(state, { type: 'SoftDeleteRecipe', recipeId, deletedAt: clock.now().toISOString() }));
          if (recipeForm.mode === 'edit' && recipeForm.recipeId === recipeId) {
            resetRecipeForm();
          }

          if (recipeDraft?.recipeId === recipeId) {
            recipeDraft = null;
          }
        },
      };
      paint();
    },
    onRecipeSelect: (recipeId) => {
      const recipe = state.recipes.find((r) => r.id === recipeId && r.deletedAt === null);
      if (!recipe) {
        return;
      }

      selectedFoodId = null;
      recipeDraft = draftForRecipe(recipe);
      expandedDetail = null;
      error = null;
      paint();
    },
    onRecipeDeselect: () => {
      recipeDraft = null;
      error = null;
      paint();
    },
    onRecipeDraftAmountChange: (foodId, amount) => {
      if (!recipeDraft) {
        return;
      }

      recipeDraft = { ...recipeDraft, amounts: { ...recipeDraft.amounts, [foodId]: amount } };
      paint();
    },
    onServingsChange: (value) => {
      if (!recipeDraft) {
        return;
      }

      recipeDraft = { ...recipeDraft, servings: value };
      paint();
    },
    onLogRecipe: () => {
      if (!recipeDraft) {
        error = 'Pick a food.';
        paint();
        return;
      }

      const result = parseRecipeLogIntent(recipeDraft, selectedDate, state, clock);
      if (result.kind === 'error') {
        error = result.message;
        paint();
        return;
      }

      const recipeId = recipeDraft.recipeId;
      setState(reducer(state, result.action));

      const recipe = state.recipes.find((r) => r.id === recipeId);
      // Blanking servings mirrors the food path clearing its amount: the card
      // keeps its portions, but a second click on Log it asks for servings
      // rather than silently logging the same batch again.
      recipeDraft = recipe ? { ...draftForRecipe(recipe), servings: '' } : null;
      error = null;
      paint();
    },
    onDeleteRecipeLog: (recipeLogId) => {
      const groupEntryIds = new Set(state.entries.filter((e) => e.recipeLogId === recipeLogId).map((e) => e.id));
      if (groupEntryIds.size === 0) {
        return;
      }

      const n = groupEntryIds.size;
      pendingDelete = {
        kind: 'recipeLog',
        id: recipeLogId,
        message: `Delete ${recipeLogLabel(state, recipeLogId)} and its ${n} item${n === 1 ? '' : 's'} from this day?`,
        run: () => {
          setState(reducer(state, { type: 'DeleteRecipeLog', recipeLogId }));
          if (expandedDetail?.kind === 'entry' && groupEntryIds.has(expandedDetail.id)) {
            expandedDetail = null;
          }

          error = null;
        },
      };
      paint();
    },
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
        void hydrateTogether((hydrate) => Promise.all(expandStores([source]).map(hydrate)));
      }

      paint();
      refreshCatalogResults(catalogQuery);
    },
    onToggleSourcePicker: () => {
      sourcesExpanded = !sourcesExpanded;

      if (sourcesExpanded && catalog) {
        showBrandList(catalog);
      }

      paint();
    },
    onSourcesFilterChange: (q) => {
      sourcesFilter = q;

      if (sourcesExpanded && catalog) {
        showBrandList(catalog);
      }

      paint();
    },
    onTrendRangeChange: (range) => {
      trendRange = range;
      trendSelected = null;
      paint();
    },
    onTrendSelect: (start) => {
      trendSelected = start;
      paint();
    },
  };

  function setSourceStatus(source: string, status: SourceHydration | null): void {
    const { [source]: _previous, ...rest } = hydration.sources;
    hydration = { sources: status === null ? rest : { ...hydration.sources, [source]: status } };
    paint();
  }

  // Every failure, including the repository refusing to open or no manifest
  // to be had, must land in `failed`: a source left on `fetching` would show
  // the banner forever.
  async function hydrateSource(wiring: CatalogWiring, source: string, provider: FoodSourceProvider): Promise<void> {
    let current: string | null = null;
    try {
      current = await wiring.repository.currentVersion(source);
      const { version } = await manifest.get();
      if (current === version) {
        setSourceStatus(source, null);
        return;
      }

      setSourceStatus(source, { kind: 'fetching', loaded: 0 });

      let shownKb = 0;
      const items = await provider.fetchRows(version, (loaded) => {
        const kb = Math.round(loaded / 1024);
        if (kb !== shownKb) {
          shownKb = kb;
          setSourceStatus(source, { kind: 'fetching', loaded });
        }
      });
      await wiring.repository.hydrate(source, items, version);
      setSourceStatus(source, null);
    } catch (e) {
      setSourceStatus(source, { kind: 'failed', cachedVersion: current, message: errorMessage(e) });
    }
  }

  // Every source's fetch goes through the same "not wired", "already in
  // flight" guards — and hydrateSource itself no-ops a source already at the
  // manifest's build — so no caller can start a second download of the same
  // source.
  function guardedHydrate(wiring: CatalogWiring, source: string, brands: BrandProviders): Promise<void> {
    const provider = providerFor(wiring, source, brands);
    if (!provider || hydratingSources.has(source)) {
      return Promise.resolve();
    }

    hydratingSources.add(source);
    return hydrateSource(wiring, source, provider).finally(() => {
      hydratingSources.delete(source);

      // A search typed while sources were downloading silently missed their
      // rows. One re-run when the last download settles: a store tick lands
      // a dozen brands at once, and each would otherwise search again.
      if (hydratingSources.size === 0 && catalogQuery.trim() !== '') {
        refreshCatalogResults(catalogQuery);
      }
    });
  }

  // The one entry point that starts downloads. Boot, a pick and an import
  // each hydrate as one brands batch, so their brands that share a letter
  // file download and parse it once, and it is let go once they have all
  // settled.
  function hydrateTogether(run: (hydrate: (source: string) => Promise<void>) => Promise<unknown>): Promise<void> {
    if (catalog === undefined) {
      return Promise.resolve();
    }

    return catalog.brands.batch(async (brands) => {
      await run((source) => guardedHydrate(catalog, source, brands));
    });
  }

  // Re-checks what is on before each source, not just once at the start, so
  // a source unticked mid-boot — while an earlier one is still downloading —
  // never starts a fetch nobody asked for anymore.
  function hydrateBoot(): Promise<void> {
    return hydrateTogether(async (hydrate) => {
      for (const source of enabledWired()) {
        if (enabledWired().includes(source)) {
          await hydrate(source);
        }
      }
    });
  }

  function paint(): void {
    const today = clock.today();
    render(opts.container, {
      state, today, now: clock.now(), selectedDate, query, selectedFoodId, amount, logUnit, error, lastLoggedEntryId,
      view, foodForm, foodFormError, importText, importError, exportText, foodsQuery, foodsError, expandedDetail,
      recipesQuery, recipeForm, recipeFormError, recipeDraft,
      pendingDelete,
      hydration,
      hasCatalog: catalog !== undefined,
      catalogSources,
      enabledSources: enabledPicks(),
      catalogQuery,
      catalogHits,
      catalogError,
      catalogFolds,
      sourcesExpanded,
      sourcesFilter,
      brandList,
      trendRange,
      trendSelected,
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
