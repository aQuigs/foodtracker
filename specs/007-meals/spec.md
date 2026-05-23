# M7 — Ordered meals

## Goal
Each day has an ordered list of meals (default "Meal 1"). Log entries are assigned to a meal. The log view groups entries by meal with per-meal subtotals. A button creates the next meal, but only when the current meal has at least one entry.

## In scope
- `Meal = { id: string, date: string, name: string, createdAt: string }`
- `State.meals: Meal[]` — flat list across all dates
- `Entry.mealId: string` — which meal the entry belongs to
- `State.version` bumped to 3
- v2 → v3 migration: each entry gets a synthetic mealId `${entry.date}-meal-1`; a "Meal 1" meal is created for each day that has entries
- `StartNextMeal { date, mealId, name, createdAt }` action — adds a meal; reducer is a pure setter
- `LogEntry` payload now requires `mealId` to match an existing meal on the entry's date
- `currentMealId` tracked in app.ts (the meal new entries land in for the active date)
- On day change, default to the most-recently-created meal for that day; if none, create "Meal 1" implicitly (the first log does it)
- Log view groups entries by meal in chronological (createdAt) order; each meal section shows a heading and subtotal row
- "End meal & start next meal" button (testid `start-next-meal`) at the bottom of the current meal section; disabled when the current meal has 0 entries on that date

## Out of scope
- Drag-to-reorder entries within or across meals
- Move-between-meals
- Renaming meals

## Data

### Types
```ts
type Meal = {
  id: string;
  date: string;
  name: string;
  createdAt: string;
};

type Entry = {
  // ... existing
  mealId: string;
};

type State = {
  version: 3;
  foods: Food[];
  entries: Entry[];
  meals: Meal[];
};
```

### Persistence: v2 → v3 migration
On read: if the stored blob's version is `2`:
- For each distinct `entry.date` that has entries, create a `Meal` with `id = "${date}-meal-1"`, `date`, `name = "Meal 1"`, `createdAt = <earliest entry loggedAt for that date>`.
- Each entry gets `mealId = "${entry.date}-meal-1"`.

Then the blob is promoted to version 3. Only version 3 is written from that point on.

## Acceptance

**Domain — types & migration:**
1. v2 blob with entries migrates: each entry gains `mealId = "${entry.date}-meal-1"`
2. v2 blob migration creates one Meal per distinct date with entries
3. v2 blob with no entries migrates to v3 with `meals: []`
4. v3 blob loads without modification
5. Corrupt or wrong-version blob → null (reset to fresh state)

**Domain — reducer:**
6. `StartNextMeal` adds a new meal to state
7. `StartNextMeal` with a duplicate id is a no-op (returns same state)
8. `LogEntry` with a valid mealId (meal exists for that date) appends the entry
9. `LogEntry` with a mealId whose meal doesn't exist is rejected (returns same state)
10. `LogEntry` with a mealId for a meal on a different date is rejected

**Domain — calc:**
11. `mealTotals(state, mealId)` sums kcal/protein/carbs/fat for entries with that mealId
12. `dailyTotals` still sums all entries for the date regardless of meal

**UI — view:**
13. Log view renders a heading per meal in createdAt order
14. Log view renders a subtotal row per meal (`meal-subtotal-{mealId}`)
15. "End meal & start next meal" button is disabled when the current meal has 0 entries
16. "End meal & start next meal" button is enabled when the current meal has ≥ 1 entry

**App — integration:**
17. Logging an entry assigns it to `currentMealId`
18. Clicking "End meal & start next meal" (when enabled) creates a new meal and updates `currentMealId`

## Notes
- Meal order within a day is by `createdAt` ascending.
- Meal display names are positional: "Meal 1", "Meal 2", … based on 1-based position in the day's sorted meal list.
- The migration pattern follows the v1→v2 pattern in `src/domain/validate.ts`.
