import type { Food, State } from '../domain/types.js';

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function sortFoodsForLog(state: State, now: Date): Food[] {
  const live = state.foods.filter((f) => f.deletedAt === null);
  const cutoff = now.getTime() - RECENT_WINDOW_MS;
  const liveIds = new Set(live.map((f) => f.id));
  const lastUsed = new Map<string, number>();
  for (const e of state.entries) {
    if (!liveIds.has(e.foodId)) continue;
    const t = Date.parse(e.loggedAt);
    if (!Number.isFinite(t) || t < cutoff) continue;
    const prev = lastUsed.get(e.foodId);
    if (prev === undefined || t > prev) lastUsed.set(e.foodId, t);
  }
  return [...live].sort((a, b) => {
    const ta = lastUsed.get(a.id);
    const tb = lastUsed.get(b.id);
    if (ta !== undefined && tb !== undefined) return (tb - ta) || a.name.localeCompare(b.name);
    if (ta !== undefined) return -1;
    if (tb !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });
}
