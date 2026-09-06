import { NUTRIENTS, NUTRIENT_KEYS } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';
import { scaleNutrition } from '../domain/calc.js';

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

// A recipe card's rows show one serving, so the total is the only place the
// servings count applies and it spells the multiplication out. The count is
// printed exactly, and the calories are the product of the two figures shown
// rather than the rounded exact sum, so the line always multiplies out.
export function formatRecipeTotal(perServing: NutritionFacts, servings: number): string {
  if (servings === 1) {
    return `Total ${formatTotals(perServing)}`;
  }

  const each = Math.round(perServing.calories);
  const scaled = { ...scaleNutrition(perServing, servings), calories: each * servings };
  return `Total ${servings} × ${each} cal each serving = ${formatTotals(scaled)}`;
}
