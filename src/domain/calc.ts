import { NUTRIENTS, zeroTotals } from './types.js';
import type { Entry, Food, State, Totals } from './types.js';

export function entryCalories(entry: Entry, food: Food): number {
  return (food.per100g.calories * entry.grams) / 100;
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

    const factor = entry.grams / 100;
    for (const n of NUTRIENTS) {
      totals[n] += food.per100g[n] * factor;
    }
  }

  return totals;
}
