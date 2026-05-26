# M7 — Inline food-detail card in the picker

## Goal
When a food is selected in the log-view picker, surface its per-serving nutrition AND the live computed values for what would actually be logged, side-by-side, without leaving the log view.

## In scope
- Picking a food in the picker opens an inline detail card directly below that food's `<li>`.
- Card has two side-by-side sections:
  - **Per serving** — nutrition for exactly 1 serving as defined by `food.servingSize` + `food.servingUnit` (from `food.nutritionFacts` × 1).
  - **This entry** — live nutrition for `(amount, logUnit)` as the user types/picks the unit.
- Card lines iterate `NUTRIENT_KEYS` (today: calories, protein, carbs, fat — a new nutrient added to `NUTRIENTS` shows up automatically).
- Macro lines (`MACRO_KEYS`) show `value g (P%)` on both sides, computed via `macroPctOfCalories(n)` on each side's own NutritionFacts. Calories has no %.
- The picker row that's selected is toggleable: clicking it again collapses the card. The food stays selected (still ready to log).
- Selection auto-opens the card (so picking a food immediately reveals nutrition; one click, not two).

## Mutually exclusive with M6 entry-detail
At any moment at most one detail card is open across the whole app. Opening the food card collapses any open entry card, and vice versa. Implementation: one shared `expandedDetail: { kind: 'entry'; id: string } | { kind: 'food'; id: string } | null` state replaces the existing `expandedEntryId: string | null`.

## Out of scope
- Edit-in-place of the food (still M-later).
- Quantity adjustment inside the card (use existing amount + chips).
- Persisting expansion across reloads.
- Multiple cards open at once.

## Data — viewmodel shape

Replace `vm.expandedEntryId: string | null` with:

```ts
export type ExpandedDetail =
  | { kind: 'entry'; id: string }
  | { kind: 'food'; id: string };

vm.expandedDetail: ExpandedDetail | null;
```

Helpers in view.ts to keep the rest of the code from re-pattern-matching:

```ts
function expandedEntryId(d: ExpandedDetail | null): string | null {
  return d?.kind === 'entry' ? d.id : null;
}
function expandedFoodId(d: ExpandedDetail | null): string | null {
  return d?.kind === 'food' ? d.id : null;
}
```

App composition adds two handlers (`onToggleEntry` already exists, semantics unchanged):

- `onFoodSelect(id)` — sets `selectedFoodId = id`, sets `logUnit = food.servingUnit` (existing behavior), and ALSO sets `expandedDetail = { kind: 'food', id }`.
- `onToggleFood(id)` — if `expandedDetail.kind === 'food' && id === expandedDetail.id`, set to null; else set to `{ kind: 'food', id }`. Food selection is **not** touched.
- `onToggleEntry(id)` — same as today; just lives on the new state shape.

Reset hooks (clear `expandedDetail` to null):
- `onDateChange / onPrevDate / onNextDate / onJumpToday` (existing for entries — extends to food card too)
- `onViewChange` (existing)
- `onImport` (extend — wipes selection already, should wipe detail)
- `onDelete` when the deleted entry was expanded (existing)
- `onSoftDeleteFood` when the soft-deleted food was the one expanded in the picker
- Reload: starts at `null` (initial)

## Calc

Reuse what exists. No new domain function required.

