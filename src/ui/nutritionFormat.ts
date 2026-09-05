import { NUTRIENTS, NUTRIENT_KEYS } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';

export function formatMealHeaderTotal(totals: NutritionFacts): string {
  return NUTRIENT_KEYS.map((k) => {
    const meta = NUTRIENTS[k];
    if (meta.unit === 'cal') {
      return `${Math.round(totals[k])} cal`;
    }

    const rounded = Math.round(totals[k] * 10) / 10;
    return `${meta.shortLabel} ${rounded}g`;
  }).join(' · ');
}
