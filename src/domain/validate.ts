import { NUTRIENT_KEYS } from './types.js';
import type { Entry, Food, Meal, NutritionFacts, Pieces, Portion, Recipe, RecipeLog, SourcedFood, State, Unit } from './types.js';
import { BRAND_ROW_LENGTH, isBrandServingUnit, type BrandFileEntry, type BrandList, type BrandListCopy, type BrandListEntry, type BrandRow, type CatalogManifest } from './dataFiles.js';
import { isUnit } from './units.js';
import { foodIdentityKey } from './foodNames.js';
import { STORE_BUNDLES, defaultEnabledSources, houseBrandsAsStores } from './foodSources.js';
import { referencedRecipeLogs } from './recipes.js';

export function isNonNegFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function isPosFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0;
}

function asRecord(x: unknown): Record<string, unknown> | null {
  return typeof x === 'object' && x !== null ? x as Record<string, unknown> : null;
}

function isNutritionFacts(x: unknown): x is NutritionFacts {
  const n = asRecord(x);
  return n !== null && NUTRIENT_KEYS.every((k) => isNonNegFinite(n[k]));
}

function isCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

function hasFoodCore(f: Record<string, unknown>): boolean {
  return isNonEmptyString(f.id)
    && isNonEmptyString(f.name)
    && (f.brand === undefined || isNonEmptyString(f.brand))
    && isNutritionFacts(f.nutritionFacts)
    && isPosFinite(f.servingSize)
    && isUnit(f.servingUnit);
}

function isPieces(x: unknown): x is Pieces {
  const p = asRecord(x);
  return p !== null
    && isPosFinite(p.perServing)
    && (p.noun === undefined || isNonEmptyString(p.noun));
}

// Shared with the reducer, which validates a merged food the same way: a
// counted food has no separate piece size to record, so pieces is only
// meaningful off the count axis.
export function hasValidPieces(f: { servingUnit?: unknown; pieces?: unknown }): boolean {
  return f.pieces === undefined || (f.servingUnit !== 'count' && isPieces(f.pieces));
}

export function isSourcedFood(x: unknown): x is SourcedFood {
  const f = asRecord(x);
  return f !== null
    && hasFoodCore(f)
    && isNonEmptyString(f.source)
    && isNonEmptyString(f.sourceId)
    && (f.tags === undefined || (Array.isArray(f.tags) && f.tags.every((t) => typeof t === 'string')))
    && hasValidPieces(f);
}

export function isCatalogManifest(x: unknown): x is CatalogManifest {
  const m = asRecord(x);
  return m !== null && isNonEmptyString(m.version);
}

function isBrandListEntry(x: unknown): x is BrandListEntry {
  return Array.isArray(x)
    && x.length === 4
    && isNonEmptyString(x[0])
    && isNonEmptyString(x[1])
    && isCount(x[2])
    && typeof x[3] === 'boolean';
}

export function isBrandList(x: unknown): x is BrandList {
  const l = asRecord(x);
  return l !== null && Array.isArray(l.brands) && l.brands.every(isBrandListEntry);
}

export function isBrandListCopy(x: unknown): x is BrandListCopy {
  const c = asRecord(x);
  return c !== null && isNonEmptyString(c.version) && isBrandList(c.list);
}

function isBrandRow(x: unknown): x is BrandRow {
  if (!Array.isArray(x) || x.length !== BRAND_ROW_LENGTH) {
    return false;
  }

  const [fdcId, name, category, servingSize, servingUnit, piecesPerServing, pieceNoun, ...nutrition] = x;

  return isPosFinite(fdcId) && Number.isInteger(fdcId)
    && isNonEmptyString(name)
    && typeof category === 'string'
    && isPosFinite(servingSize)
    && isBrandServingUnit(servingUnit)
    && isNonNegFinite(piecesPerServing)
    && typeof pieceNoun === 'string'
    && (piecesPerServing > 0) === (pieceNoun !== '')
    && nutrition.every(isNonNegFinite);
}

// Only the top level: a brand's entry is checked as that brand is read, so
// reading one never validates the thousands filed beside it.
export function isBrandFileObject(x: unknown): x is Record<string, unknown> {
  return asRecord(x) !== null && !Array.isArray(x);
}

export function isBrandFileEntry(x: unknown): x is BrandFileEntry {
  const e = asRecord(x);
  return e !== null && isNonEmptyString(e.label) && Array.isArray(e.rows) && e.rows.every(isBrandRow);
}

