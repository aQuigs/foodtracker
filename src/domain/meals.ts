import { NUTRIENT_KEYS } from './types.js';
import type { Meal, NutritionFacts, State } from './types.js';
import { entryNutrition } from './calc.js';

export function mealsForDate(state: State, date: string): Meal[] {
  return state.meals
    .filter((m) => m.date === date)
    .sort((a, b) => a.position - b.position);
}

export function mealLabel(state: State, mealId: string): string {
  const meal = state.meals.find((m) => m.id === mealId);
  if (meal === undefined) {
    return '';
  }

  const dayMeals = mealsForDate(state, meal.date);
  const index = dayMeals.findIndex((m) => m.id === mealId);
  return `Meal ${index + 1}`;
}

export function mealTotals(state: State, mealId: string): NutritionFacts {
  const foodsById = new Map(state.foods.map((f) => [f.id, f]));
  const totals = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as NutritionFacts;

  for (const entry of state.entries) {
    if (entry.mealId !== mealId) {
      continue;
    }

    const food = foodsById.get(entry.foodId);
    if (food === undefined) {
      continue;
    }

    const n = entryNutrition(entry, food);
    for (const k of NUTRIENT_KEYS) {
      totals[k] += n[k];
    }
  }

  return totals;
}
