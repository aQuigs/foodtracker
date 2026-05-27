# M9 — Typo-tolerant fuzzy search

## Goal
Both food searches (log-view picker and Foods-view list) match foods even when the query is mistyped, abbreviated, or out of order — and visibly show which characters matched.

## In scope
- Replace the current `name.toLowerCase().includes(query.toLowerCase())` filter in both search inputs with a fuzzy matcher.
- Match modes covered by the same matcher: exact substring, transposed/dropped/extra letters (edit distance ≤ ~2), out-of-order tokens, initials (`gy` → "Greek yogurt"), prefix.
- Show only matches. Empty query continues to show all foods (existing behaviour); a non-empty query with no matches shows an empty list.
- Highlight matched characters in the rendered food name. The log picker (`food-option`) and the Foods-view row name (`food-row-name`) both get the same highlight markup.
- Preserve existing ordering tie-breakers: log-view's "recently used" sort and Foods-view's alphabetical sort still apply *on equal fuzzy score*. Score is the primary sort; the existing comparator is the tie-breaker.

## Out of scope
- Searching nutrient text, IDs, or anything other than `food.name`.
- Tuning the score threshold per-user.
- Persisting search history.
- Server-side / cloud search.

## Data
No schema changes. No new domain types. State, persistence, repository: untouched.

Library: **`fuse.js`** (~10 KB gzipped, MIT, no transitive deps). Config:

```ts
{
  keys: ['name'],
  includeScore: true,
  includeMatches: true,
  threshold: 0.4,          // 0 = exact, 1 = anything
  ignoreLocation: true,    // match anywhere, not just near the start
  minMatchCharLength: 1,
  shouldSort: false,       // we sort ourselves: score asc, then existing comparator
}
```

### Module layout

Refactor `src/ui/search.ts` (currently substring-only) into the fuzzy core. One module, two exports — one shape per concept:

```ts
export type FoodMatch = {
  food: Food;
  score: number;                              // 0 = perfect; higher = worse
  indices: ReadonlyArray<readonly [number, number]>;  // matched char ranges into food.name
};

export function fuzzyMatch(foods: Food[], query: string): FoodMatch[];
```

- Empty/whitespace query: return one `FoodMatch` per food with `score = 0` and `indices = []`. This keeps call sites uniform — they always sort/render a `FoodMatch[]`, never a bare `Food[]`.
- Non-empty query: build a `new Fuse(foods, FUSE_OPTIONS)` and map the result. (Fuse construction is cheap for <100 entries; no caching needed.)
- Returns matches in input order. Score-based sort is the caller's job, layered on top of their existing comparator.

### Call sites

Both call sites already filter, then sort. They become: fuzzy-match, then sort by `(score, existing-comparator)`.

- **`src/ui/recent.ts`** — `sortFoodsForLog(state, now)` currently filters out deleted and sorts by recency. Refactor into two pieces:
  - `liveFoods(state): Food[]` — keeps the "exclude deletedAt" rule in one place; reused by Foods view.
  - `compareForLog(a, b, state, now): number` — the existing recency-then-alpha comparator, exposed as a function so it can be a tie-breaker for fuzzy score.
- **`src/ui/view.ts`**:
  - Log picker: `fuzzyMatch(liveFoods(state), query).sort(byScoreThen(compareForLog))`.
  - Foods view: `fuzzyMatch(state.foods, query).sort(byScoreThen(compareAlpha))`.
- `byScoreThen(tieBreaker)` is one tiny helper inside `search.ts` so the score-vs-comparator contract lives next to `fuzzyMatch`.

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
ba                 ── ̲B̲anana, ̲Br̲occoli
gy                 ── ̲Greek ̲yogurt
chk brst           ── ̲C̲hi̲c̲ken ̲br̲ea̲s̲t
xyz                ── (empty list)
```

- Matched character spans get `<mark>` tags inside the food name: `<mark>B</mark>anana`.
- `<mark>` styled as accent-colored underline (no background highlight — surface contrast matters).
- The existing `data-testid="food-option"` and `data-testid="food-row-name"` stay on the outer element; the highlight markup is inside.

## Acceptance
1. Typing `bananna` (transposed/extra letter) in either search bar shows Banana in the results.
2. Typing `gy` shows "Greek yogurt".
3. Typing `chk brst` shows "Chicken breast".
4. Typing `oats` highlights `O`, `a`, `t`, `s` in the rendered name.
5. Typing `xyz` produces an empty list in both search bars.
6. Clearing the search bar restores the full list, in the existing default order (recently-used on log view; alphabetical on Foods view).
7. When two foods tie on fuzzy score, the existing comparator decides their order (a recently-logged food stays above an older one on log view; alphabetical on Foods view).
8. Soft-deleted foods are still excluded from the log-view picker (existing rule); fuzzy ranking happens *after* that filter.
9. Highlight markup is present in the DOM as `<mark>` inside the food name span, with the same testids as before.
10. No regressions in the existing search tests — they were written against the simple substring filter; behaviour for the cases they covered (e.g. `oat` → `Oats`) is preserved.