// Everything a stored Food requires except that its pieces (if any) are
// trustworthy — see withKnownPieces below for why that is checked, and
// fixed up, separately.
type FoodCore = Omit<Food, 'pieces'> & { pieces?: unknown };

function isFoodCore(x: unknown): x is FoodCore {
  const f = asRecord(x);
  return f !== null
    && hasFoodCore(f)
    && isNonEmptyString(f.createdAt)
    && (f.deletedAt === null || isNonEmptyString(f.deletedAt))
    && (f.source === undefined || isNonEmptyString(f.source));
}

// A build that doesn't know `pieces` carries the field through an edit
// verbatim, including a switch to servingUnit 'count'. Loading it without
// them (rather than rejecting the whole food) is the same drop-the-unusable-
// part rule as an entry or portion in an unrecognized unit, just for one
// field instead of one row.
function withKnownPieces(core: FoodCore): Food {
  if (hasValidPieces(core)) {
    return core as Food;
  }

  const { pieces: _dropped, ...rest } = core;
  return rest as Food;
}

function parseFoodsCore(x: unknown): Food[] | null {
  if (!Array.isArray(x) || !x.every(isFoodCore)) {
    return null;
  }

  return x.map(withKnownPieces);
}

function isMeal(x: unknown): x is Meal {
  const m = asRecord(x);
  return m !== null
    && isNonEmptyString(m.id)
    && isNonEmptyString(m.date)
    && typeof m.position === 'number' && Number.isInteger(m.position) && m.position >= 0;
}

// Everything a shape with a `unit` field requires except that the unit is
// one this build knows — the live site and PR previews share one
// localStorage blob, so a build can meet a unit a different build wrote.
// Checked separately from isUnit so the item can be dropped on load instead
// of invalidating the whole blob.
type AnyUnit<T> = Omit<T, 'unit'> & { unit: string };

function withKnownUnits<T extends { unit: string }>(items: T[]): Array<T & { unit: Unit }> {
  return items.filter((i): i is T & { unit: Unit } => isUnit(i.unit));
}

type EntryCore = AnyUnit<Entry>;

function isEntryCore(x: unknown): x is EntryCore {
  const e = asRecord(x);
  return e !== null
    && isNonEmptyString(e.id)
    && isNonEmptyString(e.date)
    && isNonEmptyString(e.foodId)
    && isPosFinite(e.amount)
    && isNonEmptyString(e.unit)
    && isNonEmptyString(e.mealId)
    && isNonEmptyString(e.loggedAt);
}

// A food added from a store pack before rows carried their brand has only
// the pack's name in `source`. Stamping the store's label as its brand keeps
// the identity and the tag it had, so the blob loads exactly as it did.
function stampLegacyBrands(foods: Food[]): Food[] {
  return foods.map((food) => {
    if (food.brand !== undefined || food.source === undefined) {
      return food;
    }

    const bundle = STORE_BUNDLES.get(food.source);
    return bundle === undefined ? food : { ...food, brand: bundle.label };
  });
}

// Restores the unique-live-identity rule on the way in: a blob written
// before the rule, or a pasted backup, may hold two live "Apple"s or
// "Omelette"s, which would lock both out of editing. Later duplicates get a
// numbered suffix; nothing is dropped. Identity includes brand, so a
// Kirkland Signature and a Great Value "Almonds" are left alone; a recipe
// carries no brand.
function renameDuplicateLiveNames<T extends { name: string; deletedAt: string | null; brand?: string }>(items: T[]): T[] {
  const taken = new Set<string>();

  return items.map((item) => {
    if (item.deletedAt !== null) {
      return item;
    }

    const identityFor = (name: string): string =>
      foodIdentityKey(item.brand === undefined ? { name } : { name, brand: item.brand });

    let name = item.name;
    for (let n = 2; taken.has(identityFor(name)); n++) {
      name = `${item.name} (${n})`;
    }

    taken.add(identityFor(name));
    return name === item.name ? item : { ...item, name };
  });
}

function entriesReferenceRealMeals(entries: Entry[], meals: Meal[]): boolean {
  const mealById = new Map(meals.map((m) => [m.id, m]));
  return entries.every((e) => mealById.get(e.mealId)?.date === e.date);
}

// The food only has to exist, not be live: a pasted backup may hold a recipe
// whose food was deleted since, and the reducer owns that invariant.
type PortionCore = AnyUnit<Portion>;

