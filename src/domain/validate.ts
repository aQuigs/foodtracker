import type { Entry, Food, State } from './types.js';
import { isNonNegFinite, isPosFinite, isUnit } from './units.js';

function isFood(x: unknown): x is Food {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const f = x as Record<string, unknown>;
  return typeof f.id === 'string' && f.id.length > 0
    && typeof f.name === 'string' && f.name.length > 0
    && isNonNegFinite(f.kcalPer100g)
    && isNonNegFinite(f.proteinPer100g)
    && isNonNegFinite(f.carbsPer100g)
    && isNonNegFinite(f.fatPer100g)
    && isUnit(f.primaryUnit)
    && isPosFinite(f.weightPerUnit)
    && typeof f.createdAt === 'string'
    && (f.deletedAt === null || typeof f.deletedAt === 'string');
}

function isEntry(x: unknown): x is Entry {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const e = x as Record<string, unknown>;
  return typeof e.id === 'string' && e.id.length > 0
    && typeof e.date === 'string'
    && typeof e.foodId === 'string' && e.foodId.length > 0
    && isPosFinite(e.amount)
    && isUnit(e.unit)
    && isPosFinite(e.grams)
    && typeof e.loggedAt === 'string';
}

// v1 → v2 migration: existing foods default to grams (weightPerUnit irrelevant
// since math is grams-based for g/oz/lb), entries gain {amount: grams, unit: 'g'}.
function migrateV1(raw: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(raw.foods) || !Array.isArray(raw.entries)) {
    return null;
  }

  const foods = raw.foods.map((f) => {
    if (typeof f !== 'object' || f === null) {
      return f;
    }

    return { ...(f as Record<string, unknown>), primaryUnit: 'g', weightPerUnit: 100 };
  });

  const entries = raw.entries.map((e) => {
    if (typeof e !== 'object' || e === null) {
      return e;
    }

    const ent = e as Record<string, unknown>;
    return { ...ent, amount: ent.grams, unit: 'g' };
  });

  return { version: 2, foods, entries };
}

// Entry-to-food referential integrity is intentionally not checked here.
// Orphaned entries (with no matching food) are filtered out at render time;
// import accepting them lets users restore older exports without surprise.
export function parseState(raw: string | null): State | null {
  if (raw === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  let s = parsed as Record<string, unknown>;

  const looksLikeV1 = s.version === 1
    || (s.version === undefined && Array.isArray(s.foods) && Array.isArray(s.entries));
  if (looksLikeV1) {
    const migrated = migrateV1(s);
    if (migrated === null) {
      return null;
    }

    s = migrated;
  }

  if (s.version !== 2) {
    return null;
  }

  if (!Array.isArray(s.foods) || !s.foods.every(isFood)) {
    return null;
  }

  if (!Array.isArray(s.entries) || !s.entries.every(isEntry)) {
    return null;
  }

  return { version: 2, foods: s.foods, entries: s.entries };
}
