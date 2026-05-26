# M6 — Clickable entries with inline detail card

## Goal
Tap an entry row to see its resolved calories and macro breakdown without leaving the log view.

## In scope
- Click anywhere on an entry row to expand a detail card inline below the row.
- One card open at a time; clicking a different row collapses the previous and expands the new one. Clicking the same row again collapses.
- Card shows resolved values for **every key in `NutritionFacts`** — today that's `calories`, `protein`, `carbs`, `fat`; a future nutrient added to `NutritionFacts` shows up automatically. Calories rounded to integer, gram-based nutrients to 1 decimal.
- Expansion state is ephemeral: not persisted, resets on reload / date change / view switch.
- Delete `×` button continues to work and does **not** trigger expansion (event stopPropagation).
- Soft-deleted foods render their card normally using stored nutrition data.

## Out of scope
- Edit-in-place (would be M-later).
- "Log again" prefill button (M-later).
- Macro chart / graphical breakdown (that's M8).
- Persisted expansion state.

## Data
No schema changes. No new types in `domain/`.

Expansion is pure UI state in the app composition root:

```ts
let expandedEntryId: string | null = null;
```

Added to the `ViewModel` for `view.ts` to render; cleared by:
- `onDateChange` / `onPrevDate` / `onNextDate` / `onJumpToday`
- `onViewChange`
- Reload (initial state)
- Delete of the expanded entry

A new handler `onToggleEntry(entryId: string)` flips the state: if `entryId === expandedEntryId`, set to `null`; otherwise set to `entryId`.

## Calc

`entryCalories(entry, food)` exists. Generalize to full macros:

```ts
export function entryNutrition(entry: Entry, food: Food): NutritionFacts {
  const servings = entryServings(entry, food);
  const zero: NutritionFacts = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  if (servings === null) {
    return zero;
  }

  return Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [k, food.nutritionFacts[k] * servings])
  ) as NutritionFacts;
}
```

`entryCalories(entry, food)` becomes `entryNutrition(entry, food).calories`. (`dailyTotals` can later refactor to use this too, but that's out of scope here.)

Card renders by iterating `NUTRIENT_KEYS` and looking up label/unit in `NUTRIENTS`:

```ts
import { NUTRIENTS, NUTRIENT_KEYS } from '../domain/types.js';
const n = entryNutrition(entry, food);
for (const k of NUTRIENT_KEYS) {
  // label = NUTRIENTS[k].label
  // suffix = NUTRIENTS[k].calPerGram === 0 ? 'cal' : 'g'
  // value = round(n[k], k === 'calories' ? 0 : 1)
}
```

Adding a future nutrient (e.g. fiber) is still one line on `NutritionFacts` + one entry in `NUTRIENTS` — the card picks it up automatically.

## UI sketch

```
entry list:
─────────────────────────────────────────
Banana   120 g   107 cal              ×
─────────────────────────────────────────
Oats     50 g    190 cal              ×        ← clicked
  ┌──────────────────────────────────────┐
  │ Calories  190                        │
  │ Protein     6.6 g                    │
  │ Carbs      33.9 g                    │
  │ Fat         3.3 g                    │
  └──────────────────────────────────────┘
─────────────────────────────────────────
Egg      2 count  310 cal              ×
─────────────────────────────────────────
```

Whole row gets a hover/focus state; no chevron icon. The row is `role="button"`, `tabindex="0"`, with keyboard `Enter` / `Space` activation. `aria-expanded` reflects state. The card has `role="region"` and an `aria-label` like `Nutrition details for {food.name}` — preferred over `aria-labelledby` so the announcement doesn't include the delete `×` from the row's accessible name.

The card lives in its own `<li>` (or absorbed `<li>` extension) below the row, so it participates in the same list semantics and document order.

## Acceptance
1. Click an entry row → a detail card appears below it.
2. Click another row → previous card collapses, new card appears.
3. Click the same row again → card collapses.
4. Card content: one line per key in `NUTRIENT_KEYS` (today: Calories, Protein, Carbs, Fat). Each line shows the label from `NUTRIENTS[k].label`, the resolved value, and a unit (`cal` when `calPerGram === 0`, otherwise `g`).
5. Values match `entryNutrition(entry, food)`: amount × unit conversion × servings × food nutrition.
6. Soft-deleted food: card renders normally using stored nutrition.
7. Delete `×` does NOT expand the row.
8. Deleting the currently-expanded entry resets expansion to `null` (no orphan state pointing at a removed id).
9. Switching to the Foods view collapses any open card.
10. Navigating date (prev/next/jump-today/date input) collapses any open card.
11. Reload starts with no card open.
12. Keyboard: `Tab` lands on the row; `Enter`/`Space` toggles; `Tab` from the row reaches the delete button. Screen readers announce `aria-expanded`.
13. Row hover/focus has a visible style change (not just the delete button).
14. The row is a single click target: clicking the food name, the amount, or empty padding area all toggle. Clicking `×` deletes without toggling.

## Implementation notes

- **`src/domain/calc.ts`**: add `entryNutrition(entry, food)` returning a full `NutritionFacts`. Replace the body of `entryCalories` with `entryNutrition(entry, food).calories` (or delete and inline at callers).
- **`src/app.ts`**: add `let expandedEntryId: string | null = null` to the composition state. Expose on the ViewModel as `expandedEntryId`. Add `onToggleEntry(entryId)` to `ViewHandlers`. Reset it in `onViewChange`, `onDateChange`, `onPrevDate`, `onNextDate`, `onJumpToday`, and inside `onDelete` when `entryId === expandedEntryId`. Reload starts at `null` (initial value).
- **`src/ui/view.ts`** — entry list rendering:
  - Each `<li data-testid="entry-row">` gets `role="button"`, `tabindex="0"`, `aria-expanded`, click handler calling `handlers.onToggleEntry(entry.id)`, keydown handler for `Enter` / `Space`.
  - Delete `×` button keeps a `stopPropagation()` click handler so it doesn't bubble to the row toggle.
  - Detail card: when `vm.expandedEntryId === entry.id`, append a sibling `<li data-testid="entry-detail" data-entry-id={entry.id}>` immediately after the row in the entry-list `<ul>`. The card iterates `NUTRIENT_KEYS` with `data-testid="entry-detail-${key}"` per row.
  - No Mount caching for the card. It mounts and unmounts each render; volume is 4 short lines. The existing render path already runs synchronously after state change, so no flicker.
- **`src/styles.css`**: row gets `cursor: pointer` and a `:hover` / `:focus-visible` background. Detail card gets a small inset (padding-left to align with row text) and a subtle border-top so it visually belongs to the row above it.

### Tests
- `domain/calc.test.ts`: `entryNutrition` correctness for g, oz, lb, count entries; deleted food = nothing rendered above (not this function's concern, but a row that has no food entry should not be expandable — verified at view layer).
- `ui/view.test.ts` and a new `entryDetail.app.test.ts` covering the 14 acceptance criteria.

### Extensibility hooks (for thinking ahead)
- When edit-in-place arrives, the card grows to host inputs. The current shape — one labeled function builder per row — already isolates the detail rendering.
- When macro chart arrives (M8), the same `entryNutrition` helper is what feeds the per-day aggregation. Designing the helper now to return a full `NutritionFacts` (not just calories) avoids re-fitting later.
- The "log again" button (deferred) would slot into the card as an additional control without touching the row markup.

## Risks / open questions
- **Click-through to delete:** Delete `×` is currently a child element of the row `<li>`. If row clicks bubble to a row-level handler, the delete button click would also toggle. Fix: `e.stopPropagation()` on the delete handler. Tests must cover this.
- **Focus shift on collapse:** When the card disappears, focus should remain on the row that was just toggled (not be lost). The render pipeline already preserves focus by `data-testid`; we need to verify it survives the structural change.
- **DOM order vs visual order with the detail `<li>`:** Inserting a sibling `<li>` after the row keeps document order clean. CSS does the rest.

## Risk mitigations baked into the spec
- The card layout uses `Object.entries(entryNutrition(entry, food))` iteration so adding a future nutrient is a one-line change in the calc helper, with the render code unchanged.
- Expansion state lives in the app composition root, not in the DOM or persistence — testable in isolation; survives the layered architecture rule.
