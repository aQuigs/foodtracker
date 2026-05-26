import type { Meal, State } from './types.js';

export function mealsForDate(state: State, date: string): Meal[] {
  return state.meals
    .filter((m) => m.date === date)
    .sort((a, b) => a.position - b.position);
}
