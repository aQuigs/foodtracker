# M5a — Quick-select amount chips

## Goal
Speed up logging by showing a row of common-amount buttons below the log form. Tapping a button fills the amount input with that value and moves keyboard focus to the Log button so Enter submits — reducing a typical log to two taps for common quantities. The amount input still accepts any custom value; chips are a shortcut, never a gate.

## In scope
- A row of 4 chips, shown only when a food is selected.
- Hardcoded per-unit defaults: `g` → 50/100/150/200, `oz` → 1/2/4/8, `lb` → 0.25/0.5/0.75/1, `count` → 1/2/3/4.
- Chips track `vm.logUnit` (the currently selected log unit), not the food's `servingUnit`. Switching the unit dropdown switches the chip set.
- Tapping a chip:
  1. Calls existing `onAmountChange(value)` with the value as a string.
  2. Moves DOM focus to the Log button.
- New pure function `getChipsForUnit(unit: Unit): number[]` in `src/ui/chips.ts`.
- CSS `.chip-row` and `.chip` classes.

## Out of scope
- Per-food chip overrides (M5b).
- Configuring the number of chips.
- Auto-submitting on chip click.
- Persisting which chip was last tapped.

## Data

No new app state. Chip values are a hardcoded constant table:

```ts
const CHIPS: Record<Unit, number[]> = {
  g:     [50, 100, 150, 200],
  oz:    [1, 2, 4, 8],
  lb:    [0.25, 0.5, 0.75, 1],
  count: [1, 2, 3, 4],
};
```

`Record<Unit, …>` forces the compiler to reject any new unit until its chip set is added — same pattern as the existing `NUTRIENT_KIND` map (see `CLAUDE.md`: "one concrete struct per concept").

## UI sketch

```
[ search input          ]
[ food picker list      ]
[ amount ] [ unit ▼ ] [ Log it ]
[ 50 ] [ 100 ] [ 150 ] [ 200 ]    ← chip row (hidden until food picked)
```

- Container: `data-testid="chip-row"`. `role="group"` + `aria-label="Quick amounts"`.
- Each chip: `<button type="button" data-testid="chip-{value}">{value}</button>` (e.g. `chip-100`, `chip-0.25`).

## Acceptance

**Pure function (`getChipsForUnit`):**
1. Returns `[50, 100, 150, 200]` for `'g'`.
2. Returns `[1, 2, 4, 8]` for `'oz'`.
3. Returns `[0.25, 0.5, 0.75, 1]` for `'lb'`.
4. Returns `[1, 2, 3, 4]` for `'count'`.

**View — chip-row rendering:**
5. `chip-row` is hidden when `selectedFoodId === null`.
6. `chip-row` is visible when a food is selected.
7. Chip buttons match the values for the active `logUnit`.
8. Chips update when `logUnit` changes (re-render shows new chip set).
9. Clicking a chip calls `onAmountChange` with the value as a string (fractional values stringified exactly: `'0.25'`).
10. Clicking a chip moves `document.activeElement` to the Log button.
11. `data-testid` on each chip is `chip-{value}`.

**End-to-end (`tests/app.test.ts`):**
12. chip-row hidden until a food is picked.
13. Pick food → tap chip 100 → amount input shows `'100'` → Log button is focused → press Enter → entry logged with amount 100, unit g.
14. Pick food, switch unit to oz, chips change to oz values.

## Implementation notes

### Where it lives
- **`src/ui/chips.ts`** — pure `getChipsForUnit`. Lives under `ui/` because chip values are a UI default, not a fact about food. M5b will graduate this to per-food lookups, still in `ui/`.
- **`src/ui/view.ts`** — `chip-row` is a persistent shell child (sibling of `log-row`). A `renderChipRow(row, vm, handlers, logBtn)` helper rewrites its children when `vm.logUnit` changes and toggles `row.hidden` from `vm.selectedFoodId === null`. The Log button reference is needed so click handlers can `.focus()` it.
- **`src/app.ts`** — no new state. Chips reuse `onAmountChange`. Focus move happens in the view layer (DOM detail) — `app.ts` shouldn't know about focus.

### Extensibility hook for M5b
Today: `getChipsForUnit(unit: Unit): number[]`.
M5b: introduce `getChipsForFood(food: Food, unit: Unit): number[]` that returns per-food overrides falling back to `getChipsForUnit`. Only the call site in `view.ts` changes; chip rendering, focus, and event wiring stay identical.

### Why not domain
Chip values are UI defaults. The domain doesn't care whether a user prefers 50/100/150/200 vs 25/50/100/250. Keeping them in `ui/` keeps `domain/` pure.

## Accessibility
- Each chip is a real `<button>` with visible text (the numeric value).
- Chip row gets `role="group"` and `aria-label="Quick amounts"` for screen readers.
- Focus move on click is intentional — users can still Tab away or click the amount input to override.

## Risks / tradeoffs
- **Surprise on focus move.** The Log button gains focus the moment a chip is clicked. Mitigation: we focus the button, not auto-submit. The user must still press Enter or click. Reversible by tabbing/clicking elsewhere.
- **Fractional `lb` chips display as decimals**, not fractions ("0.25" not "¼"). Acceptable — decimals are how amounts render everywhere else in the app.
- **No keyboard shortcut for chips** (e.g. number keys 1-4). Out of scope; revisit if heavy keyboard users ask.
