# M10 — Fuzzy search

## Goal
Both food searches (log-view picker and Foods-view list) match foods when the query is abbreviated, partial, or out of order — and highlight exactly the characters that matched.

## In scope
- Replace the current `name.toLowerCase().includes(query.toLowerCase())` filter in both search inputs with a fuzzy matcher.
- Match modes covered by the same matcher: exact substring, out-of-order multi-token AND (`greek yogurt` → "Yogurt, Greek, plain, nonfat"), prefix. Names and queries are compared by search key (lowercased, diacritics stripped), so `jalapeno` reaches "Jalapeños".
- Show only matches. Empty query continues to show all foods (existing behaviour); a non-empty query with no matches shows an empty list.
- Highlight matched characters in the rendered food name — exactly the typed characters, one highlight position per query character. The log picker (`food-option`) and the Foods-view row name (`food-row-name`) both get the same highlight markup.
- Preserve existing ordering tie-breakers: log-view's "recently used" sort and Foods-view's alphabetical sort still apply *on equal match tier*. Tier is the primary sort; the existing comparator is the tie-breaker.

## Out of scope
- Edit-distance typo correction (transpositions/insertions: `bananna` does **not** match "Banana").
- Searching nutrient text, IDs, or anything other than `food.name`.
- Tuning the match tiers per-user.
- Persisting search history.
- Server-side / cloud search.

## Data
No schema changes. No new domain types. State, persistence, repository: untouched.

Library: **`fzf`** (fzf-for-js, BSD-3-Clause, no transitive deps). Config:

```ts
{
  selector: (f) => f.name,
  match: extendedMatch,        // whitespace-separated terms AND in any order
  casing: 'case-insensitive',  // not smart-case: must agree with the catalog's case-insensitive matcher
  sort: false,                 // we sort ourselves: match tier, then existing comparator
}
```

`extendedMatch` treats whitespace-separated terms as independently fuzzy-matched AND conditions, so natural word order (`greek yogurt`) matches comma-inverted USDA catalog names (`Yogurt, Greek, plain, nonfat`). It also enables fzf query operators (`'exact`, `^prefix`, `suffix$`, `!negate`, `|`) — harmless extras in a food picker. Each query character maps to one matched position, which is what keeps the highlights exact instead of smearing across incidental character runs.

fzf supplies the candidate set and the highlight positions, not the final answer: a candidate is kept only when every query token also reads contiguously in its folded name (plus brand key for a pack row) — the same rule `FoodSourceRepository` matches on, so a catalog search and the picker never disagree about whether a row is a hit.

### Module layout

`src/ui/search.ts` is the fuzzy core — one shape per concept:

```ts
export type FoodMatch<T extends Named = Food> = {
  food: T;
  tier: number;                               // lower tier = stronger match (exact → prefix → word-start → substring → fuzzy)
  indices: ReadonlyArray<readonly [number, number]>;  // matched char ranges into food.name
};

export function fuzzyMatch<T extends Named>(foods: T[], query: string): FoodMatch<T>[];
export function byRank<T extends Named>(tieBreaker: (a: T, b: T) => number): (a: FoodMatch<T>, b: FoodMatch<T>) => number;
export function liveFoods(foods: Food[]): Food[];
export function searchLiveFoods(foods: Food[], query: string, tieBreaker: (a: Food, b: Food) => number): FoodMatch[];
```

- Empty/whitespace query: return one `FoodMatch` per food with `tier = 0` (exact) and `indices = []`. This keeps call sites uniform — they always sort/render a `FoodMatch[]`, never a bare `Food[]`.
- Non-empty query: build a `new Fzf(foods, ...)` and map the result. (Construction is cheap for the picker-sized lists this sees; no caching needed.)
- Returns matches in input order. Tier-based sort is the caller's job, layered on top of their existing comparator.

### Call sites

Both user-food call sites go through `searchLiveFoods`: drop soft-deleted foods, fuzzy-match, then sort by `(tier, caller's comparator)`.

- **`src/ui/search.ts`** — `liveFoods(foods): Food[]` keeps the "exclude deletedAt" rule in one place; reused by `recent.ts`. `byRank(tieBreaker)` lives beside `fuzzyMatch` so the tier-vs-comparator contract stays in one file.
- **`src/ui/recent.ts`** — `compareForLog(state, now): (a: Food, b: Food) => number` returns the recency-then-alpha comparator, the tie-breaker for match tier.
- **`src/ui/view.ts`**:
  - Log picker: `searchLiveFoods(state.foods, query, compareForLog(state, now))`.
  - Foods view: `searchLiveFoods(state.foods, foodsQuery, (a, b) => a.name.localeCompare(b.name))`.
- The Catalog tab (M11) ranks repository hits with `fuzzyMatch` + `byRank` directly, since the catalog has no soft-deleted rows to drop.

### Highlighting

One renderer for both surfaces, in `src/ui/highlight.ts`:

```ts
export function renderHighlighted(name: string, indices: ReadonlyArray<readonly [number, number]>): (string | HTMLElement)[];
```

Returns a flat array of text nodes and `<mark>` elements ready to splat into any parent via `el(..., renderHighlighted(name, m.indices))`. No DOM in `domain/`. Lives in `ui/` because it produces DOM.

## UI sketch

Log-view picker (`food-option`):
```
oats               ── ̲Oats
ba                 ── ̲B̲anana
greek yog          ── ̲G̲r̲e̲e̲k ̲y̲o̲gurt
gy                 ── (empty list)
xyz                ── (empty list)
```

- Matched character spans get `<mark>` tags inside the food name: `<mark>B</mark>anana`.
- `<mark>` styled as accent-colored underline (no background highlight — surface contrast matters).
- The existing `data-testid="food-option"` and `data-testid="food-row-name"` stay on the outer element; the highlight markup is inside.

## Acceptance
1. Typing tokens out of order (`breast chicken`) in either search bar shows "Chicken breast".
2. Every query token must appear contiguously in the name or brand; scattered-letter matches are not offered.
3. Typing `oats` highlights `O`, `a`, `t`, `s` in the rendered name.
4. Typing `xyz` produces an empty list in both search bars.
5. Clearing the search bar restores the full list, in the existing default order (recently-used on log view; alphabetical on Foods view).
6. When two foods tie on match tier, the existing comparator decides their order (a recently-logged food stays above an older one on log view; alphabetical on Foods view).
7. Soft-deleted foods are still excluded from the log-view picker (existing rule); fuzzy ranking happens *after* that filter.
8. Highlight markup is present in the DOM as `<mark>` inside the food name span, with the same testids as before.
9. No regressions in the existing search tests — they were written against the simple substring filter; behaviour for the cases they covered (e.g. `oat` → `Oats`) is preserved.
