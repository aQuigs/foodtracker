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

// Mirrors the IndexedDB by-name-key index exactly: it walks in UTF-16
// code-unit order with primary-key (id) tie-breaks, so both adapters must
// sort hits identically.
export function compareSearchHits(aKey: string, aId: string, bKey: string, bId: string): number {
  if (aKey !== bKey) {
    return aKey < bKey ? -1 : 1;
  }

  return aId < bId ? -1 : aId > bId ? 1 : 0;
}
