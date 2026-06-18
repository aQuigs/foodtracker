// Shared so both FoodSourceRepository adapters match identically — the contract
// test asserts parity, and the matcher is the easiest thing to let drift.

export function queryTokens(query: string): string[] {
  const q = query.trim().toLowerCase();
  return q === '' ? [] : q.split(/\s+/);
}

// AND over tokens, each a substring in any order — so "greek yogurt" finds the
// comma-inverted "Yogurt, Greek, plain" that a single contiguous match misses.
export function nameMatchesTokens(nameLower: string, tokens: string[]): boolean {
  return tokens.every((t) => nameLower.includes(t));
}
