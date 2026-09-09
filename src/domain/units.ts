import type { Entry, Food, Unit } from './types.js';

export const AXES = {
  weight: { label: 'weight' },
  count: { label: 'count' },
  volume: { label: 'volume' },
} as const;

export type Axis = keyof typeof AXES;

// A unit's axis decides what it can be measured against: there is no
// conversion between axes, so a food is logged in the units of its own axis
// and nothing else. The gram factor shares the row because only the weight
// axis has one — kept in a second table, the two could drift into a
// conversion the axis rule forbids.
const UNIT_AXIS: Record<Unit, { axis: Axis; grams: number | null }> = {
  g: { axis: 'weight', grams: 1 },
  oz: { axis: 'weight', grams: 28.3495 },
  lb: { axis: 'weight', grams: 453.592 },
  count: { axis: 'count', grams: null },
  ml: { axis: 'volume', grams: null },
};

export const UNITS = Object.keys(UNIT_AXIS) as readonly Unit[];

export function isUnit(u: unknown): u is Unit {
  return typeof u === 'string' && (UNITS as readonly string[]).includes(u);
}

export function axisOf(unit: Unit): Axis {
  return UNIT_AXIS[unit].axis;
}

export function sameAxis(a: Unit, b: Unit): boolean {
  return axisOf(a) === axisOf(b);
}

export function compatibleUnits(food: Food): readonly Unit[] {
  return UNITS.filter((u) => sameAxis(u, food.servingUnit));
}

export function toGrams(amount: number, unit: Unit): number | null {
  const { grams } = UNIT_AXIS[unit];
  if (grams === null) {
    return null;
  }

  return amount * grams;
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
