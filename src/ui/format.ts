import { NUTRIENTS } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';
import { localDate, shiftDate } from '../domain/date.js';

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

// Day totals are big enough that a tenth of a gram is noise, so the summary
// rounds where a single food's detail row does not.
export function roundedNutrient(key: keyof NutritionFacts, value: number): string {
  return `${Math.round(value)} ${NUTRIENTS[key].unit}`;
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

export function dateLabel(iso: string, today: string): string {
  if (iso === today) {
    return 'Today';
  }

  if (iso === shiftDate(today, -1)) {
    return 'Yesterday';
  }

  return formatIsoDate(iso, { weekday: 'short', month: 'short', day: 'numeric' });
}
