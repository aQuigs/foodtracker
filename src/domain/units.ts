import type { Unit } from './types.js';

const GRAMS_PER_OZ = 28.3495;
const GRAMS_PER_LB = 453.592;

export const UNITS: readonly Unit[] = ['g', 'oz', 'lb', 'count'];

export function isUnit(u: unknown): u is Unit {
  return typeof u === 'string' && (UNITS as readonly string[]).includes(u);
}

export function isNonNegFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function isPosFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export function isValidChips(chips: unknown): chips is number[] | null {
  if (chips === null) {
    return true;
  }

  if (!Array.isArray(chips) || chips.length !== 4) {
    return false;
  }

  return chips.every(isPosFinite);
}

export function toGrams(amount: number, unit: Unit, weightPerUnit: number): number {
  switch (unit) {
    case 'g':     return amount;
    case 'oz':    return amount * GRAMS_PER_OZ;
    case 'lb':    return amount * GRAMS_PER_LB;
    case 'count': return amount * weightPerUnit;
  }
}
