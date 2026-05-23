# M5a — Quick-select unit chips (unit-level defaults)

## Goal
Speed up logging by showing a row of common-amount chips below the amount input. Tapping a chip fills the amount field instantly, reducing a typical log to two taps (pick food → tap chip) for common quantities.

## In scope
- A row of 4 chips per unit, shown only when a food is selected.
- Hardcoded per-unit defaults: `g` → 50/100/150/200, `oz` → 1/2/4/8, `lb` → 0.25/0.5/0.75/1, `count` → 1/2/3/4.
- Chips reflect `vm.logUnit` (the currently selected log unit), not the food's `primaryUnit`.
- Tapping a chip calls the existing `onAmountChange` handler with the chip value as a string.
- New pure function `getChipsForUnit(unit: Unit): number[]` in `src/ui/chips.ts`.
- CSS `.chip-row` class for horizontal flex layout.

## Out of scope
- Per-food chip overrides (M5b).
- Customising the number of chips.
- Persisting which chip was last tapped.

## Data

No new state. The chip values are hardcoded constants:

```ts
const CHIPS: Record<Unit, number[]> = {
  g:     [50, 100, 150, 200],
  oz:    [1, 2, 4, 8],
  lb:    [0.25, 0.5, 0.75, 1],
  count: [1, 2, 3, 4],
};
```

`getChipsForUnit(unit)` returns the corresponding array.

## UI sketch

```
Log view, below the amount/unit/log row:
┌──────────────────────────────────────────────────────────────┐
│ [Food picker]   Amount: [____]  Unit: [g  ▼]    [Log it]    │
│  [  50  ] [  100  ] [  150  ] [  200  ]                     │
└──────────────────────────────────────────────────────────────┘
```

Chips only appear after a food is selected. The row is absent when no food is selected.

Container: `data-testid="chip-row"`. Each chip button: `data-testid="chip-{value}"` (e.g. `chip-100`, `chip-0.25`).

## Acceptance

**Pure function (`getChipsForUnit`):**
1. Returns `[50, 100, 150, 200]` for `'g'`.
2. Returns `[1, 2, 4, 8]` for `'oz'`.
3. Returns `[0.25, 0.5, 0.75, 1]` for `'lb'`.
4. Returns `[1, 2, 3, 4]` for `'count'`.

**View — chip-row rendering:**
5. `chip-row` is absent when `selectedFoodId` is `null`.
6. `chip-row` is present when a food is selected.
7. Chip buttons match the values for the active `logUnit`.
8. Chips update when `logUnit` changes (re-render shows new chip set).
9. Clicking a chip calls `onAmountChange` with the chip value as a string.
10. `data-testid` on each chip is `chip-{value}` (e.g. `chip-0.25`).
