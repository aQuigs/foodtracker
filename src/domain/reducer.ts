import { NUTRIENT_KEYS } from './types.js';
import type { Action, Entry, EntryDraft, Food, FoodUpdates, Meal, NutritionFacts, Portion, Recipe, RecipeLog, State } from './types.js';
import { isNonNegFinite, isPosFinite } from './validate.js';
import { compatibleUnits, isCountUnit, isUnit } from './units.js';
import { mealsForDate } from './meals.js';
import { nameTaken } from './foodNames.js';
import { liveRecipeUsing, referencedRecipeLogs } from './recipes.js';
import { axisLock } from './foodLocks.js';

function findLive<T extends { id: string; deletedAt: string | null }>(items: T[], id: string): T | null {
  return items.find((x) => x.id === id && x.deletedAt === null) ?? null;
}

function isFoodLive(state: State, foodId: string): boolean {
  return findLive(state.foods, foodId) !== null;
}

function isValidEntryDraft(entry: EntryDraft, state: State): boolean {
  return !!entry.id
    && !state.entries.some((e) => e.id === entry.id)
    && !!entry.foodId
    && state.foods.some((f) => f.id === entry.foodId)
    && isPosFinite(entry.amount)
    && isUnit(entry.unit);
}

// LogEntry tolerates a soft-deleted food so history can be re-logged. Every
// LogRecipe entry must be live (a recipe's items already are, by
// construction) and must name one of the recipe's own foods.
function isValidEntryBatch(entries: EntryDraft[], state: State, recipe: Recipe): boolean {
  if (entries.length === 0) {
    return false;
  }

  const ids = new Set(entries.map((e) => e.id));
  if (ids.size !== entries.length) {
    return false;
  }

  const dates = new Set(entries.map((e) => e.date));
  if (dates.size !== 1) {
    return false;
  }

  return entries.every((e) =>
    isValidEntryDraft(e, state)
    && isFoodLive(state, e.foodId)
    && recipe.items.some((i) => i.foodId === e.foodId));
}

function latestMealOn(meals: Meal[], date: string): Meal | null {
  return mealsForDate(meals, date).at(-1) ?? null;
}

function latestMealOrNew(state: State, date: string, newMealId: string): { meal: Meal; meals: Meal[] } | null {
  const latest = latestMealOn(state.meals, date);
  if (latest !== null) {
    return { meal: latest, meals: state.meals };
  }

  if (state.meals.some((m) => m.id === newMealId)) {
    return null;
  }

  const meal: Meal = { id: newMealId, date, position: 0 };
  return { meal, meals: [...state.meals, meal] };
}

function renumberMealsForDate(meals: Meal[], date: string): Meal[] {
  const dayMeals = meals
    .filter((m) => m.date === date)
    .sort((a, b) => a.position - b.position);
  const remapped = new Map<string, number>();
  dayMeals.forEach((m, i) => remapped.set(m.id, i));
  return meals.map((m) => (m.date === date ? { ...m, position: remapped.get(m.id)! } : m));
}

// The one place a meal or recipe log dies with its last entry: a meal left
// empty is dropped and renumbered unless it's the latest for its date.
function removeEntriesAndGCMeals(
  state: State,
  entryIds: Set<string>,
): { meals: Meal[]; entries: Entry[]; recipeLogs: RecipeLog[] } {
  const removedMealIds = new Set(
    state.entries.filter((e) => entryIds.has(e.id)).map((e) => e.mealId),
  );
  const entries = state.entries.filter((e) => !entryIds.has(e.id));

  let meals = state.meals;
  for (const mealId of removedMealIds) {
    const meal = meals.find((m) => m.id === mealId);
    if (meal === undefined) {
      continue;
    }

    const mealEmpty = !entries.some((e) => e.mealId === mealId);
    const isLatest = latestMealOn(meals, meal.date)?.id === meal.id;
    if (!mealEmpty || isLatest) {
      continue;
    }

    meals = renumberMealsForDate(meals.filter((m) => m.id !== mealId), meal.date);
  }

  return { meals, entries, recipeLogs: referencedRecipeLogs(state.recipeLogs, entries) };
}

