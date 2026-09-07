import { isPosFinite } from '../domain/validate.js';

// The one rule for a typed amount, serving size or servings count: a
// finite number above 0, or nothing. Blank text parses to 0 and so is nothing.
export function parsePositive(text: string): number | null {
  const n = Number(text.trim());
  return isPosFinite(n) ? n : null;
}
