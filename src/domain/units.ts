import type { AmountShown, DisplayUnitKey, Entry, Food, PickerUnit, Shown, Unit } from './types.js';

export type { PickerUnit } from './types.js';

export const AXES = {
  weight: { label: 'weight' },
  count: { label: 'count' },
  volume: { label: 'volume' },
} as const;

export type Axis = keyof typeof AXES;

// A unit's axis decides what it can be measured against: there is no
// conversion between axes, so a food is logged in the units of its own axis
// and nothing else — except through a food's own pieces, which bridges its
// axis to count. The gram factor shares the row because only the weight
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

export type UnitFood = Pick<Food, 'servingUnit' | 'pieces'>;
export type ServingFood = Pick<Food, 'servingSize' | 'servingUnit' | 'pieces'>;

export function compatibleUnits(food: UnitFood): readonly Unit[] {
  return UNITS.filter((u) => sameAxis(u, food.servingUnit) || (u === 'count' && food.pieces !== undefined));
}

// 'count' when the food has pieces — the everyday quantity a label with
// pieces is meant to be logged in — else the first unit on the food's own
// axis (g for any weight-axis food, whichever of oz/lb/g it's labeled in).
export function defaultUnit(food: UnitFood): Unit {
  return food.pieces !== undefined ? 'count' : compatibleUnits(food)[0]!;
}

// A stored row stays in a real Unit: older builds sharing the blob reject
// an unknown one. `shown` (types.ts) is a display-only overlay on top.
// factor 30: the US nutrition-label rule for 1 fl oz (21 CFR 101.9(b)(5)(viii)).
export const DISPLAY_UNITS: Record<DisplayUnitKey, { stores: Unit; factor: number }> = {
  'fl oz': { stores: 'ml', factor: 30 },
};

const DISPLAY_UNIT_KEYS = Object.keys(DISPLAY_UNITS) as DisplayUnitKey[];

export function isDisplayUnit(u: unknown): u is DisplayUnitKey {
  return typeof u === 'string' && Object.hasOwn(DISPLAY_UNITS, u);
}

export function isPickerUnit(u: unknown): u is PickerUnit {
  return isUnit(u) || isDisplayUnit(u);
}

export function compatiblePickerUnits(food: UnitFood): readonly PickerUnit[] {
  const units = compatibleUnits(food);
  const displays = DISPLAY_UNIT_KEYS.filter((d) => units.includes(DISPLAY_UNITS[d].stores));
  return [...units, ...displays];
}

// Every unit a picker can offer; compatiblePickerUnits narrows it per food.
export const PICKER_UNITS: readonly PickerUnit[] = [...UNITS, ...DISPLAY_UNIT_KEYS];

// Offered before a food is chosen: no food yet to say whether the volume axis applies.
export const NO_FOOD_PICKER_UNITS: readonly PickerUnit[] = UNITS.filter((u) => axisOf(u) !== 'volume');

// Rounds to significant digits, not decimal places, so a small positive
// amount (e.g. a gram food logged by a tiny count) never rounds to 0 and
// silently vanishes on the next load.
export function roundSig(n: number): number {
  if (n === 0) {
    return 0;
  }

  const factor = 10 ** (6 - Math.ceil(Math.log10(Math.abs(n))));
  return Math.round(n * factor) / factor;
}

// What a stored entry or portion should show and be edited as.
export function shownFor(row: AmountShown): Shown {
  return row.shown ?? { amount: row.amount, unit: row.unit };
}

// Resolves new picker input to a physical amount, keeping what was typed as
// `shown`. Only for input that's genuinely new — an existing row must scale
// from its own frozen amount/shown pair instead (see scalePortion), or a
// later pieces edit would silently rewrite it.
export function resolvePickerAmount(amount: number, unit: PickerUnit, food: ServingFood): AmountShown {
  if (isDisplayUnit(unit)) {
    const physical = roundSig(amount * DISPLAY_UNITS[unit].factor);
    return { amount: physical, unit: DISPLAY_UNITS[unit].stores, shown: { amount, unit } };
  }

  if (unit === 'count' && food.pieces !== undefined) {
    const physical = roundSig(amount * food.servingSize / food.pieces.perServing);
    return { amount: physical, unit: food.servingUnit, shown: { amount, unit } };
  }

  return { amount, unit };
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

// One serving of `food`, in the unit defaultUnit(food) would pick — used to
// prefill a new recipe item.
export function defaultPortion(food: ServingFood): { amount: number; unit: Unit } {
  if (food.pieces !== undefined) {
    return { amount: food.pieces.perServing, unit: 'count' };
  }

  return { amount: food.servingSize, unit: food.servingUnit };
}
