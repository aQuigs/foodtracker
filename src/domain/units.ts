import type { Entry, Food, Unit } from './types.js';

const GRAMS_PER_OZ = 28.3495;
const GRAMS_PER_LB = 453.592;

export const AXES = {
  weight: { label: 'weight' },
  count: { label: 'count' },
  volume: { label: 'volume' },
} as const;

export type Axis = keyof typeof AXES;

// A unit's axis decides what it can be measured against. There is no
// conversion between axes — a food is logged in the units of its own axis
// and nothing else — so a new unit needs one line here and nothing more.
const UNIT_AXIS: Record<Unit, Axis> = {
  g: 'weight',
  oz: 'weight',
  lb: 'weight',
  count: 'count',
  ml: 'volume',
};

export const UNITS = Object.keys(UNIT_AXIS) as readonly Unit[];

export function isUnit(u: unknown): u is Unit {
  return typeof u === 'string' && (UNITS as readonly string[]).includes(u);
}

export function axisOf(unit: Unit): Axis {
  return UNIT_AXIS[unit];
}

export function isCountUnit(unit: Unit): boolean {
  return axisOf(unit) === 'count';
}

export function compatibleUnits(food: Food): readonly Unit[] {
  return UNITS.filter((u) => axisOf(u) === axisOf(food.servingUnit));
}

const GRAMS_PER: Record<Unit, number | null> = {
  g: 1,
  oz: GRAMS_PER_OZ,
  lb: GRAMS_PER_LB,
  count: null,
  ml: null,
};

export function toGrams(amount: number, unit: Unit): number | null {
  const factor = GRAMS_PER[unit];
  if (factor === null) {
    return null;
  }

  return amount * factor;
}

export function servingsFor(amount: number, unit: Unit, food: Food): number | null {
  if (food.servingSize <= 0 || !Number.isFinite(food.servingSize)) {
    return null;
  }

  if (unit === food.servingUnit) {
    return amount / food.servingSize;
  }

  const entryGrams = toGrams(amount, unit);
  const servingGrams = toGrams(food.servingSize, food.servingUnit);
  if (entryGrams === null || servingGrams === null || servingGrams <= 0) {
    return null;
  }

  return entryGrams / servingGrams;
}

export function entryServings(entry: Entry, food: Food): number | null {
  return servingsFor(entry.amount, entry.unit, food);
}
