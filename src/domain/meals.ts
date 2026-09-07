import type { Meal } from './types.js';

export function mealsForDate(meals: Meal[], date: string): Meal[] {
  return meals
    .filter((m) => m.date === date)
    .sort((a, b) => a.position - b.position);
}
