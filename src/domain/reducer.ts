import { NUTRIENT_KEYS } from './types.js';
import type { Action, EntryDraft, Food, FoodUpdates, Meal, NutritionFacts, State } from './types.js';
import { isNonNegFinite, isPosFinite } from './validate.js';
import { isCountUnit, isUnit } from './units.js';
import { mealsForDate } from './meals.js';

function isValidEntryDraft(entry: EntryDraft, state: State): boolean {
  return !!entry.id
    && !state.entries.some((e) => e.id === entry.id)
    && !!entry.foodId
    && state.foods.some((f) => f.id === entry.foodId)
    && isPosFinite(entry.amount)
    && isUnit(entry.unit);
}

function latestMealOn(state: State, date: string): Meal | null {
  return mealsForDate(state, date).at(-1) ?? null;
}

function renumberMealsForDate(meals: Meal[], date: string): Meal[] {
  const dayMeals = meals
    .filter((m) => m.date === date)
    .sort((a, b) => a.position - b.position);
  const remapped = new Map<string, number>();
  dayMeals.forEach((m, i) => remapped.set(m.id, i));
  return meals.map((m) => (m.date === date ? { ...m, position: remapped.get(m.id)! } : m));
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

// Replace a live (non-deleted) food via `update`. Returns the unchanged state
// if the id is missing or the food is already soft-deleted.
function updateLiveFood(state: State, foodId: string, update: (f: Food) => Food | null): State {
  const idx = state.foods.findIndex((f) => f.id === foodId);
  if (idx === -1 || state.foods[idx]!.deletedAt !== null) {
    return state;
  }

  const next = update(state.foods[idx]!);
  if (next === null) {
    return state;
  }

  return { ...state, foods: state.foods.map((f, i) => i === idx ? next : f) };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LogEntry': {
      if (!isValidEntryDraft(action.entry, state)) {
        return state;
      }

      const latest = latestMealOn(state, action.entry.date);
      if (latest !== null) {
        const entry = { ...action.entry, mealId: latest.id };
        return { ...state, entries: [...state.entries, entry] };
      }

      if (state.meals.some((m) => m.id === action.newMealId)) {
        return state;
      }

      const meal: Meal = { id: action.newMealId, date: action.entry.date, position: 0 };
      const entry = { ...action.entry, mealId: meal.id };
      return { ...state, meals: [...state.meals, meal], entries: [...state.entries, entry] };
    }
    case 'NewMeal': {
      if (state.meals.some((m) => m.id === action.mealId)) {
        return state;
      }

      const latest = latestMealOn(state, action.date);
      const latestEmpty = latest === null || !state.entries.some((e) => e.mealId === latest.id);
      if (latestEmpty) {
        return state;
      }

      const meal: Meal = { id: action.mealId, date: action.date, position: latest.position + 1 };
      return { ...state, meals: [...state.meals, meal] };
    }
    case 'DeleteEntry': {
      const target = state.entries.find((e) => e.id === action.entryId);
      if (target === undefined) {
        return state;
      }

      const entries = state.entries.filter((e) => e.id !== action.entryId);
      const targetMeal = state.meals.find((m) => m.id === target.mealId);
      const mealEmpty = !entries.some((e) => e.mealId === target.mealId);
      const isLatest = targetMeal !== undefined
        && latestMealOn(state, targetMeal.date)?.id === targetMeal.id;

      if (!mealEmpty || targetMeal === undefined || isLatest) {
        return { ...state, entries };
      }

      const remaining = state.meals.filter((m) => m.id !== targetMeal.id);
      return { ...state, meals: renumberMealsForDate(remaining, targetMeal.date), entries };
    }
    case 'AddFood':
      return isValidFood(action.food) && !state.foods.some((f) => f.id === action.food.id)
        ? { ...state, foods: [...state.foods, action.food] }
        : state;
    case 'EditFood':
      return updateLiveFood(state, action.foodId, (current) => {
        if (!isValidUpdates(action.updates)) {
          return null;
        }

        const next = { ...current, ...action.updates };
        const axisChanged = isCountUnit(current.servingUnit) !== isCountUnit(next.servingUnit);
        if (axisChanged && state.entries.some((e) => e.foodId === current.id)) {
          return null;
        }

        return next;
      });
    case 'SoftDeleteFood':
      return updateLiveFood(state, action.foodId, (current) => ({ ...current, deletedAt: action.deletedAt }));
    case 'ReviveFood': {
      const food = state.foods.find((f) => f.id === action.foodId);

      if (!food || food.deletedAt === null) {
        return state;
      }

      return { ...state, foods: state.foods.map((f) =>
        f.id === action.foodId ? { ...f, deletedAt: null } : f) };
    }
    case 'ReplaceState':
      return action.state;
    default:
      return state;
  }
}
