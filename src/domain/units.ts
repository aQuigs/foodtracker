import type { Entry, Food, Unit } from './types.js';

const GRAMS_PER_OZ = 28.3495;
const GRAMS_PER_LB = 453.592;

export const UNITS: readonly Unit[] = ['g', 'oz', 'lb', 'count'];

export const WEIGHT_UNITS: readonly Unit[] = ['g', 'oz', 'lb'];

const UNIT_IS_COUNT: Record<Unit, boolean> = {
  g: false, oz: false, lb: false, count: true,
};

export function isUnit(u: unknown): u is Unit {
  return typeof u === 'string' && (UNITS as readonly string[]).includes(u);
}

export function isCountUnit(unit: Unit): boolean {
  return UNIT_IS_COUNT[unit];
}

export function compatibleUnits(food: Food): readonly Unit[] {
  if (isCountUnit(food.servingUnit)) {
    return ['count'];
  }

  return WEIGHT_UNITS;
}

const GRAMS_PER: Record<Unit, number | null> = {
  g: 1,
  oz: GRAMS_PER_OZ,
  lb: GRAMS_PER_LB,
  count: null,
};

export function toGrams(amount: number, unit: Unit): number | null {
  const factor = GRAMS_PER[unit];
  if (factor === null) {
    return null;
  }

  return amount * factor;
}

export function entryServings(entry: Entry, food: Food): number | null {
  if (food.servingSize <= 0 || !Number.isFinite(food.servingSize)) {
    return null;
  }

  if (entry.unit === food.servingUnit) {
    return entry.amount / food.servingSize;
  }

  const entryGrams = toGrams(entry.amount, entry.unit);
  const servingGrams = toGrams(food.servingSize, food.servingUnit);
  if (entryGrams === null || servingGrams === null || servingGrams <= 0) {
    return null;
  }

  return entryGrams / servingGrams;
}
