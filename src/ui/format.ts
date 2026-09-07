import { NUTRIENTS } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';
import { localDate } from '../domain/date.js';

export function formatIsoDate(date: string, opts: Intl.DateTimeFormatOptions): string {
  return localDate(date).toLocaleDateString('en-US', opts);
}

// Fixed locale: the UI ships in English, so grouping must not follow the visitor's locale.
const INTEGER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatInteger(n: number): string {
  return INTEGER_FORMAT.format(n);
}

export function roundedCalories(calories: number): string {
  return `${formatInteger(calories)} cal`;
}

export function roundedPct(pct: number): string {
  return `${Math.round(pct)}%`;
}

export function formatNutrient(key: keyof NutritionFacts, value: number): string {
  const meta = NUTRIENTS[key];
  if (meta.unit === 'cal') {
    return roundedCalories(value);
  }

  const factor = 10 ** meta.decimals;
  const rounded = Math.round(value * factor) / factor;
  return `${rounded} ${meta.unit}`;
}
