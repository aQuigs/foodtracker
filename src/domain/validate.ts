import { NUTRIENT_KEYS } from './types.js';
import type { Entry, Food, NutritionFacts, State } from './types.js';
import { isUnit } from './units.js';

export function isNonNegFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function isPosFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0;
}

function asRecord(x: unknown): Record<string, unknown> | null {
  return typeof x === 'object' && x !== null ? x as Record<string, unknown> : null;
}

function isNutritionFacts(x: unknown): x is NutritionFacts {
  const n = asRecord(x);
  return n !== null && NUTRIENT_KEYS.every((k) => isNonNegFinite(n[k]));
}

function isFood(x: unknown): x is Food {
  const f = asRecord(x);
  return f !== null
    && isNonEmptyString(f.id)
    && isNonEmptyString(f.name)
    && isNutritionFacts(f.nutritionFacts)
    && isPosFinite(f.servingSize)
    && isUnit(f.servingUnit)
    && isNonEmptyString(f.createdAt)
    && (f.deletedAt === null || isNonEmptyString(f.deletedAt));
}

function isEntry(x: unknown): x is Entry {
  const e = asRecord(x);
  return e !== null
    && isNonEmptyString(e.id)
    && isNonEmptyString(e.date)
    && isNonEmptyString(e.foodId)
    && isPosFinite(e.amount)
    && isUnit(e.unit)
    && isNonEmptyString(e.loggedAt);
}

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

  const s = asRecord(parsed);
  if (s === null
    || !Array.isArray(s.foods) || !s.foods.every(isFood)
    || !Array.isArray(s.entries) || !s.entries.every(isEntry)) {
    return null;
  }

  return { version: 1, foods: s.foods, entries: s.entries };
}
