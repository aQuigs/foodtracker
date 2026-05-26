import { NUTRIENT_KEYS } from './types.js';
import type { Entry, Food, NutritionFacts, State } from './types.js';
import { entryServings } from './units.js';

function zeroNutrition(): NutritionFacts {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as NutritionFacts;
}

export function entryCalories(entry: Entry, food: Food): number {
  const servings = entryServings(entry, food);
  return servings === null ? 0 : food.nutritionFacts.calories * servings;
}

export function entryNutrition(entry: Entry, food: Food): NutritionFacts {
  const servings = entryServings(entry, food);
  if (servings === null) {
    return zeroNutrition();
  }

  return Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [k, food.nutritionFacts[k] * servings]),
  ) as NutritionFacts;
}

export function dailyTotals(state: State, date: string): NutritionFacts {
  const foodsById = new Map(state.foods.map((f) => [f.id, f]));
  const totals = zeroNutrition();

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
