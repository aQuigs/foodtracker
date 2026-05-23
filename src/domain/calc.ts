import type { Entry, Food, State, Totals } from './types.js';

export function entryKcal(entry: Entry, food: Food): number {
  return (food.kcalPer100g * entry.grams) / 100;
}

export function scaledNutrition(entry: Entry, food: Food): Totals {
  const factor = entry.grams / 100;
  return {
    kcal:    food.kcalPer100g    * factor,
    protein: food.proteinPer100g * factor,
    carbs:   food.carbsPer100g   * factor,
    fat:     food.fatPer100g     * factor,
  };
}

function sumEntries(entries: Entry[], foodsById: Map<string, Food>): Totals {
  const totals: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  for (const entry of entries) {
    const food = foodsById.get(entry.foodId);
    if (!food) {
      continue;
    }

    const factor = entry.grams / 100;
    totals.kcal    += food.kcalPer100g    * factor;
    totals.protein += food.proteinPer100g * factor;
    totals.carbs   += food.carbsPer100g   * factor;
    totals.fat     += food.fatPer100g     * factor;
  }

  return totals;
}

export function dailyTotals(state: State, date: string): Totals {
  const foodsById = new Map(state.foods.map((f) => [f.id, f]));
  return sumEntries(state.entries.filter((e) => e.date === date), foodsById);
}

export function mealTotals(state: State, mealId: string): Totals {
  const foodsById = new Map(state.foods.map((f) => [f.id, f]));
  return sumEntries(state.entries.filter((e) => e.mealId === mealId), foodsById);
}
