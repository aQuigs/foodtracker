import type { Unit } from '../domain/types.js';

const CHIPS: Record<Unit, number[]> = {
  g:     [50, 100, 150, 200],
  oz:    [1, 2, 4, 8],
  lb:    [0.25, 0.5, 0.75, 1],
  count: [1, 2, 3, 4],
};

const UNIT_NAMES: Record<Unit, { plural: string; singular: string }> = {
  g:     { plural: 'grams',  singular: 'gram' },
  oz:    { plural: 'ounces', singular: 'ounce' },
  lb:    { plural: 'lb',     singular: 'lb' },
  count: { plural: 'count',  singular: 'count' },
};

export function getChipsForUnit(unit: Unit): number[] {
  return CHIPS[unit];
}

export function unitPlural(unit: Unit): string {
  return UNIT_NAMES[unit].plural;
}

export function amountUnitLabel(amount: number, unit: Unit): string {
  const names = UNIT_NAMES[unit];
  return `${amount} ${amount === 1 ? names.singular : names.plural}`;
}
