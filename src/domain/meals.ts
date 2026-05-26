import type { Entry, Food, Meal, NutritionFacts, State } from './types.js';
import { indexFoodsById, sumNutrition } from './calc.js';

export function mealsForDate(state: State, date: string): Meal[] {
  return state.meals
    .filter((m) => m.date === date)
    .sort((a, b) => a.position - b.position);
}

export function mealTotals(entries: Entry[], foodsById: Map<string, Food>, mealId: string): NutritionFacts {
  return sumNutrition(entries.filter((e) => e.mealId === mealId), foodsById);
}

export function mealTotalsFromState(state: State, mealId: string): NutritionFacts {
  return mealTotals(state.entries, indexFoodsById(state), mealId);
}