**Per-serving side:** `n = food.nutritionFacts` (it's already per-serving by definition).

**This-entry side:**
- Parse amount with the same rules used elsewhere: `parseFloat`, finite, > 0 → valid. `0` is its own special case — see below.
- If the food's `entryServings({ amount, unit: logUnit, ... }, food)` returns a number, compute `entryNutrition({ amount, unit: logUnit, ... }, food)`.
- Render rules:
  - `amount === '0'` → show literal zeros (`0 cal`, `0 g`, no `%` because calories=0).
  - blank / non-numeric / negative / non-finite → show `—` for every value; no `%`.
  - `entryServings` returns `null` (unit incompatible — only possible if compatibleUnits guard is bypassed; defensive) → show `—`.

Helpers to add (`src/ui/format.ts` or extend the file that holds `formatNutrient`):

```ts
type LiveAmount =
  | { kind: 'value'; nutrition: NutritionFacts }
  | { kind: 'zero' }
  | { kind: 'empty' };

function parseLiveAmount(amount: string, unit: Unit, food: Food): LiveAmount {
  if (amount.trim() === '0') return { kind: 'zero' };
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return { kind: 'empty' };
  const servings = entryServings({ amount: n, unit, ... } as Entry, food);
  if (servings === null) return { kind: 'empty' };
  return { kind: 'value', nutrition: scaleNutrition(food.nutritionFacts, servings) };
}
```

(`scaleNutrition` is what `entryNutrition` already does internally — but it would be cleaner to expose `scaleNutrition(nf, servings)` from `src/domain/calc.ts` so the side doesn't construct a fake Entry. Replace `entryNutrition`'s body with `scaleNutrition(food.nutritionFacts, entryServings(entry, food))`.)

## Bad-data fallback

A count-unit food with an invalid `servingSize` (NaN/0/negative) shouldn't crash. Render rule:
- If `food.servingSize` is not a positive finite, OR `entryServings` on a unit-1 test returns `null` for the per-serving side itself, suppress the "This entry" side entirely. Per-serving side renders using `food.nutritionFacts` literally (it's the food's stored data — no computation involved).
- Validators in `src/domain/validate.ts` already reject this on import, but a defensive UI is cheap.

## UI sketch

Picker — Banana is selected, card open:

```
┌─ food-picker ──────────────────────────────────────┐
│ Apple                                              │
│ Banana                            ▼ (selected)     │
│ ┌──────────────────────────────────────────────┐  │
│ │  Per serving (100 g)        This entry (120 g)│  │
│ │  ─────────────────────      ──────────────────│  │
│ │  Calories  89 cal           Calories  107 cal │  │
│ │  Protein   1.1 g (5%)       Protein   1.3 g  …│  │
│ │  Carbs    22.8 g (102%)     Carbs    27.4 g  …│  │
│ │  Fat       0.3 g (3%)       Fat       0.4 g  …│  │
│ └──────────────────────────────────────────────┘  │
│ Broccoli                                           │
│ Chicken breast                                     │
└────────────────────────────────────────────────────┘
```

Layout: card is a 2-column grid (left = per serving, right = this entry). Each column is a stack of label/value rows, matching the entry-detail style. On narrow screens (mobile), stack the two columns top-to-bottom.

Header chips identify the column and its current "amount":
- Per serving column header: `Per serving ({food.servingSize} {food.servingUnit})`
- This entry column header: `This entry ({amount || '—'} {logUnit})`

Empty-amount "This entry" column header still renders ("This entry (— g)" e.g.), keeping layout stable.

## Acceptance

1. Click a food in the picker → it becomes selected AND the detail card appears below that `<li>` immediately.
2. Click the same food again → card collapses; food stays selected; row's `aria-expanded` flips to `false`; `data-selected` still `"true"`.
3. Click a different food → previous card collapses, new food selected, its card opens.
4. Card layout: two columns — "Per serving" left, "This entry" right — each iterating `NUTRIENT_KEYS`.
5. Per-serving column shows `food.nutritionFacts` formatted via `formatNutrient`; macros show `(P%)` from `macroPctOfCalories(food.nutritionFacts)`.
6. "This entry" column shows live values computed from current `amount` + `logUnit`:
   - Valid positive amount: `entryNutrition({ amount, unit: logUnit, ... }, food)`; macro lines show `(P%)`.
   - `amount === "0"`: zeros across the board; macros show `0 g` (no `%`).
   - Blank / non-numeric / negative: every value renders `—`; no `%`.
7. Card line testids: `data-testid="food-detail-per-serving-{key}"` and `data-testid="food-detail-this-entry-{key}"` for each NUTRIENT_KEY.
8. Card root: `data-testid="food-detail"`, `data-food-id="{food.id}"`, `role="region"`, `aria-label="Nutrition details for {food.name}"`.
9. Opening an entry-detail card (clicking a logged entry row) closes any open food card, and vice versa.
10. Switching to the Foods view collapses the food card.
11. Navigating date (prev/next/jump-today/date input) collapses the food card.
12. Importing JSON or soft-deleting the selected food collapses the food card.
13. Reload starts with no card open.
14. Keyboard: `Tab` reaches the food row; `Enter`/`Space` toggles the food card (only collapses — does not deselect).
15. Picker rows render `aria-expanded` only on the selected (and thus toggleable) row. Non-selected rows have no `aria-expanded`.
16. A food with non-positive `servingSize` still shows the per-serving column; the "This entry" column is suppressed.
17. Type a count food's amount in `g` (compatible) → the "This entry" column updates live. Same in `oz`, `lb`, `count`.
18. Logging an entry (`Log it` click) clears `amount` (existing) but keeps the card open with the food still selected. "This entry" column reverts to `—` since amount is now `''`.

## Implementation notes

- **`src/domain/calc.ts`**: extract `scaleNutrition(nf, servings)` as a small helper (4 lines). `entryNutrition` becomes:
  ```ts
  export function entryNutrition(entry, food) {
    const s = entryServings(entry, food);
    return s === null ? zeroNutrition() : scaleNutrition(food.nutritionFacts, s);
  }
  ```
- **`src/domain/types.ts`**: no schema changes. `ExpandedDetail` type lives in `view.ts` (it's a UI concept).
- **`src/app.ts`**: rename internal `expandedEntryId` to `expandedDetail`; update reset hooks to clear it; add `onToggleFood` handler; modify `onFoodSelect` to set `expandedDetail` to `{ kind: 'food', id }`.
- **`src/ui/view.ts`**:
  - Update `ViewModel.expandedEntryId` → `expandedDetail: ExpandedDetail | null`. Add `onToggleFood: (id: string) => void` to `ViewHandlers`.
  - `renderPicker`: for the selected row, append a sibling `<li data-testid="food-detail">` immediately after it when `expandedFoodId(vm.expandedDetail) === food.id`. Use existing pattern from `renderEntries`.
  - New `renderFoodDetail(food, amount, logUnit)` helper returning the `<li>` — iterates `NUTRIENT_KEYS` once per column.
  - Click handler on a picker row: if already selected, treat as toggle (`onToggleFood`); otherwise pick (`onFoodSelect`). Both code paths end with the card open: select sets it open, toggle flips it.
  - Keyboard: same logic on `Enter`/`Space`.
- **`src/styles.css`**: `.food-detail { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }` with `@media (max-width: 480px)` collapsing to 1 column. Reuse the `.entry-detail-row` / `.entry-detail-label` / `.entry-detail-value` styles (rename to `.detail-row` etc. or add aliases; spec leaves the rename optional).

### Tests
- `domain/calc.test.ts`: new `scaleNutrition` tests; existing `entryNutrition` tests still pass after refactor.
- `ui/foodDetail.view.test.ts` (new):
  - Card hidden when no food selected.
  - Card rendered below selected food row, in correct document order.
  - Per-serving column shows `food.nutritionFacts` values for Banana (89 / 1.1 / 22.8 / 0.3) with `(5%) / (102%) / (3%)`.
  - This-entry column live with amount=120 → 107 / 1.3 / 27.4 / 0.4 with same `%`.
  - amount=0 → zeros, no `%`.
  - amount='' → every value `—`, no `%`.
  - amount='abc' / amount='-5' → `—`.
  - Mutual exclusion: opening food card while entry card was open closes the entry card, and vice versa.
  - aria-expanded on selected picker row reflects card state; non-selected rows have no aria-expanded.
  - Keyboard Enter/Space on selected row toggles food card.
- `tests/foodDetail.app.test.ts` (new — e2e via createApp):
  - Pick Banana → card opens with per-serving values.
  - Type amount=120 in g → live column updates to 107 cal.
  - Switch unit to oz; live column updates accordingly.
  - Click Banana again → card collapses; Banana still has `data-selected="true"`; picking Apple opens Apple's card.
  - Click an entry row (M6 path) while food card is open → food card closes, entry card opens.
  - Date nav / view-switch / import collapse the food card.

### Extensibility hooks

- The two-column grid is a natural place for future "Log again" / "Edit food" actions if those land later — the grid can grow a third row across both columns.
- `ExpandedDetail` as a union (not two booleans) keeps the mutually-exclusive invariant compile-checked: TypeScript forbids both kinds simultaneously.
- Centralizing `scaleNutrition` means future per-meal aggregations (M-later) use the same path that the card displays.

## Risks / open questions

- **Layout on mobile**: 2-column grid is cramped under ~480px. Spec stacks them; verify with Playwright at narrow viewport during implementation.
- **"This entry" header churn**: re-rendering the header text every keystroke is fine (DOM update is one `textContent` write), but if perf shows up as a concern we can cache via Mount.
- **Double-tap UX**: tapping a selected food to collapse may surprise users who expect tapping it to "re-confirm" selection. Card serves as the visible feedback for selection; collapse is by clicking the same row a second time. Should be discoverable.

## Risk mitigations

- The two-state (`selectedFoodId`, `expandedDetail`) split keeps "what's selected for logging" and "what's currently visualized" decoupled. Soft-deleting a food while its card is open just clears the card; selection clearing is handled separately by existing logic.
- The discriminated-union shape means the renderer never has to ask "did the user mean entry or food?" — it pattern-matches once and forwards.
