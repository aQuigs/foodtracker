import { NUTRIENT_KEYS } from './types.js';
import type { Action, Entry, Food, FoodUpdates, NutritionFacts, State } from './types.js';
import { isNonNegFinite, isPosFinite } from './validate.js';
import { isCountUnit, isUnit } from './units.js';

function isValidEntry(entry: Entry, state: State): boolean {
  return !!entry.foodId
    && state.foods.some((f) => f.id === entry.foodId)
    && isPosFinite(entry.amount)
    && isUnit(entry.unit);
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
    case 'LogEntry':
      return isValidEntry(action.entry, state)
        ? { ...state, entries: [...state.entries, action.entry] }
        : state;
    case 'DeleteEntry': {
      const filtered = state.entries.filter((e) => e.id !== action.entryId);
      return filtered.length === state.entries.length ? state : { ...state, entries: filtered };
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
    case 'ReplaceState':
      return action.state;
    default:
      return state;
  }
}
