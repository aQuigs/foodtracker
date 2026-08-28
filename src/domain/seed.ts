import type { State } from './types.js';

export function freshState(): State {
  return { version: 2, foods: [], meals: [], entries: [] };
}
