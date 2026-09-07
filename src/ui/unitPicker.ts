import type { Unit } from '../domain/types.js';
import { UNITS } from '../domain/units.js';
import { createToggleGroup, type ToggleGroup } from './toggleGroup.js';

export function createUnitPicker(testid: string, ariaLabel: string): ToggleGroup<Unit> {
  return createToggleGroup<Unit>({
    testid, ariaLabel,
    options: UNITS.map((u) => ({ value: u, label: u })),
  });
}
