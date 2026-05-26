import { NUTRIENT_KEYS } from './types.js';
import type { Entry, Food, NutritionFacts, State, Unit } from './types.js';
import { isUnit } from './units.js';

export function isNonNegFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function isPosFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
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
    && isPosFinite(f.servingSize)
    && isUnit(f.servingUnit)
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
    && typeof e.loggedAt === 'string' && e.loggedAt.length > 0;
}

function parseBlob(raw: string | null): Record<string, unknown> | null {
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

  return parsed as Record<string, unknown>;
}

function scaleNutrition(n: NutritionFacts, factor: number): NutritionFacts {
  const out = {} as NutritionFacts;
  for (const k of NUTRIENT_KEYS) {
    out[k] = n[k] * factor;
  }
  return out;
}

function validatedV3(foods: Food[], entries: Entry[]): State | null {
  if (!foods.every(isFood) || !entries.every(isEntry)) {
    return null;
  }

  return { version: 3, foods, entries };
}

export function migrateV1ToV3(raw: string | null): State | null {
  const s = parseBlob(raw);
  if (s === null || s.version !== 1 || !Array.isArray(s.foods) || !Array.isArray(s.entries)) {
    return null;
  }

  const foods: Food[] = (s.foods as Record<string, unknown>[]).map((f) => ({
    id: f.id as string,
    name: f.name as string,
    nutritionFacts: f.nutritionFacts as NutritionFacts,
    servingSize: 100,
    servingUnit: 'g',
    createdAt: f.createdAt as string,
    deletedAt: f.deletedAt as string | null,
  }));

  const entries: Entry[] = (s.entries as Record<string, unknown>[]).map((e) => ({
    id: e.id as string,
    date: e.date as string,
    foodId: e.foodId as string,
    amount: e.grams as number,
    unit: 'g',
    loggedAt: e.loggedAt as string,
  }));

  return validatedV3(foods, entries);
}

export function migrateV2ToV3(raw: string | null): State | null {
  const s = parseBlob(raw);
  if (s === null || s.version !== 2 || !Array.isArray(s.foods) || !Array.isArray(s.entries)) {
    return null;
  }

  const v2Foods = s.foods as Record<string, unknown>[];
  const foods: Food[] = v2Foods.map((f) => {
    const primaryUnit = f.primaryUnit as Unit;
    const weightPerUnit = f.weightPerUnit as number;
    const facts = f.nutritionFacts as NutritionFacts;
    const isCount = primaryUnit === 'count';
    return {
      id: f.id as string,
      name: f.name as string,
      nutritionFacts: isCount ? scaleNutrition(facts, weightPerUnit / 100) : facts,
      servingSize: isCount ? 1 : 100,
      servingUnit: primaryUnit,
      createdAt: f.createdAt as string,
      deletedAt: f.deletedAt as string | null,
    };
  });

  const v2FoodById = new Map(v2Foods.map((f) => [f.id as string, f]));

  const entries: Entry[] = (s.entries as Record<string, unknown>[]).map((e) => {
    const food = v2FoodById.get(e.foodId as string);
    const entryUnit = e.unit as Unit;
    const grams = e.grams as number;
    const base = {
      id: e.id as string,
      date: e.date as string,
      foodId: e.foodId as string,
      loggedAt: e.loggedAt as string,
    };
    if (food && food.primaryUnit === 'count' && entryUnit !== 'count') {
      // v2 allowed logging count-foods in grams; in v3 only 'count' is compatible.
      // Convert via the v2 weight-per-piece so nutrition math stays correct.
      const wpu = food.weightPerUnit as number;
      return { ...base, amount: grams / wpu, unit: 'count' };
    }

    if (food && food.primaryUnit !== 'count' && entryUnit === 'count') {
      // v2 also accepted count entries on weight foods. v3 only allows weight
      // units there. Use the stored grams (canonical) and emit as 'g'.
      return { ...base, amount: grams, unit: 'g' };
    }

    return { ...base, amount: e.amount as number, unit: entryUnit };
  });

  return validatedV3(foods, entries);
}

export function parseState(raw: string | null): State | null {
  const s = parseBlob(raw);
  if (s === null || s.version !== 3 || !Array.isArray(s.foods) || !Array.isArray(s.entries)) {
    return null;
  }

  return validatedV3(s.foods, s.entries);
}
