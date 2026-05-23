# M6 — Clickable entries with detail card

## Goal

Clicking a logged entry expands a detail card inline (no modal). The card shows nutrition for the underlying food at two scales: per 100g and scaled to the entry's logged amount. From the card the user can delete the entry or jump into an edit workflow (delete + prefill the log form).

## In scope

- Each entry row in the log list is clickable (whole row, cursor pointer).
- Clicking a row toggles an inline detail card open/closed immediately below that row.
- Only one card can be open at a time; clicking a different row closes the previous card.
- Clicking the same row again collapses the card.
- The detail card shows:
  - Per-100g panel: kcal, protein, carbs, fat from the food record.
  - Scaled panel: same values multiplied by `entry.grams / 100`.
  - Delete button (same effect as the existing row-level delete).
  - Edit button: deletes the entry and prefills the log form (`selectedFoodId`, `amountRaw`, `logUnit`) from the entry's data, then resets `expandedEntryId` to null.
- The existing row-level delete button (`×`) must not trigger the row toggle (stopPropagation).
- New `scaledNutrition(entry, food)` pure helper in `src/domain/calc.ts` returning `{kcal, protein, carbs, fat}`.
- New `expandedEntryId: string | null` field on `ViewModel`.
- New handlers on `ViewHandlers`: `onToggleEntry(entryId)` and `onEditEntry(entryId)`.

## Out of scope

- In-place editing of a logged entry's amount or food.
- Animations beyond what CSS provides.
- Multi-entry bulk delete.

## Data

### ViewModel addition
```ts
expandedEntryId: string | null;
```

### ViewHandlers additions
```ts
onToggleEntry: (entryId: string) => void;
onEditEntry:   (entryId: string) => void;
```

### New calc helper
```ts
scaledNutrition(entry: Entry, food: Food): Totals
// returns { kcal, protein, carbs, fat } scaled to entry.grams
```

## UI sketch

```
┌─────────────────────────────────────────────────────┐
│ Banana  120g  107 cal  [×]                          │  ← clickable row
├─────────────────────────────────────────────────────┤
│  Per 100g: 89 kcal · 1.1g protein · 22.8g carbs …  │  ← entry-detail
│  120g:     107 kcal · 1.3g protein · 27.4g carbs … │
│  [Edit]  [Delete]                                   │
└─────────────────────────────────────────────────────┘
```

## Acceptance criteria

**Domain (pure):**
1. `scaledNutrition(entry, food)` returns `{kcal, protein, carbs, fat}` scaled by `entry.grams / 100`.
2. `scaledNutrition` returns all zeros when `entry.grams` is 0.

**ViewModel:**
3. `ViewModel` has an `expandedEntryId: string | null` field.
4. `ViewHandlers` has `onToggleEntry` and `onEditEntry`.

**View — toggle:**
5. Clicking an entry row calls `onToggleEntry(entryId)`.
6. Clicking the delete button (`×`) on an entry row does NOT call `onToggleEntry`.
7. When `expandedEntryId === entry.id`, a `[data-testid="entry-detail"]` element is rendered immediately after that entry row.
8. When `expandedEntryId` is null or a different id, no `entry-detail` element is rendered.

**View — detail card content:**
9. `[data-testid="entry-detail-per-100g"]` shows the food's per-100g kcal, protein, carbs, fat.
10. `[data-testid="entry-detail-scaled"]` shows values scaled to `entry.grams`.
11. `[data-testid="entry-detail-delete"]` button, when clicked, calls `onDelete(entryId)`.
12. `[data-testid="entry-detail-edit"]` button, when clicked, calls `onEditEntry(entryId)`.

**App integration:**
13. `onToggleEntry` sets `expandedEntryId` to the given id; calling it again with the same id sets it to null.
14. `onToggleEntry` with a different id replaces the previously expanded id.
15. `onEditEntry` deletes the entry, prefills `selectedFoodId`, `amountRaw`, `logUnit` from the entry, and resets `expandedEntryId` to null.
16. After `onEditEntry`, the entry is gone from the list and the form reflects the entry's food and amount.
