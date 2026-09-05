// Shared so both FoodSourceRepository adapters match identically — the contract
// test asserts parity, and the matcher is the easiest thing to let drift.

import { searchKey } from '../domain/searchKey.js';
import { brandSearchKey } from '../domain/foodSources.js';
import type { SourcedFood } from '../domain/types.js';

export function queryTokens(query: string): string[] {
  const q = searchKey(query).trim();
  return q === '' ? [] : q.split(/\s+/);
}

// What a repository indexes and matches on: the folded name, plus the pack's
// punctuation-collapsed brand key for a brand source. brandSearchKey (not
// searchKey on the raw label) so "Sam's Club" is findable as "sams club"
// rather than folding to "sam s club".
export function sourcedSearchKey(food: SourcedFood): string {
  const brandKey = brandSearchKey(food.source);
  const nameKey = searchKey(food.name);
  // Falsy, not just non-null: a label that folds to nothing (all punctuation)
  // must not leave a trailing space in the key.
  return brandKey ? `${nameKey} ${brandKey}` : nameKey;
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
