import type { Unit } from '../domain/types.js';

const CHIPS: Record<Unit, number[]> = {
  g:     [50, 100, 150, 200],
  oz:    [1, 2, 4, 8],
  lb:    [0.25, 0.5, 0.75, 1],
  count: [1, 2, 3, 4],
};

export function getChipsForUnit(unit: Unit): number[] {
  return CHIPS[unit];
}