function isValidNutritionFacts(n: NutritionFacts): boolean {
  return NUTRIENT_KEYS.every((k) => isNonNegFinite(n[k]));
}

function isValidFood(food: Food): boolean {
  return !!food.id && !!food.name
    && isValidNutritionFacts(food.nutritionFacts)
    && isPosFinite(food.servingSize)
    && isUnit(food.servingUnit);
}

function isValidUpdates(u: FoodUpdates): boolean {
  if (Object.keys(u).length === 0) {
    return false;
  }

  if (u.name !== undefined && u.name === '') {
    return false;
  }

  if (u.nutritionFacts !== undefined && !isValidNutritionFacts(u.nutritionFacts)) {
    return false;
  }

  if (u.servingUnit !== undefined && !isUnit(u.servingUnit)) {
    return false;
  }

  if (u.servingSize !== undefined && !isPosFinite(u.servingSize)) {
    return false;
  }

  return true;
}

function isValidPortion(portion: Portion, foods: Food[]): boolean {
  if (!portion.foodId) {
    return false;
  }

  const food = findLive(foods, portion.foodId);
  if (food === null) {
    return false;
  }

  return isPosFinite(portion.amount) && compatibleUnits(food).includes(portion.unit);
}

function isValidRecipe(recipe: Recipe, state: State, ignoreId: string | null = null): boolean {
  if (!recipe.id || !recipe.name) {
    return false;
  }

  if (nameTaken(recipe, state.recipes, ignoreId)) {
    return false;
  }

  if (recipe.items.length === 0) {
    return false;
  }

  const foodIds = new Set(recipe.items.map((i) => i.foodId));
  if (foodIds.size !== recipe.items.length) {
    return false;
  }

  return recipe.items.every((i) => isValidPortion(i, state.foods));
}

// Null when the id is missing, soft-deleted, or `update` refuses the change.
function updateLiveById<T extends { id: string; deletedAt: string | null }>(
  items: T[],
  id: string,
  update: (item: T) => T | null,
): T[] | null {
  const current = findLive(items, id);
  if (current === null) {
    return null;
  }

  const next = update(current);
  if (next === null) {
    return null;
  }

  return items.map((x) => (x.id === id ? next : x));
}

function updateLiveFood(state: State, foodId: string, update: (f: Food) => Food | null): State {
  const foods = updateLiveById(state.foods, foodId, update);
  return foods === null ? state : { ...state, foods };
}

function updateLiveRecipe(state: State, recipeId: string, update: (r: Recipe) => Recipe | null): State {
  const recipes = updateLiveById(state.recipes, recipeId, update);
  return recipes === null ? state : { ...state, recipes };
}

