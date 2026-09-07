// Mirrors the IndexedDB by-name-key index exactly: it walks in UTF-16
// code-unit order with primary-key (id) tie-breaks, so both
// FoodSourceRepository adapters must sort hits identically — the contract test
// asserts parity, and ordering is the easiest thing to let drift. The key
// recipe and the token rule they share live in domain (brandedSearchKey,
// nameMatchesTokens), where the search UI reads them too.

export function compareSearchHits(aKey: string, aId: string, bKey: string, bId: string): number {
  if (aKey !== bKey) {
    return aKey < bKey ? -1 : 1;
  }

  return aId < bId ? -1 : aId > bId ? 1 : 0;
}
