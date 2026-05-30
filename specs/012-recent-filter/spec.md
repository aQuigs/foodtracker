# M12 — Filter picker to recent foods only

## Goal
Add a one-tap mode to the log-view picker that restricts results to the user's own foods, skipping the [M11 USDA catalog](../011-external-food-db/spec.md). The catalog holds ~16k items; the user's own foods are a small recurring set. A repeat-log of a known food shouldn't have to disambiguate against a noisy catalog.

## In scope
- A checkbox control adjacent to the log-view search input. Default off (`unchecked`).
- Label: **"My foods only"**. Reads correctly both with and without a query; "recent" alone misleads when the box is checked but the user has never logged anything.
- Placement: same row as the search input, to its right. Wraps below on narrow viewports. Co-locating with the input makes the mode visible at the moment of typing, and on a phone-width layout a row above the input pushes the picker further off-screen.
- When checked:
  - Search input `placeholder` switches to `"Filter my foods"` (from `"Search food database"`).
  - Empty query → picker shows every live entry in `state.foods` ordered by `compareForLog` (most-recently-logged first, alphabetical tie-break). No "Recently used foods will show up here." hint.
  - Non-empty query → picker shows `fuzzyMatch` over `state.foods` only, sorted by score then `compareForLog`. Catalog never queried.
  - `SearchOptions.sources = []` is passed to any incidental catalog call so the catalog adapter contributes nothing even if invoked.
- When unchecked (default): existing M11 behaviour. Empty query → empty picker plus the "Recently used foods will show up here." hint. Non-empty query → merged user + catalog results.
- State lives in app memory only — same scope as `query`, `selectedFoodId`, `amount`. Switching to the Foods view, switching back, or reloading the page resets it to off.
- Checkbox is keyboard-accessible: real `<input type="checkbox">` inside a `<label>`, so Tab focuses it and Space toggles it. The visible label text is the click target. `aria-controls` points at the picker `ul` so screen readers associate the toggle with what it filters.

## Out of scope
- Persisting the checkbox state across reloads or view switches.
- A distinct empty-state message for "My foods only" mode when `state.foods` is empty. The existing "Recently used foods will show up here." copy covers both modes; the checked-empty case shows the same line (or nothing — pick whichever falls out of the picker code cleanly).
- Filtering by other source partitions beyond user-vs-catalog (e.g. pantry, restaurant menus). Those land with the sources that introduce them.
- Filtering by axes other than source: date range, meal, macro, tag.
- Foods-view search. M12 only affects the log-view picker.
- Replacing the checkbox with a segmented control / toggle button. A checkbox is the smallest affordance that matches a binary state; a segmented control would imply more modes than exist.

## Data
No domain or persistence change. No new types, no migration. The flag is a single `boolean` in `createApp`'s closure state, alongside the other UI-only locals (`query`, `amount`, `selectedFoodId`, `logUnit`, `expandedDetail`).

Search wiring change in `src/app.ts`:
- New local `let recentOnly = false;`. Reset to `false` in `resetTransient`.
- `refreshSearchResults` branches on `recentOnly`:
  - `recentOnly === true`: compute the user list via `userPickerOrder(state.foods, query, compareForLog(state, clock.now()))` and **skip** the `catalog.search` branch. If `query` is empty, `userPickerOrder` already returns the live foods sorted by `compareForLog` — reuse it; don't introduce a parallel path.
  - `recentOnly === false`: existing path (user + merged catalog).
- New `ViewHandlers.onRecentOnlyChange: (next: boolean) => void` that updates the flag and calls `refreshSearchResults`.

`SearchOptions.sources = []` is the contract with the catalog: an empty array means "no sources." The repository already accepts the option per M11; no interface change. If the wiring opts to simply skip `catalog.search` when `recentOnly` is on, the `sources: []` path stays exercised by a unit test against the repo so the contract doesn't bit-rot.

## UI sketch

```
┌──────────────────────────────────────────────────────────────┐
│  [ Search food database…                ]  [ ] My foods only │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Recently used foods will show up here.                  │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Checked, empty query:
```
┌──────────────────────────────────────────────────────────────┐
│  [ Filter my foods…                      ]  [x] My foods only│
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Greek yogurt                                            │ │
│  │  Banana                                                  │ │
│  │  Oats                                                    │ │
│  │  …                                                       │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Checked, query "ban":
```
┌──────────────────────────────────────────────────────────────┐
│  [ ban                                  ]  [x] My foods only │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Banana                                                  │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Narrow viewport: checkbox wraps to its own line under the input. Same row order, no reorder.

## Acceptance
1. Checkbox renders on the log view next to the search input with label "My foods only" and `data-testid="recent-only-toggle"`. Default unchecked.
2. With the box unchecked and an empty query, the picker shows the existing hint row "Recently used foods will show up here." — no behavioural change from M11.
3. With the box unchecked and a non-empty query, the picker shows the merged user + catalog results (existing M11 behaviour).
4. Checking the box with an empty query lists every live `state.foods` entry, ordered by `compareForLog` (most-recently-logged first; alphabetical tie-break for never-logged foods).
5. Checking the box with a non-empty query lists only `state.foods` entries that fuzzy-match the query, sorted by fuzzy score then `compareForLog`. No catalog item appears.
6. While the box is checked, the search input's `placeholder` reads `"Filter my foods"`. Unchecked, it reads `"Search food database"`.
7. Toggling the box does not clear the query; `searchResults` re-computes from the current query against the new source set.
8. Switching to the Foods view and back resets the box to unchecked. Reloading the page resets it to unchecked.
9. Keyboard: Tab from the search input lands on the checkbox; Space toggles it; focus stays on the checkbox after toggle.
10. A unit test asserts that with `recentOnly === true` the catalog adapter's `search` is not invoked (or is invoked with `sources: []` and returns no items) regardless of query content.
11. With `state.foods` empty and the box checked, the picker renders an empty list (or the existing hint row — whichever falls out of the unchanged picker code). No new copy is introduced.
12. No change to persisted state. `localStorage` blob version stays at its current value; the M11 `FoodSourceRepository` and IndexedDB partitions are untouched.