function isPortionCore(x: unknown, foodIds: Set<string>): x is PortionCore {
  const i = asRecord(x);
  return i !== null
    && isNonEmptyString(i.foodId)
    && foodIds.has(i.foodId)
    && isPosFinite(i.amount)
    && isNonEmptyString(i.unit);
}

function noDuplicateFoodIds(items: { foodId: string }[]): boolean {
  const ids = new Set(items.map((i) => i.foodId));
  return ids.size === items.length;
}

type RecipeCore = Omit<Recipe, 'items'> & { items: PortionCore[] };

function isRecipeCore(x: unknown, foodIds: Set<string>): x is RecipeCore {
  const r = asRecord(x);
  return r !== null
    && isNonEmptyString(r.id)
    && isNonEmptyString(r.name)
    && isNonEmptyString(r.createdAt)
    && (r.deletedAt === null || isNonEmptyString(r.deletedAt))
    && Array.isArray(r.items)
    && r.items.length > 0
    && r.items.every((i) => isPortionCore(i, foodIds))
    && noDuplicateFoodIds(r.items);
}

// Drops just the portions in a unit this build doesn't know, and any recipe
// left with none — rejecting the whole blob over it would cost the user
// their foods and entries too, not just the one recipe.
function dropUnknownUnitPortions(recipes: RecipeCore[]): Recipe[] {
  const kept: Recipe[] = [];

  for (const r of recipes) {
    const items = withKnownUnits(r.items);
    if (items.length > 0) {
      kept.push({ ...r, items });
    }
  }

  return kept;
}

function isRecipeLog(x: unknown): x is RecipeLog {
  const rl = asRecord(x);
  return rl !== null
    && isNonEmptyString(rl.id)
    && isNonEmptyString(rl.recipeId)
    && isPosFinite(rl.servings);
}

// `x` absent means the blob predates the field (or a build without it
// re-saved the blob verbatim): defaults to []. Present, it must be an array
// where every element passes `guard`, or the whole blob is malformed.
function optionalArray<T>(x: unknown, guard: (v: unknown) => v is T): T[] | null {
  if (x === undefined) {
    return [];
  }

  if (!Array.isArray(x) || !x.every(guard)) {
    return null;
  }

  return x;
}

type RecipesBody = { recipes: Recipe[]; recipeLogs: RecipeLog[]; lossy: boolean };

function parseRecipesBody(s: Record<string, unknown>, foods: Food[]): RecipesBody | null {
  const foodIds = new Set(foods.map((f) => f.id));
  const recipesCore = optionalArray(s.recipes, (r): r is RecipeCore => isRecipeCore(r, foodIds));
  if (recipesCore === null) {
    return null;
  }

  const recipes = dropUnknownUnitPortions(recipesCore);

  // A whole recipe dropped (its every item in an unknown unit) is just the
  // limit case of losing some of its items, so one item-count comparison
  // catches both.
  const originalItems = recipesCore.reduce((sum, r) => sum + r.items.length, 0);
  const keptItems = recipes.reduce((sum, r) => sum + r.items.length, 0);
  const lossy = keptItems !== originalItems;

  const shapedRecipeLogs = optionalArray(s.recipeLogs, isRecipeLog);
  if (shapedRecipeLogs === null) {
    return null;
  }

  // A shape-valid recipeLog naming no recipe is dropped rather than
  // rejecting the whole blob — the same reasoning as sanitizeRecipeLogIds
  // below: its entries lose the recipeLogId through that step and load
  // ungrouped instead of the user losing foods and entries too.
  const recipeIds = new Set(recipes.map((r) => r.id));
  const recipeLogs = shapedRecipeLogs.filter((rl) => recipeIds.has(rl.recipeId));

  return { recipes, recipeLogs, lossy };
}

// The live site and PR previews share one localStorage blob. A build without
// recipes re-saves it from only the foods/meals/entries it knows about,
// dropping `recipes` and `recipeLogs` — one visit to the live site loses the
// recipe library, and an entry's `recipeLogId` (an extra field riding along
// on it) now dangles. Rejecting the blob over that would wipe the user's
// foods and entries too, so the field is simply dropped and the entry loads
// ungrouped.
function sanitizeRecipeLogIds(entries: Entry[], recipeLogIds: Set<string>): Entry[] {
  return entries.map((e) => {
    if (e.recipeLogId === undefined || recipeLogIds.has(e.recipeLogId)) {
      return e;
    }

    const { recipeLogId: _dangling, ...rest } = e;
    return rest;
  });
}

type StateBody = { foods: Food[]; meals: Meal[]; entries: Entry[]; lossy: boolean };

