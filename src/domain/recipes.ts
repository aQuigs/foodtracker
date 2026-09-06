import type { Entry, Food, NutritionFacts, Recipe, RecipeLog } from './types.js';
import { sumNutrition } from './calc.js';

export function liveRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.filter((r) => r.deletedAt === null);
}

export function recipeNutrition(recipe: Recipe, foodsById: Map<string, Food>): NutritionFacts {
  const liveItems = recipe.items.filter((i) => foodsById.get(i.foodId)?.deletedAt === null);
  return sumNutrition(liveItems, foodsById);
}

export function liveRecipeUsing(recipes: Recipe[], foodId: string): Recipe | null {
  return liveRecipes(recipes).find((r) => r.items.some((i) => i.foodId === foodId)) ?? null;
}

export function referencedRecipeLogs(recipeLogs: RecipeLog[], entries: Entry[]): RecipeLog[] {
  const referenced = new Set(entries.map((e) => e.recipeLogId));
  return recipeLogs.filter((rl) => referenced.has(rl.id));
}
