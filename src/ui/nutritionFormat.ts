import { NUTRIENTS, NUTRIENT_KEYS, macroSharePct } from '../domain/types.js';
import type { MacroDisplay, NutritionFacts } from '../domain/types.js';
import { roundedCalories, roundedPct } from './format.js';
import { formatServings } from './formatServings.js';

// Calories always print as roundedCalories; a macro's text is left to the
// caller, so grams and percent share one pass over NUTRIENT_KEYS.
function formatWithMacroText(totals: NutritionFacts, macroText: (key: keyof NutritionFacts) => string): string {
  return NUTRIENT_KEYS.map((k) => (NUTRIENTS[k].unit === 'cal' ? roundedCalories(totals[k]) : macroText(k)))
    .join(' · ');
}

export function formatTotals(totals: NutritionFacts): string {
  return formatWithMacroText(totals, (k) => {
    const rounded = Math.round(totals[k] * 10) / 10;
    return `${NUTRIENTS[k].shortLabel} ${rounded}g`;
  });
}

// Each macro prints its share of macro calories (macroSharePct); 0% when
// there are none to share, an empty meal or one of nothing but water.
export function formatTotalsPercent(totals: NutritionFacts): string {
  const pcts = macroSharePct(totals);
  return formatWithMacroText(totals, (k) => `${NUTRIENTS[k].shortLabel} ${roundedPct(pcts[k] ?? 0)}`);
}

// A meal header's display mode picks its formatter here, not by comparing
// mealMacros to a literal at the call site — a new MacroDisplay value is a
// compile error until it gets an entry.
export const TOTALS_FORMATTERS: Record<MacroDisplay, (totals: NutritionFacts) => string> = {
  grams: formatTotals,
  percent: formatTotalsPercent,
};

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
