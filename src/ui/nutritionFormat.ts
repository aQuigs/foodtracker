import { NUTRIENTS, NUTRIENT_KEYS } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';
import { scaleNutrition } from '../domain/calc.js';
import { formatServings } from './formatServings.js';

export function formatTotals(totals: NutritionFacts): string {
  return NUTRIENT_KEYS.map((k) => {
    const meta = NUTRIENTS[k];
    if (meta.unit === 'cal') {
      return `${Math.round(totals[k])} cal`;
    }

    const rounded = Math.round(totals[k] * 10) / 10;
    return `${meta.shortLabel} ${rounded}g`;
  }).join(' · ');
}

// A recipe calorie figure is rounded exactly once, at display, from the
// unrounded product, so the card's total is the same number the logged group
// header shows. One serving is still worth seeing, but it sits in brackets
// rather than in an equation a reader would expect to multiply out.
export function formatRecipeTotal(perServing: NutritionFacts, servings: number): string {
  if (servings === 1) {
    return `Total ${formatTotals(perServing)}`;
  }

  const batch = formatTotals(scaleNutrition(perServing, servings));
  return `Total for ${formatServings(servings)} servings: ${batch} (${Math.round(perServing.calories)} cal each)`;
}
