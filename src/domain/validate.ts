import type { Entry, Food, Meal, State } from './types.js';
import { isNonNegFinite, isPosFinite, isUnit, isValidChips } from './units.js';

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
    && isValidChips(f.chips)
    && typeof f.createdAt === 'string' && f.createdAt.length > 0
    && (f.deletedAt === null || (typeof f.deletedAt === 'string' && f.deletedAt.length > 0));
}

function isEntry(x: unknown): x is Entry {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const e = x as Record<string, unknown>;
  return typeof e.id === 'string' && e.id.length > 0
    && typeof e.date === 'string' && e.date.length > 0
    && typeof e.foodId === 'string' && e.foodId.length > 0
    && isPosFinite(e.amount)
    && isUnit(e.unit)
    && isPosFinite(e.grams)
    && typeof e.loggedAt === 'string' && e.loggedAt.length > 0
    && typeof e.mealId === 'string' && e.mealId.length > 0;
}

function isMeal(x: unknown): x is Meal {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const m = x as Record<string, unknown>;
  return typeof m.id === 'string' && m.id.length > 0
    && typeof m.date === 'string' && m.date.length > 0
    && typeof m.name === 'string'
    && typeof m.createdAt === 'string' && m.createdAt.length > 0;
}

// Schema version trail: v1 (initial) → v2 (units, M4) → v4 (chips, M5b — v3
// was reserved for a then-parallel M7 branch and is now permanently skipped)
// → v5 (meals + entry.mealId, M7).
//
// v1 → v2: existing foods default to grams (weightPerUnit irrelevant since
// math is grams-based for g/oz/lb), entries gain {amount: grams, unit: 'g'}.
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

// v2 → v4: existing foods gain chips: null. v3 is skipped (see header).
function migrateV2(raw: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(raw.foods) || !Array.isArray(raw.entries)) {
    return null;
  }

  const foods = raw.foods.map((f) => {
    if (typeof f !== 'object' || f === null) {
      return f;
    }

    return { ...(f as Record<string, unknown>), chips: null };
  });

  return { version: 4, foods, entries: raw.entries };
}

// v4 → v5: each entry gets a synthetic mealId; one Meal is created per
// distinct date that has entries (using the earliest entry's loggedAt as createdAt).
function migrateV4(raw: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(raw.foods) || !Array.isArray(raw.entries)) {
    return null;
  }

  const entriesByDate = new Map<string, Array<Record<string, unknown>>>();
  for (const e of raw.entries) {
    if (typeof e !== 'object' || e === null) {
      return null;
    }

    const entry = e as Record<string, unknown>;
    if (typeof entry.date !== 'string') {
      return null;
    }

    const group = entriesByDate.get(entry.date) ?? [];
    group.push(entry);
    entriesByDate.set(entry.date, group);
  }

  const meals: Array<Record<string, unknown>> = [];
  for (const [date, group] of entriesByDate) {
    const mealId = `${date}-meal-1`;
    const loggedAts = group
      .map((e) => (typeof e.loggedAt === 'string' ? e.loggedAt : ''))
      .filter((t) => t !== '');
    const createdAt = loggedAts.sort()[0] ?? new Date(0).toISOString();

    meals.push({ id: mealId, date, name: 'Meal 1', createdAt });
  }

  const entries = raw.entries.map((e) => {
    if (typeof e !== 'object' || e === null) {
      return e;
    }

    const entry = e as Record<string, unknown>;
    return { ...entry, mealId: `${entry.date}-meal-1` };
  });

  return { version: 5, foods: raw.foods, entries, meals };
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

  if (s.version === 2) {
    const migrated = migrateV2(s);
    if (migrated === null) {
      return null;
    }

    s = migrated;
  }

  if (s.version === 4) {
    const migrated = migrateV4(s);
    if (migrated === null) {
      return null;
    }

    s = migrated;
  }

  if (s.version !== 5) {
    return null;
  }

  if (!Array.isArray(s.foods) || !s.foods.every(isFood)) {
    return null;
  }

  const foods: Food[] = s.foods;

  if (!Array.isArray(s.entries) || !s.entries.every(isEntry)) {
    return null;
  }

  const entries: Entry[] = s.entries;

  if (!Array.isArray(s.meals) || !s.meals.every(isMeal)) {
    return null;
  }

  const meals: Meal[] = s.meals;

  return { version: 5, foods, entries, meals };
}
