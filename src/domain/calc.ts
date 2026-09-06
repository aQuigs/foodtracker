import { NUTRIENT_KEYS } from './types.js';
import type { Entry, Food, NutritionFacts, State } from './types.js';
import { entryServings } from './units.js';

export function zeroNutrition(): NutritionFacts {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as NutritionFacts;
}

export function scaleNutrition(n: NutritionFacts, servings: number): NutritionFacts {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, n[k] * servings])) as NutritionFacts;
}

export function addNutrition(into: NutritionFacts, n: NutritionFacts, factor = 1): void {
  for (const k of NUTRIENT_KEYS) {
    into[k] += n[k] * factor;
  }
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

    addNutrition(totals, food.nutritionFacts, servings);
  }

  return totals;
}

export function dailyTotals(state: State, date: string): NutritionFacts {
  return sumNutrition(state.entries.filter((e) => e.date === date), indexFoodsById(state));
}

// Only dates that have an entry appear, so a caller can tell "nothing
// logged" from "logged nothing that resolves". Bounds are inclusive.
export function totalsByDate(state: State, from: string, to: string): Map<string, NutritionFacts> {
  const byDate = new Map<string, Entry[]>();
  for (const e of state.entries) {
    if (e.date < from || e.date > to) {
      continue;
    }

    const bucket = byDate.get(e.date) ?? [];
    bucket.push(e);
    byDate.set(e.date, bucket);
  }

  const foodsById = indexFoodsById(state);
  const out = new Map<string, NutritionFacts>();
  for (const [date, entries] of byDate) {
    out.set(date, sumNutrition(entries, foodsById));
  }

  return out;
}
