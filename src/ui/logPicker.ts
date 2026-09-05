import type { Food, Recipe, State } from '../domain/types.js';
import { liveRecipes } from '../domain/recipes.js';
import { byRank, fuzzyMatch, liveFoods } from './search.js';
import type { FoodMatch } from './search.js';
import { compareForLog } from './recent.js';

export type PickerItem =
  | { kind: 'food'; id: string; name: string; food: Food }
  | { kind: 'recipe'; id: string; name: string; recipe: Recipe };

export function pickerItems(state: State): PickerItem[] {
  const foods: PickerItem[] = liveFoods(state.foods).map((food) => (
    { kind: 'food', id: food.id, name: food.name, food }
  ));
  const recipes: PickerItem[] = liveRecipes(state.recipes).map((recipe) => (
    { kind: 'recipe', id: recipe.id, name: recipe.name, recipe }
  ));
  return [...foods, ...recipes];
}

export function searchPicker(state: State, query: string, now: Date): FoodMatch<PickerItem>[] {
  const matches = fuzzyMatch(pickerItems(state), query);
  matches.sort(byRank(compareForLog(state, now)));
  return matches;
}
