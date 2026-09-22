import type { Unit } from '../domain/types.js';
import { createToggleGroup, type ToggleGroup } from './toggleGroup.js';

export type UnitPicker<T extends string = Unit> = ToggleGroup<T>;

// units: UNITS for a food's own unit, PICKER_UNITS for logging or a recipe item.
export function createUnitPicker<T extends string>(testid: string, ariaLabel: string, units: readonly T[]): UnitPicker<T> {
  return createToggleGroup<T>({
    testid, ariaLabel,
    options: units.map((u) => ({ value: u, label: u })),
  });
}
