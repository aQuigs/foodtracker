import type { Recipe, State } from './types.js';
import { liveRecipeUsing } from './recipes.js';

export type AxisLock = { kind: 'entries' } | { kind: 'recipe'; recipe: Recipe };

export function axisLock(state: State, foodId: string): AxisLock | null {
  if (state.entries.some((e) => e.foodId === foodId)) {
    return { kind: 'entries' };
  }

  const recipe = liveRecipeUsing(state.recipes, foodId);
  if (recipe !== null) {
    return { kind: 'recipe', recipe };
  }

  return null;
}