// A food's count/weight axis can't flip while anything relies on its current
// unit: a logged entry's amount, or a live recipe item's amount and unit.
function axisChangeBlocked(state: State, from: Food, to: Food): boolean {
  const axisChanged = isCountUnit(from.servingUnit) !== isCountUnit(to.servingUnit);
  if (!axisChanged) {
    return false;
  }

  return axisLock(state, from.id) !== null;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LogEntry': {
      if (!isValidEntryDraft(action.entry, state)) {
        return state;
      }

      const resolved = latestMealOrNew(state, action.entry.date, action.newMealId);
      if (resolved === null) {
        return state;
      }

      const entry = { ...action.entry, mealId: resolved.meal.id };
      return { ...state, meals: resolved.meals, entries: [...state.entries, entry] };
    }
    case 'NewMeal': {
      if (state.meals.some((m) => m.id === action.mealId)) {
        return state;
      }

      const latest = latestMealOn(state.meals, action.date);
      const latestEmpty = latest === null || !state.entries.some((e) => e.mealId === latest.id);
      if (latestEmpty) {
        return state;
      }

      const meal: Meal = { id: action.mealId, date: action.date, position: latest.position + 1 };
      return { ...state, meals: [...state.meals, meal] };
    }
    case 'DeleteEntry': {
      if (!state.entries.some((e) => e.id === action.entryId)) {
        return state;
      }

      const { meals, entries, recipeLogs } = removeEntriesAndGCMeals(state, new Set([action.entryId]));
      return { ...state, meals, entries, recipeLogs };
    }
    case 'AddFood':
      return isValidFood(action.food)
        && !state.foods.some((f) => f.id === action.food.id)
        && !nameTaken(action.food, state.foods)
        ? { ...state, foods: [...state.foods, action.food] }
        : state;
    case 'EditFood':
      return updateLiveFood(state, action.foodId, (current) => {
        if (current.source !== undefined) {
          return null;
        }

        if (!isValidUpdates(action.updates)) {
          return null;
        }

        // Only an untagged (user-made) food reaches here — the guard above
        // refuses to edit a sourced one — so its identity is name alone.
        if (action.updates.name !== undefined && nameTaken({ name: action.updates.name }, state.foods, current.id)) {
          return null;
        }

        const next = { ...current, ...action.updates };
        if (axisChangeBlocked(state, current, next)) {
          return null;
        }

        return next;
      });
    case 'SoftDeleteFood':
      if (liveRecipeUsing(state.recipes, action.foodId) !== null) {
        return state;
      }

      return updateLiveFood(state, action.foodId, (current) => ({ ...current, deletedAt: action.deletedAt }));
    case 'ReviveFood': {
      const existing = state.foods.find((f) => f.id === action.food.id);

      if (!existing || existing.deletedAt === null) {
        return state;
      }

      if (!isValidFood(action.food) || action.food.deletedAt !== null) {
        return state;
      }

      if (nameTaken(action.food, state.foods, action.food.id)) {
        return state;
      }

      if (axisChangeBlocked(state, existing, action.food)) {
        return state;
      }

      // The payload replaces the dead record wholesale so a revived sourced
      // food carries the catalog's current nutrition, not a stale snapshot.
      return { ...state, foods: state.foods.map((f) =>
        f.id === action.food.id ? action.food : f) };
    }
    case 'AddRecipe':
      return isValidRecipe(action.recipe, state)
        && !state.recipes.some((r) => r.id === action.recipe.id)
        ? { ...state, recipes: [...state.recipes, action.recipe] }
        : state;
    case 'EditRecipe':
      return updateLiveRecipe(state, action.recipeId, (current) => {
        if (Object.keys(action.updates).length === 0) {
          return null;
        }

        const merged = { ...current, ...action.updates };
        return isValidRecipe(merged, state, current.id) ? merged : null;
      });
    case 'SoftDeleteRecipe':
      return updateLiveRecipe(state, action.recipeId, (current) => ({ ...current, deletedAt: action.deletedAt }));
    case 'LogRecipe': {
      const recipe = findLive(state.recipes, action.recipeLog.recipeId);
      if (recipe === null) {
        return state;
      }

      if (!action.recipeLog.id || state.recipeLogs.some((rl) => rl.id === action.recipeLog.id)) {
        return state;
      }

      if (!isPosFinite(action.recipeLog.servings)) {
        return state;
      }

      if (!isValidEntryBatch(action.entries, state, recipe)) {
        return state;
      }

      const resolved = latestMealOrNew(state, action.entries[0]!.date, action.newMealId);
      if (resolved === null) {
        return state;
      }

      const entries = action.entries.map((e) => ({
        ...e, mealId: resolved.meal.id, recipeLogId: action.recipeLog.id,
      }));

      return {
        ...state,
        meals: resolved.meals,
        entries: [...state.entries, ...entries],
        recipeLogs: [...state.recipeLogs, action.recipeLog],
      };
    }
    case 'DeleteRecipeLog': {
      if (!state.recipeLogs.some((rl) => rl.id === action.recipeLogId)) {
        return state;
      }

      const entryIds = new Set(
        state.entries.filter((e) => e.recipeLogId === action.recipeLogId).map((e) => e.id),
      );
      const { meals, entries, recipeLogs } = removeEntriesAndGCMeals(state, entryIds);
      return { ...state, meals, entries, recipeLogs };
    }
    case 'ReplaceState':
      return action.state;
    case 'SetSourceEnabled': {
      if (action.source === '') {
        return state;
      }

      const has = state.enabledSources.includes(action.source);
      if (action.enabled === has) {
        return state;
      }

      const enabledSources = action.enabled
        ? [...state.enabledSources, action.source]
        : state.enabledSources.filter((s) => s !== action.source);

      return { ...state, enabledSources };
    }
    default:
      return state;
  }
}
