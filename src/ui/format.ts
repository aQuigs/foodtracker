import { NUTRIENTS } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';

export function roundedCalories(calories: number): string {
  return `${Math.round(calories)} cal`;
}

export function formatNutrient(key: keyof NutritionFacts, value: number): string {
  const meta = NUTRIENTS[key];
  const factor = 10 ** meta.decimals;
  const rounded = Math.round(value * factor) / factor;
  return `${rounded} ${meta.unit}`;
}
