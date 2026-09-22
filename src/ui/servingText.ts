import type { AmountShown } from '../domain/types.js';
import { shownFor, type ServingFood } from '../domain/units.js';

// The one description of a food's serving, everywhere one is shown.
export function servingText(food: ServingFood): string {
  const base = `${food.servingSize} ${food.servingUnit}`;
  if (food.pieces === undefined) {
    return base;
  }

  return `${food.pieces.perServing} ${food.pieces.noun ?? 'count'} · ${base}`;
}

export function amountText(row: AmountShown): string {
  const shown = shownFor(row);
  return `${shown.amount} ${shown.unit}`;
}
