import type { Food } from '../domain/types.js';
import { shownFor } from '../domain/units.js';

// The one description of a food's serving, everywhere one is shown.
export function servingText(food: Pick<Food, 'servingSize' | 'servingUnit' | 'pieces'>): string {
  const base = `${food.servingSize} ${food.servingUnit}`;
  if (food.pieces === undefined) {
    return base;
  }

  return `${food.pieces.perServing} ${food.pieces.noun ?? 'count'} · ${base}`;
}

// An entry or portion's amount as shown: its shownAs unit when it has one,
// its stored unit otherwise.
export function amountText(row: Parameters<typeof shownFor>[0]): string {
  const shown = shownFor(row);
  return `${shown.amount} ${shown.unit}`;
}
