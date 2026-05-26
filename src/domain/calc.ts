import { NUTRIENT_KEYS, zeroTotals } from './types.js';
import type { Entry, Food, State, Totals } from './types.js';
import { entryServings } from './units.js';

export function entryCalories(entry: Entry, food: Food): number {
  const servings = entryServings(entry, food);
  if (servings === null) {
    return 0;
  }

  return food.nutritionFacts.calories * servings;
}

export function dailyTotals(state: State, date: string): Totals {
  const foodsById = new Map(state.foods.map((f) => [f.id, f]));
  const totals = zeroTotals();

  for (const entry of state.entries) {
    if (entry.date !== date) {
      continue;
    }

    const food = foodsById.get(entry.foodId);
    if (!food) {
      continue;
    }

    const servings = entryServings(entry, food);
    if (servings === null) {
      continue;
    }

    for (const k of NUTRIENT_KEYS) {
      totals[k] += food.nutritionFacts[k] * servings;
    }
  }

  return totals;
}
