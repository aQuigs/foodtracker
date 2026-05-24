import type { Action, Entry, Food, FoodUpdates, State } from './types.js';
import { isNonNegFinite, isPosFinite, isUnit } from './units.js';

function isValidEntry(entry: Entry, state: State): boolean {
  if (!entry.foodId) {
    return false;
  }

  if (!state.foods.some((f) => f.id === entry.foodId)) {
    return false;
  }

  if (!isPosFinite(entry.grams)) {
    return false;
  }

  if (!isPosFinite(entry.amount)) {
    return false;
  }

  if (!isUnit(entry.unit)) {
    return false;
  }

  return true;
}

function isValidFood(food: Food): boolean {
  if (!food.id || !food.name) {
    return false;
  }

  if (!isUnit(food.primaryUnit)) {
    return false;
  }

  if (!isPosFinite(food.weightPerUnit)) {
    return false;
  }

  return isNonNegFinite(food.kcalPer100g)
    && isNonNegFinite(food.proteinPer100g)
    && isNonNegFinite(food.carbsPer100g)
    && isNonNegFinite(food.fatPer100g);
}

function isValidUpdates(updates: FoodUpdates): boolean {
  if (updates.name !== undefined && updates.name === '') {
    return false;
  }

  for (const key of ['kcalPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g'] as const) {
    const v = updates[key];
    if (v !== undefined && !isNonNegFinite(v)) {
      return false;
    }
  }

  if (updates.primaryUnit !== undefined && !isUnit(updates.primaryUnit)) {
    return false;
  }

  if (updates.weightPerUnit !== undefined && !isPosFinite(updates.weightPerUnit)) {
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
