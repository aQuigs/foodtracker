import { NUTRIENT_KIND, zeroTotals } from './types.js';
import type { Entry, Food, NutritionFacts, State, Totals } from './types.js';

export function entryCalories(entry: Entry, food: Food): number {
  return (food.nutritionFacts.calories * entry.grams) / 100;
}

export function dailyTotals(state: State, date: string): Totals {
  const foodsById = new Map(state.foods.map((f) => [f.id, f]));
  const totals = zeroTotals();
  const keys = Object.keys(NUTRIENT_KIND) as (keyof NutritionFacts)[];

  for (const entry of state.entries) {
    if (entry.date !== date) {
      continue;
    }

    const food = foodsById.get(entry.foodId);
    if (!food) {
      continue;
    }

    const factor = entry.grams / 100;
    for (const k of keys) {
      totals[k] += food.nutritionFacts[k] * factor;
    }
  }

  return totals;
}
