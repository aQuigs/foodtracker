import type { Food, Unit } from './types.js';

const GRAMS_PER_OZ = 28.3495;
const GRAMS_PER_LB = 453.592;

export const UNITS: readonly Unit[] = ['g', 'oz', 'lb', 'count'];

const WEIGHT_UNITS: readonly Unit[] = ['g', 'oz', 'lb'];

const UNITS_NEEDING_WEIGHT_PER_UNIT: Record<Unit, boolean> = {
  g: false, oz: false, lb: false, count: true,
};

export function isUnit(u: unknown): u is Unit {
  return typeof u === 'string' && (UNITS as readonly string[]).includes(u);
}

export function needsWeightPerUnit(unit: Unit): boolean {
  return UNITS_NEEDING_WEIGHT_PER_UNIT[unit];
}

export function compatibleUnits(food: Food): readonly Unit[] {
  if (needsWeightPerUnit(food.primaryUnit)) {
    return [food.primaryUnit, 'g'];
  }

  return WEIGHT_UNITS;
}

export function toGrams(amount: number, unit: Unit, weightPerUnit: number): number {
  switch (unit) {
    case 'g':     return amount;
    case 'oz':    return amount * GRAMS_PER_OZ;
    case 'lb':    return amount * GRAMS_PER_LB;
    case 'count': return amount * weightPerUnit;
  }
}
