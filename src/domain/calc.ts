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

  // Round all three independently in integer tenths, then nudge the largest by ±1 tenth
  // if the sum drifts from 1000 (= 100.0%). Derive the smallest as the integer remainder
  // so the three percent values sum to exactly 100.0 without IEEE-754 addition drift.
  let tProtein = Math.round(rawProtein * 10);
  let tCarbs   = Math.round(rawCarbs   * 10);
  let tFat     = Math.round(rawFat     * 10);

  const drift = tProtein + tCarbs + tFat - 1000;
  if (drift !== 0) {
    if (tProtein >= tCarbs && tProtein >= tFat) {
      tProtein -= drift;
    } else if (tCarbs >= tProtein && tCarbs >= tFat) {
      tCarbs -= drift;
    } else {
      tFat -= drift;
    }
  }

  // Derive the smallest value as the remainder so float division sums to exactly 100.
  let pProtein: number;
  let pCarbs: number;
  let pFat: number;

  if (tFat <= tProtein && tFat <= tCarbs) {
    pProtein = tProtein / 10;
    pCarbs   = tCarbs   / 10;
    pFat     = 100 - pProtein - pCarbs;
  } else if (tCarbs <= tProtein && tCarbs <= tFat) {
    pProtein = tProtein / 10;
    pFat     = tFat     / 10;
    pCarbs   = 100 - pProtein - pFat;
  } else {
    pCarbs   = tCarbs   / 10;
    pFat     = tFat     / 10;
    pProtein = 100 - pCarbs - pFat;
  }

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
