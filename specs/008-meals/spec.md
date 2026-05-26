# M7 — Ordered meals per day

## Goal
Group a day's entries into an ordered list of meals so calories/macros can be read per meal.

## In scope
- Each day owns an ordered list of meals. Every entry references exactly one meal.
- Meals are auto-named "Meal {N}" where N is `position + 1` within the day. Not renameable.
- "New meal" button below the entry list, always enabled. Appends a new latest meal for the selected date.
- New logs always go into the **latest** meal of the selected date.
- A fresh day shows a single empty "Meal 1" header so the first log has a visible target. That header is purely visual until the first log materializes the Meal record.
- Per-meal header shows full macros (cal + P/C/F). Day total stays at the bottom and sums all meals.
- Persistence: bump `version` 1→2. One-way migration on read: each distinct `entry.date` gets one synthetic Meal at position 0; every entry on that date gets `mealId` set to it.

## Out of scope
- Renaming meals.
- Reordering meals.
- Deleting a meal directly (no UI control); meals get garbage-collected only as a side effect of deleting their last entry (see Data).
- Moving entries between meals.
- Meal templates (Breakfast / Lunch / …).

## Data

```ts
type Meal = {
  id: string;
  date: string;
  position: number;
};

type Entry = {
  // ...existing fields
  mealId: string;
};

type State = {
  version: 2;
  foods: Food[];
  meals: Meal[];
  entries: Entry[];
};
```

**Reducer invariants (enforced in `domain/reducer.ts`):**
- `LogEntry`: if no meals exist for `entry.date`, create one at position 0 first; then set `entry.mealId` to the latest meal of that date.
- `NewMeal({ date })`: append a Meal at position `max(positions for that date) + 1`. Idempotency not needed — the UI button always creates one.
- `DeleteEntry`: after removing the entry, if the entry's meal now has zero entries AND there exists a meal with a higher position for the same date, delete the empty meal too. (The latest meal can be empty; only non-latest meals get GC'd.)
- The view layer never creates meals directly; LogEntry handles the "first log materializes the Meal" case.

**Render-only state for empty day:** when `meals.filter(m => m.date === selectedDate)` is empty, the entry list shows a placeholder "Meal 1" header but no Meal record exists yet. The first LogEntry on that date creates the actual Meal.

**Calc:** `mealTotals(state, mealId): NutritionFacts` sums `entryNutrition` over entries with that mealId. Reuses existing `entryNutrition`. No new primitives.

## UI sketch

```
─── Meal 1 ──────────────  450 cal · P 30g · C 60g · F 12g ───
Banana   120 g   107 cal              ×
Oats      50 g   190 cal              ×
─── Meal 2 ──────────────  310 cal · P 26g · C  1g · F 22g ───
Egg     2 count   156 cal              ×
Chicken  60 g     154 cal              ×

[ + New meal ]

─── Day total ───────────  760 cal · P 56g · C 61g · F 34g ───
```

Fresh day (no meals or entries yet) shows the placeholder Meal 1:

```
─── Meal 1 ──────────────  0 cal · P 0g · C 0g · F 0g ───

[ + New meal ]

─── Day total ───────────  0 cal · P 0g · C 0g · F 0g ───
```

Day total uses the existing `dailyTotals` (unchanged).

## Acceptance
1. Fresh day with no logs shows "Meal 1" header + New meal button.
2. Logging an entry on a fresh day creates Meal 1 (in state) and assigns the entry to it. Header still reads "Meal 1".
3. "New meal" appends "Meal {N+1}" with empty subtotals; the button stays present after creation.
4. After "New meal", the next log goes into the just-created meal.
5. Each meal header shows its own cal + P/C/F totals; values match the sum of `entryNutrition` over its entries.
6. Day total row sums every meal exactly (no rounding drift from per-meal display rounding — totals are recomputed from raw entries).
7. Deleting the last entry from a **non-latest** meal removes that meal's header; entries above and below close up; remaining meals keep contiguous "Meal N" numbering by position.
8. Deleting the last entry from the **latest** meal leaves the empty header visible (it's still latest).
9. Switching to a different date shows that date's meals only.
10. Reload preserves meals and per-meal grouping; entries remain attached to the same mealId.
11. Migration: a stored v1 blob with N entries across distinct dates produces one Meal per date (each at position 0) with all entries assigned.
12. After a clean migration, the loaded State has `version: 2` and every entry has a non-empty `mealId` pointing at a real Meal.
13. The "Meal N" label is derived from `position + 1` at render time. Deleting Meal 2 (via the last-entry-deletion path) re-labels Meal 3 → Meal 2 automatically. (Positions are renumbered to stay contiguous, or the label uses 1-based index within the day's sorted list — either is acceptable as long as the rendered labels stay 1..N with no gaps.)
14. localStorage validation rejects a blob whose `mealId` references a missing meal (returns freshState, same posture as other invariants).
