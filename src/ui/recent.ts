import type { State } from '../domain/types.js';
import { liveFoods } from './search.js';
import type { Named } from './search.js';
import { liveRecipes } from '../domain/recipes.js';

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// A food's own entries drive its recency; a recipe's comes from the entries
// its LogRecipe produced, found via their shared recipeLogId.
function lastUsedMap(state: State, now: Date, liveIds: Set<string>): Map<string, number> {
  const cutoff = now.getTime() - RECENT_WINDOW_MS;
  const recipeIdByLogId = new Map(state.recipeLogs.map((rl) => [rl.id, rl.recipeId]));
  const out = new Map<string, number>();

  const bump = (id: string, t: number) => {
    if (!liveIds.has(id)) {
      return;
    }

    const prev = out.get(id);
    if (prev === undefined || t > prev) {
      out.set(id, t);
    }
  };

  for (const e of state.entries) {
    const t = Date.parse(e.loggedAt);
    if (!Number.isFinite(t) || t < cutoff) {
      continue;
    }

    bump(e.foodId, t);

    if (e.recipeLogId !== undefined) {
      const recipeId = recipeIdByLogId.get(e.recipeLogId);
      if (recipeId !== undefined) {
        bump(recipeId, t);
      }
    }
  }

  return out;
}

export function compareForLog(state: State, now: Date): (a: Named, b: Named) => number {
  const liveIds = new Set([
    ...liveFoods(state.foods).map((f) => f.id),
    ...liveRecipes(state.recipes).map((r) => r.id),
  ]);
  const lastUsed = lastUsedMap(state, now, liveIds);
  return (a, b) => {
    const ta = lastUsed.get(a.id);
    const tb = lastUsed.get(b.id);
    if (ta !== undefined && tb !== undefined) {
      return (tb - ta) || a.name.localeCompare(b.name);
    }

    if (ta !== undefined) {
      return -1;
    }

    if (tb !== undefined) {
      return 1;
    }

    return a.name.localeCompare(b.name);
  };
}
