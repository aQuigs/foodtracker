import type { Unit } from './types.js';

const GRAMS_PER_OZ = 28.3495;
const GRAMS_PER_LB = 453.592;

export const UNITS: readonly Unit[] = ['g', 'oz', 'lb', 'count'];

export function isUnit(u: unknown): u is Unit {
  return typeof u === 'string' && (UNITS as readonly string[]).includes(u);
}

export function toGrams(amount: number, unit: Unit, weightPerUnit: number): number {
  switch (unit) {
    case 'g':     return amount;
    case 'oz':    return amount * GRAMS_PER_OZ;
    case 'lb':    return amount * GRAMS_PER_LB;
    case 'count': return amount * weightPerUnit;
  }
}
