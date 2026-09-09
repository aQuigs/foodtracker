import { NUTRIENTS, NUTRIENT_KEYS } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';
import { roundedCalories } from './format.js';
import { formatServings } from './formatServings.js';

export function formatTotals(totals: NutritionFacts): string {
  return NUTRIENT_KEYS.map((k) => {
    const meta = NUTRIENTS[k];
    if (meta.unit === 'cal') {
      return roundedCalories(totals[k]);
    }

    const rounded = Math.round(totals[k] * 10) / 10;
    return `${meta.shortLabel} ${rounded}g`;
  }).join(' · ');
}

// What the card is totalling: the batch it is about to log, and the one serving
// its rows show. The batch is summed from the portions logging will write, not
// scaled up from `perServing`, so the two are the same arithmetic.
export type RecipeTotals = { perServing: NutritionFacts; batch: NutritionFacts; servings: number };

// A recipe calorie figure is rounded exactly once, at display, so the card's
// total is the number the logged group header shows. One serving is still worth
// seeing, but it sits in brackets rather than in an equation a reader would
// expect to multiply out. "Is this one serving?" is decided by the formatted
// count, the same question the group header asks, so a count of 1.004 reads as
// one serving on both surfaces instead of as "1 servings" on this one.
export function formatRecipeTotal({ perServing, batch, servings }: RecipeTotals): string {
  const count = formatServings(servings);
  if (count === '1') {
    return `Total ${formatTotals(batch)}`;
  }

  return `Total for ${count} servings: ${formatTotals(batch)} (${roundedCalories(perServing.calories)} each)`;
}
