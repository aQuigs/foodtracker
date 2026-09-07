// The one form every search path compares names in: lowercased, diacritics
// stripped, punctuation folded to a single space. "jalapeno" reaches
// "Jalapeños", "crème" reaches "Oatmeal creme pie", "peanut-butter" reaches
// "Peanut butter". Letters with no decomposition (ø, ß, æ) fold to
// themselves; no shipped name carries one.
//
// Persisted as the IndexedDB `name_key` index: changing this recipe needs a
// SCHEMA_VERSION bump in indexedDbFoodSource.ts so cached keys are rebuilt.
export function searchKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function queryTokens(query: string): string[] {
  const q = searchKey(query);
  return q === '' ? [] : q.split(/\s+/);
}

// AND over tokens, each a substring in any order — so "greek yogurt" finds the
// comma-inverted "Yogurt, Greek, plain" that a single contiguous match misses.
export function nameMatchesTokens(nameKey: string, tokens: string[]): boolean {
  return tokens.every((t) => nameKey.includes(t));
}
