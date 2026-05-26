import { NUTRIENT_KEYS } from './types.js';
import type { Action, Entry, Food, FoodUpdates, NutritionFacts, State, Unit } from './types.js';
import { isNonNegFinite, isPosFinite } from './validate.js';
import { isCountUnit, isUnit } from './units.js';

function crossesCountWeightAxis(before: Unit, after: Unit): boolean {
  return isCountUnit(before) !== isCountUnit(after);
}

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

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LogEntry': {
      if (!isValidEntry(action.entry, state)) {
        return state;
      }

      return { ...state, entries: [...state.entries, action.entry] };
    }
    case 'DeleteEntry': {
      const filtered = state.entries.filter((e) => e.id !== action.entryId);
      if (filtered.length === state.entries.length) {
        return state;
      }

      return { ...state, entries: filtered };
    }
    case 'AddFood': {
      if (!isValidFood(action.food)) {
        return state;
      }

      if (state.foods.some((f) => f.id === action.food.id)) {
        return state;
      }

      return { ...state, foods: [...state.foods, action.food] };
    }
    case 'EditFood': {
      const idx = state.foods.findIndex((f) => f.id === action.foodId);
      if (idx === -1) {
        return state;
      }

      const current = state.foods[idx]!;
      if (current.deletedAt !== null) {
        return state;
      }

      if (!isValidUpdates(action.updates)) {
        return state;
      }

      const next: Food = { ...current, ...action.updates };

      if (crossesCountWeightAxis(current.servingUnit, next.servingUnit)
        && state.entries.some((e) => e.foodId === current.id)) {
        return state;
      }

      return { ...state, foods: state.foods.map((f, i) => i === idx ? next : f) };
    }
    case 'SoftDeleteFood': {
      const idx = state.foods.findIndex((f) => f.id === action.foodId);
      if (idx === -1) {
        return state;
      }

      const current = state.foods[idx]!;
      if (current.deletedAt !== null) {
        return state;
      }

      const next: Food = { ...current, deletedAt: action.deletedAt };
      return { ...state, foods: state.foods.map((f, i) => i === idx ? next : f) };
    }
    case 'ReplaceState': {
      return action.state;
    }
    default:
      return state;
  }
}
