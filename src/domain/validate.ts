import { NUTRIENT_KEYS } from './types.js';
import type { Entry, Food, FoodSourceManifest, Meal, NutritionFacts, Portion, Recipe, RecipeLog, SourcedFood, State } from './types.js';
import { isUnit } from './units.js';
import { foodNameKey } from './foodNames.js';
import { defaultEnabledSources } from './foodSources.js';
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

function hasFoodCore(f: Record<string, unknown>): boolean {
  return isNonEmptyString(f.id)
    && isNonEmptyString(f.name)
    && isNutritionFacts(f.nutritionFacts)
    && isPosFinite(f.servingSize)
    && isUnit(f.servingUnit);
}

export function isSourcedFood(x: unknown): x is SourcedFood {
  const f = asRecord(x);
  return f !== null
    && hasFoodCore(f)
    && isNonEmptyString(f.source)
    && isNonEmptyString(f.sourceId)
    && (f.tags === undefined || (Array.isArray(f.tags) && f.tags.every((t) => typeof t === 'string')));
}

export function isFoodSourceManifest(x: unknown): x is FoodSourceManifest {
  const m = asRecord(x);
  return m !== null
      && isNonEmptyString(m.source)
      && isNonEmptyString(m.version)
      && isNonNegFinite(m.itemCount)
      && typeof m.sha256 === 'string'
      && typeof m.generatedAt === 'string';
}

function isFood(x: unknown): x is Food {
  const f = asRecord(x);
  return f !== null
    && hasFoodCore(f)
    && isNonEmptyString(f.createdAt)
    && (f.deletedAt === null || isNonEmptyString(f.deletedAt))
    && (f.source === undefined || isNonEmptyString(f.source));
}

function isMeal(x: unknown): x is Meal {
  const m = asRecord(x);
  return m !== null
    && isNonEmptyString(m.id)
    && isNonEmptyString(m.date)
    && typeof m.position === 'number' && Number.isInteger(m.position) && m.position >= 0;
}

function isEntry(x: unknown): x is Entry {
  const e = asRecord(x);
  return e !== null
    && isNonEmptyString(e.id)
    && isNonEmptyString(e.date)
    && isNonEmptyString(e.foodId)
    && isPosFinite(e.amount)
    && isUnit(e.unit)
    && isNonEmptyString(e.mealId)
    && isNonEmptyString(e.loggedAt);
}

// Restores the unique-live-name rule on the way in: a blob written before
// the rule, or a pasted backup, may hold two live "Apple"s or "Omelette"s,
// which would lock both out of editing. Later duplicates get a numbered
// suffix; nothing is dropped.
function renameDuplicateLiveNames<T extends { name: string; deletedAt: string | null }>(items: T[]): T[] {
  const taken = new Set<string>();

  return items.map((item) => {
    if (item.deletedAt !== null) {
      return item;
    }

    let name = item.name;
    for (let n = 2; taken.has(foodNameKey(name)); n++) {
      name = `${item.name} (${n})`;
    }

    taken.add(foodNameKey(name));
    return name === item.name ? item : { ...item, name };
  });
}

function entriesReferenceRealMeals(entries: Entry[], meals: Meal[]): boolean {
  const mealById = new Map(meals.map((m) => [m.id, m]));
  return entries.every((e) => mealById.get(e.mealId)?.date === e.date);
}

// The food only has to exist, not be live: a pasted backup may hold a recipe
// whose food was deleted since, and the reducer owns that invariant.
function isPortion(x: unknown, foodIds: Set<string>): x is Portion {
  const i = asRecord(x);
  return i !== null
    && isNonEmptyString(i.foodId)
    && foodIds.has(i.foodId)
    && isPosFinite(i.amount)
    && isUnit(i.unit);
}

function noDuplicateFoodIds(items: Portion[]): boolean {
  const ids = new Set(items.map((i) => i.foodId));
  return ids.size === items.length;
}

function isRecipe(x: unknown, foodIds: Set<string>): x is Recipe {
  const r = asRecord(x);
  return r !== null
    && isNonEmptyString(r.id)
    && isNonEmptyString(r.name)
    && isNonEmptyString(r.createdAt)
    && (r.deletedAt === null || isNonEmptyString(r.deletedAt))
    && Array.isArray(r.items)
    && r.items.length > 0
    && r.items.every((i) => isPortion(i, foodIds))
    && noDuplicateFoodIds(r.items);
}

function isRecipeLog(x: unknown, recipes: Recipe[]): x is RecipeLog {
  const rl = asRecord(x);
  return rl !== null
    && isNonEmptyString(rl.id)
    && isNonEmptyString(rl.recipeId)
    && recipes.some((r) => r.id === rl.recipeId)
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

type RecipesBody = { recipes: Recipe[]; recipeLogs: RecipeLog[] };

function parseRecipesBody(s: Record<string, unknown>, foods: Food[]): RecipesBody | null {
  const foodIds = new Set(foods.map((f) => f.id));
  const recipes = optionalArray(s.recipes, (r): r is Recipe => isRecipe(r, foodIds));
  if (recipes === null) {
    return null;
  }

  const recipeLogs = optionalArray(s.recipeLogs, (rl): rl is RecipeLog => isRecipeLog(rl, recipes));
  if (recipeLogs === null) {
    return null;
  }

  return { recipes, recipeLogs };
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

type StateBody = { foods: Food[]; meals: Meal[]; entries: Entry[] };

function migrateV1(s: Record<string, unknown>, makeId: () => string): StateBody | null {
  if (!Array.isArray(s.foods) || !s.foods.every(isFood)) {
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

  return { foods: renameDuplicateLiveNames(s.foods), meals, entries };
}

function parseStateBody(s: Record<string, unknown>): StateBody | null {
  if (!Array.isArray(s.foods) || !s.foods.every(isFood)) {
    return null;
  }

  if (!Array.isArray(s.meals) || !s.meals.every(isMeal)) {
    return null;
  }

  if (!Array.isArray(s.entries) || !s.entries.every(isEntry)) {
    return null;
  }

  if (!entriesReferenceRealMeals(s.entries, s.meals)) {
    return null;
  }

  return { foods: renameDuplicateLiveNames(s.foods), meals: s.meals, entries: s.entries };
}

// Duplicates collapsed keeping first occurrence; unknown names (the registry
// may shrink) are kept and simply ignored wherever sources are consumed.
function normalizeEnabledSources(x: unknown): string[] | null {
  if (!Array.isArray(x) || !x.every(isNonEmptyString)) {
    return null;
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of x) {
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }

  return out;
}

// A blob written before the field existed (any v1, or a v2 without it)
// gets the defaults. An explicit list is honoured even when empty — the
// user may have turned everything off; only a malformed value is rejected.
function enabledSourcesFor(s: Record<string, unknown>, version: 1 | 2): string[] | null {
  if (version === 1 || s.enabledSources === undefined) {
    return defaultEnabledSources();
  }

  return normalizeEnabledSources(s.enabledSources);
}

export function parseState(raw: string | null, makeId: () => string): State | null {
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

  return { version: 2, enabledSources, foods: body.foods, meals: body.meals, entries, recipes, recipeLogs };
}
