import type { Food } from '../domain/types.js';

// The one description of a food's serving, everywhere one is shown.
export function servingText(food: Pick<Food, 'servingSize' | 'servingUnit' | 'pieces'>): string {
  const base = `${food.servingSize} ${food.servingUnit}`;
  if (food.pieces === undefined) {
    return base;
  }

  return `${food.pieces.perServing} ${food.pieces.noun ?? 'count'} · ${base}`;
}
