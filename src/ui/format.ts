import { NUTRIENTS } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';
import { localDate } from '../domain/date.js';

export function formatIsoDate(date: string, opts: Intl.DateTimeFormatOptions): string {
  return localDate(date).toLocaleDateString('en-US', opts);
}

export function roundedCalories(calories: number): string {
  return `${Math.round(calories)} cal`;
}

export function roundedPct(pct: number): string {
  return `${Math.round(pct)}%`;
}

// Day totals are big enough that a tenth of a gram is noise, so the summary
// rounds where a single food's detail row does not.
export function roundedNutrient(key: keyof NutritionFacts, value: number): string {
  return `${Math.round(value)} ${NUTRIENTS[key].unit}`;
}

export function formatNutrient(key: keyof NutritionFacts, value: number): string {
  const meta = NUTRIENTS[key];
  const factor = 10 ** meta.decimals;
  const rounded = Math.round(value * factor) / factor;
  return `${rounded} ${meta.unit}`;
}