// v1 predates every unit but g/oz/lb/count, so its entries are checked
// strictly.
function migrateV1(s: Record<string, unknown>, makeId: () => string): StateBody | null {
  const foods = parseFoodsCore(s.foods);
  if (foods === null) {
    return null;
  }

  const v1Entries = s.entries;
  if (!Array.isArray(v1Entries)) {
    return null;
  }

  const isV1Entry = (e: unknown): e is Omit<Entry, 'mealId'> => {
    const r = asRecord(e);
    return r !== null
      && isNonEmptyString(r.id)
      && isNonEmptyString(r.date)
      && isNonEmptyString(r.foodId)
      && isPosFinite(r.amount)
      && isUnit(r.unit)
      && isNonEmptyString(r.loggedAt);
  };

  if (!v1Entries.every(isV1Entry)) {
    return null;
  }

  const mealByDate = new Map<string, Meal>();
  for (const e of v1Entries) {
    if (!mealByDate.has(e.date)) {
      mealByDate.set(e.date, { id: makeId(), date: e.date, position: 0 });
    }
  }

  const meals = Array.from(mealByDate.values());
  const entries: Entry[] = v1Entries.map((e) => ({
    id: e.id, date: e.date, foodId: e.foodId,
    amount: e.amount, unit: e.unit, loggedAt: e.loggedAt,
    mealId: mealByDate.get(e.date)!.id,
  }));

  return {
    foods: renameDuplicateLiveNames(stampLegacyBrands(foods)),
    meals, entries,
    lossy: false,
  };
}

function parseStateBody(s: Record<string, unknown>): StateBody | null {
  const foods = parseFoodsCore(s.foods);
  if (foods === null) {
    return null;
  }

  if (!Array.isArray(s.meals) || !s.meals.every(isMeal)) {
    return null;
  }

  if (!Array.isArray(s.entries) || !s.entries.every(isEntryCore)) {
    return null;
  }

  const rawEntries = s.entries;
  const entries = withKnownUnits(rawEntries);

  if (!entriesReferenceRealMeals(entries, s.meals)) {
    return null;
  }

  return {
    foods: renameDuplicateLiveNames(stampLegacyBrands(foods)),
    meals: s.meals, entries,
    lossy: entries.length !== rawEntries.length,
  };
}

// A blob written before the field existed (any v1, or a v2 without it)
// gets the defaults. An explicit list is honoured even when empty — the
// user may have turned everything off; only a malformed value is rejected.
// Unknown names (the registry may shrink) are kept and simply ignored
// wherever sources are consumed; a house brand on by itself becomes its
// store.
function enabledSourcesFor(s: Record<string, unknown>, version: 1 | 2): string[] | null {
  if (version === 1 || s.enabledSources === undefined) {
    return defaultEnabledSources();
  }

  const listed = s.enabledSources;
  if (!Array.isArray(listed) || !listed.every(isNonEmptyString)) {
    return null;
  }

  return houseBrandsAsStores(listed);
}

// `lossy` is true only when an entry, a recipe item or a recipe had to be
// dropped to load the blob — not when a food's unusable pieces were, since
// nothing the user tracks is lost there. Import uses it to refuse a lossy
// backup instead of silently losing rows.
export type ParsedState = { state: State; lossy: boolean };

export function parseStateReport(raw: string | null, makeId: () => string): ParsedState | null {
  if (raw === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const s = asRecord(parsed);
  if (s === null) {
    return null;
  }

  const version = s.version;
  if (version !== 1 && version !== 2) {
    return null;
  }

  const body = version === 1 ? migrateV1(s, makeId) : parseStateBody(s);
  if (body === null) {
    return null;
  }

  const enabledSources = enabledSourcesFor(s, version);
  if (enabledSources === null) {
    return null;
  }

  const recipesBody = parseRecipesBody(s, body.foods);
  if (recipesBody === null) {
    return null;
  }

  const recipes = renameDuplicateLiveNames(recipesBody.recipes);
  const entries = sanitizeRecipeLogIds(body.entries, new Set(recipesBody.recipeLogs.map((rl) => rl.id)));
  const recipeLogs = referencedRecipeLogs(recipesBody.recipeLogs, entries);

  return {
    state: { version: 2, enabledSources, foods: body.foods, meals: body.meals, entries, recipes, recipeLogs },
    lossy: body.lossy || recipesBody.lossy,
  };
}

export function parseState(raw: string | null, makeId: () => string): State | null {
  return parseStateReport(raw, makeId)?.state ?? null;
}
