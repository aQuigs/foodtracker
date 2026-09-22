import type { DisplayUnitKey, Entry, Food, Unit } from './types.js';

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
// an unknown one. shownAs (below) is purely a display overlay on top.
// factor 30: the US nutrition-label rule for 1 fl oz (21 CFR 101.9(b)(5)(viii)).
export const DISPLAY_UNITS: Record<DisplayUnitKey, { stores: Unit; factor: number }> = {
  'fl oz': { stores: 'ml', factor: 30 },
};

const DISPLAY_UNIT_KEYS = Object.keys(DISPLAY_UNITS) as DisplayUnitKey[];

export function isDisplayUnit(u: unknown): u is DisplayUnitKey {
  return typeof u === 'string' && Object.hasOwn(DISPLAY_UNITS, u);
}

// What the log and recipe pickers offer: every compatible real unit, plus
// any display unit whose stored form is one of them.
export type PickerUnit = Unit | DisplayUnitKey;

export function isPickerUnit(u: unknown): u is PickerUnit {
  return isUnit(u) || isDisplayUnit(u);
}

export function compatiblePickerUnits(food: UnitFood): readonly PickerUnit[] {
  const units = compatibleUnits(food);
  const displays = DISPLAY_UNIT_KEYS.filter((d) => units.includes(DISPLAY_UNITS[d].stores));
  return [...units, ...displays];
}

// The full, fixed set a picker's buttons are built from — always painted, so
// the picker's geometry never depends on which food is selected; see
// compatiblePickerUnits for what is enabled per food.
export const PICKER_UNITS: readonly PickerUnit[] = [...UNITS, ...DISPLAY_UNIT_KEYS];

// Four decimals clears float noise from the round trip while staying far
// finer than anything the UI actually displays.
function toDisplayAmount(amount: number, unit: DisplayUnitKey): number {
  return Math.round((amount / DISPLAY_UNITS[unit].factor) * 1e4) / 1e4;
}

// Rounded for the same reason, and because this is what gets stored: a
// build that doesn't know shownAs shows it verbatim, so it must never be a
// jagged float.
function fromDisplayAmount(amount: number, unit: DisplayUnitKey): number {
  return Math.round(amount * DISPLAY_UNITS[unit].factor * 1e4) / 1e4;
}

// What a stored entry or portion should show and be edited as: its own
// shownAs and a converted amount, or its stored unit and amount verbatim
// when it has none (an older row, or one never logged in a display unit).
export function shownFor(row: { amount: number; unit: Unit; shownAs?: DisplayUnitKey }): { amount: number; unit: PickerUnit } {
  if (row.shownAs === undefined) {
    return { amount: row.amount, unit: row.unit };
  }

  return { amount: toDisplayAmount(row.amount, row.shownAs), unit: row.shownAs };
}

// The inverse of shownFor: what a picker's amount + selected unit resolves
// to for storage. A real unit passes through untouched; a display unit
// converts to its stored unit and tags shownAs so it displays the same way
// again next time.
export function resolvePickerAmount(amount: number, unit: PickerUnit): { amount: number; unit: Unit; shownAs?: DisplayUnitKey } {
  if (!isDisplayUnit(unit)) {
    return { amount, unit };
  }

  return { amount: fromDisplayAmount(amount, unit), unit: DISPLAY_UNITS[unit].stores, shownAs: unit };
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

  if (unit === 'count' && food.pieces !== undefined) {
    return amount / food.pieces.perServing;
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

type PortionFood = Pick<Food, 'servingSize' | 'servingUnit' | 'pieces'>;

// One serving of `food`, in the unit defaultUnit(food) would pick — used to
// prefill a new recipe item.
export function defaultPortion(food: PortionFood): { amount: number; unit: Unit } {
  if (food.pieces !== undefined) {
    return { amount: food.pieces.perServing, unit: 'count' };
  }

  return { amount: food.servingSize, unit: food.servingUnit };
}
