import { NUTRIENT_KEYS } from './types.js';
import type { Entry, Food, NutritionFacts, State } from './types.js';
import { isUnit } from './units.js';

export function isNonNegFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function isNutritionFacts(x: unknown): x is NutritionFacts {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const n = x as Record<string, unknown>;
  return NUTRIENT_KEYS.every((k) => isNonNegFinite(n[k]));
}

function isFood(x: unknown): x is Food {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const f = x as Record<string, unknown>;
  return typeof f.id === 'string' && f.id.length > 0
    && typeof f.name === 'string' && f.name.length > 0
    && isNutritionFacts(f.nutritionFacts)
    && isUnit(f.primaryUnit)
    && typeof f.weightPerUnit === 'number' && Number.isFinite(f.weightPerUnit) && f.weightPerUnit > 0
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
    && typeof e.amount === 'number' && Number.isFinite(e.amount) && e.amount > 0
    && isUnit(e.unit)
    && typeof e.grams === 'number' && Number.isFinite(e.grams) && e.grams > 0
    && typeof e.loggedAt === 'string' && e.loggedAt.length > 0;
}

function isV1Food(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const f = x as Record<string, unknown>;
  return typeof f.id === 'string' && f.id.length > 0
    && typeof f.name === 'string' && f.name.length > 0
    && isNutritionFacts(f.nutritionFacts)
    && typeof f.createdAt === 'string' && f.createdAt.length > 0
    && (f.deletedAt === null || (typeof f.deletedAt === 'string' && f.deletedAt.length > 0));
}

function isV1Entry(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const e = x as Record<string, unknown>;
  return typeof e.id === 'string' && e.id.length > 0
    && typeof e.date === 'string' && e.date.length > 0
    && typeof e.foodId === 'string' && e.foodId.length > 0
    && typeof e.grams === 'number' && Number.isFinite(e.grams) && e.grams > 0
    && typeof e.loggedAt === 'string' && e.loggedAt.length > 0;
}

export function migrateV1ToV2(raw: string | null): State | null {
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

  const s = parsed as Record<string, unknown>;
  if (s.version !== 1) {
    return null;
  }

  if (!Array.isArray(s.foods) || !s.foods.every(isV1Food)) {
    return null;
  }

  if (!Array.isArray(s.entries) || !s.entries.every(isV1Entry)) {
    return null;
  }

  const foods: Food[] = (s.foods as Record<string, unknown>[]).map((f) => ({
    id: f.id as string,
    name: f.name as string,
    nutritionFacts: f.nutritionFacts as NutritionFacts,
    primaryUnit: 'g',
    weightPerUnit: 100,
    createdAt: f.createdAt as string,
    deletedAt: f.deletedAt as string | null,
  }));

  const entries: Entry[] = (s.entries as Record<string, unknown>[]).map((e) => ({
    id: e.id as string,
    date: e.date as string,
    foodId: e.foodId as string,
    amount: e.grams as number,
    unit: 'g',
    grams: e.grams as number,
    loggedAt: e.loggedAt as string,
  }));

  return { version: 2, foods, entries };
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

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const s = parsed as Record<string, unknown>;
  if (s.version !== 2) {
    return null;
  }

  if (!Array.isArray(s.foods) || !s.foods.every(isFood)) {
    return null;
  }

  if (!Array.isArray(s.entries) || !s.entries.every(isEntry)) {
    return null;
  }

  const foods: Food[] = s.foods;
  const entries: Entry[] = s.entries;
  return { version: 2, foods, entries };
}
