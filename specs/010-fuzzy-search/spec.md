# M10 — Fuzzy search

## Goal
Both food searches (log-view picker and Foods-view list) match foods when the query is abbreviated, partial, or out of order — and highlight exactly the characters that matched.

## In scope
- Replace the current `name.toLowerCase().includes(query.toLowerCase())` filter in both search inputs with a fuzzy matcher.
- Match modes covered by the same matcher: exact substring, dropped letters (subsequence, `chiken` → "Chicken"), out-of-order multi-token AND (`greek yogurt` → "Yogurt, Greek, plain, nonfat"), initials (`gy` → "Greek yogurt"), prefix.
- Show only matches. Empty query continues to show all foods (existing behaviour); a non-empty query with no matches shows an empty list.
- Highlight matched characters in the rendered food name — exactly the typed characters, one highlight position per query character. The log picker (`food-option`) and the Foods-view row name (`food-row-name`) both get the same highlight markup.
- Preserve existing ordering tie-breakers: log-view's "recently used" sort and Foods-view's alphabetical sort still apply *on equal fuzzy score*. Score is the primary sort; the existing comparator is the tie-breaker.

## Out of scope
- Edit-distance typo correction (transpositions/insertions: `bananna` does **not** match "Banana"). Subsequence matching with exact-character highlights was chosen over edit-distance matching with noisy highlights; dropped-letter typos still match.
- Searching nutrient text, IDs, or anything other than `food.name`.
- Tuning the score threshold per-user.
- Persisting search history.
- Server-side / cloud search.

## Data
No schema changes. No new domain types. State, persistence, repository: untouched.

Library: **`fzf`** (fzf-for-js, MIT, no transitive deps). Config:

```ts
{
  selector: (f) => f.name,
  match: extendedMatch,        // whitespace-separated terms AND in any order
  casing: 'case-insensitive',  // not smart-case: must agree with the catalog's case-insensitive matcher
  sort: false,                 // we sort ourselves: score (negated, asc), then existing comparator
}
```

`extendedMatch` treats whitespace-separated terms as independently fuzzy-matched AND conditions, so natural word order (`greek yogurt`) matches comma-inverted USDA catalog names (`Yogurt, Greek, plain, nonfat`). It also enables fzf query operators (`'exact`, `^prefix`, `suffix$`, `!negate`, `|`) — harmless extras in a food picker. Each query character maps to one matched position, which is what keeps the highlights exact instead of smearing across incidental character runs.

### Module layout

Refactor `src/ui/search.ts` (currently substring-only) into the fuzzy core. One module, two exports — one shape per concept:

```ts
export type FoodMatch<T extends Named = Food> = {
  food: T;
  score: number;                              // lower = better (fzf score, negated)
  indices: ReadonlyArray<readonly [number, number]>;  // matched char ranges into food.name
};

export function fuzzyMatch<T extends Named>(foods: T[], query: string): FoodMatch<T>[];
```

- Empty/whitespace query: return one `FoodMatch` per food with `score = 0` and `indices = []`. This keeps call sites uniform — they always sort/render a `FoodMatch[]`, never a bare `Food[]`.
- Non-empty query: build a `new Fzf(foods, ...)` and map the result. (Construction is cheap for the picker-sized lists this sees; no caching needed.)
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
1. Typing `chiken` (dropped letter) in either search bar shows "Chicken breast"; typing tokens out of order (`breast chicken`) also shows it.
2. Typing `gy` shows "Greek yogurt".
3. Typing `chk brst` shows "Chicken breast", with the space not highlighted.
4. Typing `oats` highlights `O`, `a`, `t`, `s` in the rendered name.
5. Typing `xyz` produces an empty list in both search bars.
6. Clearing the search bar restores the full list, in the existing default order (recently-used on log view; alphabetical on Foods view).
7. When two foods tie on fuzzy score, the existing comparator decides their order (a recently-logged food stays above an older one on log view; alphabetical on Foods view).
8. Soft-deleted foods are still excluded from the log-view picker (existing rule); fuzzy ranking happens *after* that filter.
9. Highlight markup is present in the DOM as `<mark>` inside the food name span, with the same testids as before.
10. No regressions in the existing search tests — they were written against the simple substring filter; behaviour for the cases they covered (e.g. `oat` → `Oats`) is preserved.
