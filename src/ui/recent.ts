import type { Food, State } from '../domain/types.js';
import { liveFoods } from './search.js';

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function lastUsedMap(state: State, now: Date, liveIds: Set<string>): Map<string, number> {
  const cutoff = now.getTime() - RECENT_WINDOW_MS;
  const out = new Map<string, number>();
  for (const e of state.entries) {
    if (!liveIds.has(e.foodId)) {
      continue;
    }

    const t = Date.parse(e.loggedAt);
    if (!Number.isFinite(t) || t < cutoff) {
      continue;
    }

    const prev = out.get(e.foodId);
    if (prev === undefined || t > prev) {
      out.set(e.foodId, t);
    }
  }

  return out;
}

export function compareForLog(state: State, now: Date): (a: Food, b: Food) => number {
  const liveIds = new Set(state.foods.filter((f) => f.deletedAt === null).map((f) => f.id));
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

export function sortFoodsForLog(state: State, now: Date): Food[] {
  return [...liveFoods(state.foods)].sort(compareForLog(state, now));
}
