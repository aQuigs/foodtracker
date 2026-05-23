import type { Entry, Food, State, Totals } from './types.js';

export type MacroDistribution = {
  protein: { percent: number; calories: number };
  carbs:   { percent: number; calories: number };
  fat:     { percent: number; calories: number };
};

export function macroDistribution(totals: Totals): MacroDistribution {
  const zero = { percent: 0, calories: 0 };

  if (totals.kcal === 0) {
    return { protein: zero, carbs: zero, fat: zero };
  }

  const proteinCal = totals.protein * 4;
  const carbsCal   = totals.carbs   * 4;
  const fatCal     = totals.fat     * 9;
  const totalCal   = proteinCal + carbsCal + fatCal;

  if (totalCal === 0) {
    return { protein: zero, carbs: zero, fat: zero };
  }

  const rawProtein = (proteinCal / totalCal) * 100;
  const rawCarbs   = (carbsCal   / totalCal) * 100;
  const rawFat     = (fatCal     / totalCal) * 100;

  // Round two segments and derive the third as the integer-tenths remainder to guarantee
  // the three values sum to exactly 100.0 without IEEE-754 addition drift.
  const pProteinTenths = Math.round(rawProtein * 10);
  const pCarbsTenths   = Math.round(rawCarbs   * 10);
  const pFatTenths     = 1000 - pProteinTenths - pCarbsTenths;

  const pProtein = pProteinTenths / 10;
  const pCarbs   = pCarbsTenths   / 10;
  const pFat     = pFatTenths     / 10;

  return {
    protein: { percent: pProtein, calories: proteinCal },
    carbs:   { percent: pCarbs,   calories: carbsCal   },
    fat:     { percent: pFat,     calories: fatCal     },
  };
}

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
