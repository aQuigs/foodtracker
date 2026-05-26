import { NUTRIENT_KEYS } from './types.js';
import type { Action, Entry, Food, FoodUpdates, NutritionFacts, State } from './types.js';
import { isNonNegFinite } from './validate.js';
import { isUnit } from './units.js';

function isValidEntry(entry: Entry, state: State): boolean {
  if (!entry.foodId) {
    return false;
  }

  if (!state.foods.some((f) => f.id === entry.foodId)) {
    return false;
  }

  if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
    return false;
  }

  if (!isUnit(entry.unit)) {
    return false;
  }

  return true;
}

function isPosFinite(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function isValidNutritionFacts(n: NutritionFacts): boolean {
  return NUTRIENT_KEYS.every((k) => isNonNegFinite(n[k]));
}

function isValidFood(food: Food): boolean {
  if (!food.id || !food.name) {
    return false;
  }

  if (!isValidNutritionFacts(food.nutritionFacts)) {
    return false;
  }

  if (!isPosFinite(food.servingSize)) {
    return false;
  }

  if (!isUnit(food.servingUnit)) {
    return false;
  }

  return true;
}

function isValidUpdates(updates: FoodUpdates): boolean {
  if (Object.keys(updates).length === 0) {
    return false;
  }

  if (updates.name !== undefined && updates.name === '') {
    return false;
  }

  if (updates.nutritionFacts !== undefined && !isValidNutritionFacts(updates.nutritionFacts)) {
    return false;
  }

  if (updates.servingUnit !== undefined && !isUnit(updates.servingUnit)) {
    return false;
  }

  if (updates.servingSize !== undefined && !isPosFinite(updates.servingSize)) {
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
