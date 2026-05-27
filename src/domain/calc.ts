import { NUTRIENT_KEYS } from './types.js';
import type { Entry, Food, NutritionFacts, State } from './types.js';
import { entryServings } from './units.js';

export function zeroNutrition(): NutritionFacts {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as NutritionFacts;
}

export function scaleNutrition(n: NutritionFacts, servings: number): NutritionFacts {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, n[k] * servings])) as NutritionFacts;
}

export function entryCalories(entry: Entry, food: Food): number {
  const servings = entryServings(entry, food);
  return servings === null ? 0 : food.nutritionFacts.calories * servings;
}

export function entryNutrition(entry: Entry, food: Food): NutritionFacts {
  const servings = entryServings(entry, food);
  return servings === null ? zeroNutrition() : scaleNutrition(food.nutritionFacts, servings);
}

export function indexFoodsById(state: State): Map<string, Food> {
  return new Map(state.foods.map((f) => [f.id, f]));
}

export function sumNutrition(entries: Entry[], foodsById: Map<string, Food>): NutritionFacts {
  const totals = zeroNutrition();
  for (const entry of entries) {
    const food = foodsById.get(entry.foodId);
    if (food === undefined) {
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

export function dailyTotals(state: State, date: string): NutritionFacts {
  return sumNutrition(state.entries.filter((e) => e.date === date), indexFoodsById(state));
}
