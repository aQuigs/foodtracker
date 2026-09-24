import type { PickerUnit } from '../domain/units.js';

const CHIPS: Record<PickerUnit, number[]> = {
  g:       [50, 100, 150, 200],
  oz:      [1, 2, 4, 8],
  lb:      [0.25, 0.5, 0.75, 1],
  count:   [1, 2, 3, 4],
  ml:      [100, 200, 250, 500],
  'fl oz': [4, 8, 12, 16],
};

const UNIT_NAMES: Record<PickerUnit, { plural: string; singular: string }> = {
  g:       { plural: 'grams',  singular: 'gram' },
  oz:      { plural: 'ounces', singular: 'ounce' },
  lb:      { plural: 'lb',     singular: 'lb' },
  count:   { plural: 'count',  singular: 'count' },
  ml:      { plural: 'ml',     singular: 'ml' },
  'fl oz': { plural: 'fluid ounces', singular: 'fluid ounce' },
};

export function getChipsForUnit(unit: PickerUnit): number[] {
  return CHIPS[unit];
}

export function unitPlural(unit: PickerUnit): string {
  return UNIT_NAMES[unit].plural;
}

export function amountUnitLabel(amount: number, unit: PickerUnit): string {
  const names = UNIT_NAMES[unit];
  return `${amount} ${amount === 1 ? names.singular : names.plural}`;
}
