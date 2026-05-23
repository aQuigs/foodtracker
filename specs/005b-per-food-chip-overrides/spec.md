# M5b — Per-food chip overrides

## Goal
Let each food define its own chip values, overriding the unit-level defaults from M5a. Used when a food has standard portion sizes that differ from the generic defaults (e.g. tuna in 80g cans, not 50g chunks).

## In scope
- `Food` gains a `chips: number[] | null` field. `null` means "use the unit defaults from `getChipsForUnit`".
- When `food.chips` is set, the log view uses those values when that food is selected and `logUnit === food.primaryUnit`. When `logUnit` differs from `food.primaryUnit`, falls back to unit defaults.
- Foods form (add + edit) gets a chip editor: 4 text inputs for chip values, plus a "Reset to defaults" button that clears the override (sets back to `null`).
- Schema bump v2 → v4 with one-way migration: existing foods get `chips: null`.

## Out of scope
- Per-unit chip overrides (only `primaryUnit` chips are stored on a food).
- More or fewer than 4 chip values per food.
- Reordering chips.

## Data

### Type change

```ts
type Food = {
  // ... existing fields
  chips: number[] | null; // null = use unit defaults from getChipsForUnit
};
```

### Valid `chips` values
- `null` — use unit defaults
- Array of exactly 4 positive finite numbers — use as chip values
- Empty array or array containing non-positive/non-finite values → rejected by reducer and intent parser

### Migration v2 → v4

On read: if the stored blob's version is `2` (or after v1→v2 migration), add `chips: null` to each food.

```
v2 food → { ...food, chips: null }
```

Then write back as `version: 4`. v2 data is read-once-migrated; v4 is the only on-disk shape going forward.

### `getChipsForLog(food, logUnit)` helper (in `src/ui/chips.ts`)

```ts
function getChipsForLog(food: Food, logUnit: Unit): number[] {
  if (food.chips !== null && logUnit === food.primaryUnit) {
    return food.chips;
  }
  return getChipsForUnit(logUnit);
}
```

## UI sketch

### Log view (unchanged layout, new behavior)
```
┌──────────────────────────────────────────────────────────────┐
│ [Food picker]   Amount: [____]  Unit: [g  ▼]    [Log it]    │
│  [  80  ] [  160  ] [  240  ] [  320  ]   (custom chips)    │
└──────────────────────────────────────────────────────────────┘
```

Chips reflect the food's `chips` override when `logUnit === food.primaryUnit`, otherwise fall back to unit defaults.

### Foods form (new chip editor section)
```
┌──────────────────────────────────────────────────────────────┐
│ ... existing fields ...                                      │
│ Custom chips (optional):                                     │
│  [80] [160] [240] [320]   [Reset to defaults]               │
└──────────────────────────────────────────────────────────────┘
```

Test ids: `food-form-chip-0`, `food-form-chip-1`, `food-form-chip-2`, `food-form-chip-3`, `food-form-chips-reset`.

## Acceptance

**Domain (pure — reducer + validate):**
1. `AddFood` with `chips: null` succeeds.
2. `AddFood` with `chips: [80, 160, 240, 320]` succeeds.
3. `AddFood` with `chips: []` is rejected (no-op).
4. `AddFood` with `chips: [80, -1, 240, 320]` is rejected (non-positive value).
5. `AddFood` with `chips: [80, NaN, 240, 320]` is rejected (non-finite value).
6. `EditFood` with `chips: [90, 130, 170, 210]` updates the food's chips.
7. `EditFood` with `chips: null` clears the override.

**Persistence (boundary validator — parseState):**
8. v2 blob migrates to v4: each food gains `chips: null`.
9. v4 blob loads as-is (no migration).
10. v4 blob with a food that has invalid `chips` (empty array) is rejected entirely.
11. v4 blob with a food that has `chips: null` loads correctly.
12. v4 blob with a food that has `chips: [80, 160, 240, 320]` loads correctly.

**`getChipsForLog` helper:**
13. Returns `food.chips` when `food.chips !== null` and `logUnit === food.primaryUnit`.
14. Returns `getChipsForUnit(logUnit)` when `food.chips !== null` but `logUnit !== food.primaryUnit`.
15. Returns `getChipsForUnit(logUnit)` when `food.chips === null`.

**UI — log view:**
16. When a food with `chips: [80, 160, 240, 320]` is selected and `logUnit === food.primaryUnit`, chips show `80`, `160`, `240`, `320`.
17. When that same food is selected but `logUnit !== food.primaryUnit`, chips show the unit defaults.

**UI — food form chip editor:**
18. Chip editor renders 4 inputs (`food-form-chip-0` through `food-form-chip-3`).
19. "Reset to defaults" button (`food-form-chips-reset`) is present.
20. Chip inputs are pre-filled with the food's current chips when editing a food that has overrides.
21. Clicking "Reset to defaults" fires `onFoodFormChipsReset`.
22. Changing a chip input fires `onFoodFormChipChange(index, value)`.
