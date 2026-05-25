# M3 — Custom foods

## Goal
Add, edit, and soft-delete custom foods. Recently used foods bubble up on the log screen. Export and import the full state as JSON.

## In scope
- A "Foods" view toggle in the header
- Foods view: list all live (non-soft-deleted) foods, search by name, add new food, edit existing food, soft-delete a food
- Soft-deleted foods no longer appear in the log-screen picker but historical entries that reference them still display
- "Recently used" sort on the log screen — foods used in the last 30 days are shown first when the search query is empty
- JSON export — copy current state to clipboard / download
- JSON import — paste state and replace, with validation; corrupt input shows an error and changes nothing

## Out of scope
- Editing the per-entry grams (still requires delete + re-log)
- Restoring a soft-deleted food
- Multiple food categories or tags
- Per-meal grouping
- Cloud sync

## Data
New domain actions:
- `AddFood` with payload `{ food: Food }` — appends to `state.foods`, rejects duplicate id, rejects invalid nutrition
- `EditFood` with `{ foodId: string, updates: Partial<Pick<Food, 'name' | 'nutritionFacts'>> }` — patches the food in place, rejects unknown id, rejects invalid nutrition, rejects empty updates
- `SoftDeleteFood` with `{ foodId: string, deletedAt: string }` — sets `deletedAt`, rejects unknown id, no-op on already-deleted
- `ReplaceState` with `{ state: State }` — wholesale replacement; the persistence validator already enforces shape, so the reducer is a setter

No schema changes — `Food.deletedAt` and `createdAt` were always present.

## UI sketch

```
┌──────────────────────────────────────────┐
│ Food Tracker     [Log]  [Foods]          │  view toggle
├──────────────────────────────────────────┤
│ (Log view: M1b/M2 as-is, with recently   │
│  used sorted to top when query empty)    │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Food Tracker     [Log]  [Foods]          │
├──────────────────────────────────────────┤
│ [ Search foods... ]                      │
│                                          │
│ + Add new food                           │
│ ─── form (name, cal/p/c/f per 100g) ──── │
│                                          │
│ • Banana             89 cal   [edit][×]  │
│ • Oats              379 cal   [edit][×]  │
│   ...                                    │
├──────────────────────────────────────────┤
│ [Export JSON]  [Import JSON]             │
└──────────────────────────────────────────┘
```

## Acceptance
**Reducer (pure):**
1. `AddFood` appends a food with a unique id; duplicate id → state unchanged
2. `AddFood` rejects negative/NaN/non-finite nutrition values → state unchanged
3. `EditFood` patches name and nutrition fields on a live food
4. `EditFood` is a no-op on unknown id, soft-deleted food, or invalid nutrition
5. `SoftDeleteFood` sets `deletedAt` on a live food
6. `SoftDeleteFood` is a no-op when the food is already soft-deleted, or id is unknown
7. `ReplaceState` swaps the entire state

**UI (Foods view):**
8. Toggle between Log and Foods views
9. Foods view shows only live (non-deleted) foods, sorted alphabetically
10. Add form validates required fields and non-negative nutrition; invalid → visible error, no state change
11. Edit button populates the form with the food's current values; save dispatches `EditFood`
12. Soft-delete (×) removes the food from the list (Foods view) and from the Log picker
13. A soft-deleted food's historical entries still render (M1a behaviour locked, now verified end-to-end)
13a. Foods view has a case-insensitive substring search that filters the list independently of the log view

**Log view changes:**
14. With empty search query, foods used at least once in the last 30 days are listed first, sorted by most-recent use; the rest follow alphabetically

**Import/export:**
15. Export produces a string that, when fed back into Import, restores the same state
16. Import rejects invalid JSON, wrong schema, or missing required fields → visible error, no state change
17. Successful import replaces state, persists, and re-renders both views

## Notes
- Soft-delete is `deletedAt: string | null`; setting it to a timestamp removes the food from active surfaces but keeps `Entry.foodId` references valid.
- "Recently used" lookup: scan `state.entries` for entries with `loggedAt` within the last 30 days (relative to `clock.now()`), collect the foodIds, and sort foods by the most recent `loggedAt` per foodId. Tie-break alphabetically.
- Import is a single-textarea paste-and-apply for M3. Drag-and-drop / file upload is out of scope.
- Clipboard write uses `navigator.clipboard.writeText`; export also exposes the raw text in a textarea as a fallback for browsers without the API or when permission is denied.
