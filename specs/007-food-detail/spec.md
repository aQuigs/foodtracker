# M7 — Inline food-detail card in the picker

## Goal
Picking a food in the log-view picker opens an inline detail card below it. Two columns: per-serving nutrition (food's stored values) and live "this entry" (computed from current amount + unit).

## In scope
- Picking a food auto-opens the card; clicking the same row again toggles it without deselecting.
- Mutually exclusive with the M6 entry-detail card (one shared `expandedDetail` state).
- Each column iterates `NUTRIENT_KEYS`. Macros show `value g (P%)` via `macroPctOfCalories`.
- "This entry" amount handling: `'0'` → literal zeros; blank/non-numeric/negative/incompatible → em-dash, no %.
- A food with non-positive `servingSize` shows the per-serving column only.

## Out of scope
- Edit-in-place on the food.
- Adjusting amount/unit inside the card.
- Persisting expansion.

## Data

Replace M6's `vm.expandedEntryId: string | null` with:

```ts
type ExpandedDetail = { kind: 'entry'; id: string } | { kind: 'food'; id: string };
vm.expandedDetail: ExpandedDetail | null;
```

Discriminated union makes "at most one open" a compile-time invariant.

New handler `onToggleFood(id)` mirrors `onToggleEntry`. `onFoodSelect` sets `expandedDetail = { kind: 'food', id }`. Reset hooks (date nav, view switch, import, soft-delete, reload) clear `expandedDetail`.

Extract `scaleNutrition(nf, servings)` from `entryNutrition` in `calc.ts` so the per-serving column doesn't construct a synthetic Entry.

## UI sketch

```
food-picker
─────────────────────────────────────────
Apple
─────────────────────────────────────────
Banana                  (selected, open)
┌─────────────────────────────────────┐
│ Per serving (100 g)  This entry (120 g)
│ Calories  89 cal      Calories  107 cal
│ Protein  1.1 g (5%)   Protein  1.3 g (5%)
│ Carbs  22.8 g (102%)  Carbs  27.4 g (102%)
│ Fat   0.3 g (3%)      Fat   0.4 g (3%)
└─────────────────────────────────────┘
Broccoli
```

CSS: 2-column grid; mobile (<480px) stacks. Suppressed "this entry" column collapses to a single column (`.food-detail-single`).

## Acceptance

1. Picking a food opens its card below the row.
2. Clicking the same row toggles the card; `data-selected` stays `"true"`; `aria-expanded` flips.
3. Picking a different food closes the previous card and opens the new one.
4. Per-serving column shows `food.nutritionFacts` formatted with macro %.
5. "This entry" column reacts live to `amount` + `logUnit`. `'0'` → zeros; invalid/empty → em-dash; valid → scaled.
6. Card line testids `food-detail-per-serving-{key}` and `food-detail-this-entry-{key}` per `NUTRIENT_KEYS`.
7. Card root `data-testid="food-detail"`, `data-food-id="{id}"`, `role="region"`, `aria-label="Nutrition details for {name}"`, `id="food-detail-{id}"` for `aria-controls`.
8. Mutual exclusion: opening an entry card closes the food card and vice versa.
9. Date nav / view switch / import / soft-delete-the-open-food collapse the card. Reload starts with no card.
10. Keyboard: `Enter`/`Space` on the row activates (select-or-toggle).
11. A food with non-positive `servingSize` renders the per-serving column only.
12. Logging an entry clears `amount` but keeps the card open; "this entry" reverts to em-dash.
