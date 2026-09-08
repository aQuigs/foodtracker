import type { State } from '../domain/types.js';
import { formatServings } from './formatServings.js';

// The name a logged batch goes by wherever it is named — its group header and
// the prompt that asks before deleting it: the recipe, with the servings
// multiplier when there is one.
export function recipeLogLabel(state: State, recipeLogId: string): string {
  const recipeLog = state.recipeLogs.find((rl) => rl.id === recipeLogId);
  const recipe = recipeLog ? state.recipes.find((r) => r.id === recipeLog.recipeId) : undefined;
  const name = recipe?.name ?? 'Recipe';
  const servings = formatServings(recipeLog?.servings ?? 1);

  return servings === '1' ? name : `${name} ×${servings}`;
}
