// Shared so both FoodSourceRepository adapters match identically — the contract
// test asserts parity, and the matcher is the easiest thing to let drift.

import { searchKey } from '../domain/searchKey.js';

export function queryTokens(query: string): string[] {
  const q = searchKey(query).trim();
  return q === '' ? [] : q.split(/\s+/);
}

// AND over tokens, each a substring in any order — so "greek yogurt" finds the
// comma-inverted "Yogurt, Greek, plain" that a single contiguous match misses.
export function nameMatchesTokens(nameKey: string, tokens: string[]): boolean {
  return tokens.every((t) => nameKey.includes(t));
}
