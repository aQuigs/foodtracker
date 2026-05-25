# M4 — Multiple units per food

## Goal
Log foods in grams, ounces, pounds, or count (e.g. "2 eggs", "0.25 lb chicken"), not just grams. Each food declares a primary unit and (when count-based) a weight per unit, so kcal math always reconciles back to per-100g.

## In scope
- New `Unit` type: `'g' | 'oz' | 'lb' | 'count'`
- `Food` gains `primaryUnit: Unit` and `weightPerUnit: number` (grams). For `g/oz/lb`, `weightPerUnit` is unused (math is purely grams-based); for `count`, it's the grams-per-piece (e.g. one egg = 50g).
- `Entry` gains `amount: number` and `unit: Unit` (grams remains, resolved at log time)
- Log form: unit picker next to the amount input, defaults to the picked food's `primaryUnit`, user can override per log
- Foods form: pick `primaryUnit` when adding/editing a food; show a `weightPerUnit` (g) field when unit is `count`
- Persistence: schema bump from `foodtracker:v1` to `foodtracker:v2`; one-way migration on read
- Entry row in the log shows `{amount}{unit}` (e.g. "2 count", "0.25 lb", "120g") rather than always `{grams}g`

## Out of scope
- Quick-select chips (M5)
- Per-entry editing (still deferred per M3)
- Customizing the list of available units
- Pluralization niceties ("2 eggs" instead of "2 count" — entry row stays generic for now)
- Changing how totals are computed (still grams-driven, since `entry.grams` is resolved at log time)

## Data

### Types
```ts
type Unit = 'g' | 'oz' | 'lb' | 'count';

type Food = {
  // ... existing
  primaryUnit: Unit;
  weightPerUnit: number; // grams. ignored unless primaryUnit is 'count'. always finite, > 0.
};

type Entry = {
  // ... existing
  amount: number; // in entry.unit (e.g. 0.25 for "0.25 lb")
  unit: Unit;
  grams: number;  // resolved at log time using weightPerUnit (for count) or unit conversion (for g/oz/lb)
};
```

### Conversion (pure)
```
toGrams(amount, unit, weightPerUnit):
  g     → amount
  oz    → amount * 28.3495
  lb    → amount * 453.592
  count → amount * weightPerUnit
```

### Persistence: v1 → v2 migration
On read: if the stored blob's version is `1` (or has no `version` field but matches v1 shape), the loader maps:
- each `food` → `{ ...food, primaryUnit: 'g', weightPerUnit: 100 }`
- each `entry` → `{ ...entry, amount: entry.grams, unit: 'g' }`

Then writes back as `version: 2`. v1 data is read-once-migrated; v2 is the only on-disk shape going forward.

`parseState` (boundary validator) checks v2 shape only. The migration step runs *before* `parseState`.

## UI sketch

```
Log view, log form row:
┌──────────────────────────────────────────────────────────────┐
│ [Food picker]   Amount: [____]  Unit: [g  ▼]    [Log it]    │
└──────────────────────────────────────────────────────────────┘

Foods view, food form (when unit is 'count'):
┌──────────────────────────────────────────────────────────────┐
│ Name:       [Egg                    ]                        │
│ Primary unit: [count ▼]   Weight per unit (g): [50 ]         │
│ Nutrition per 100g:                                          │
│   kcal [155]  Protein [12.6]  Carbs [1.1]  Fat [10.6]       │
└──────────────────────────────────────────────────────────────┘
```

## Acceptance
**Domain (pure):**
1. `LogFood({foodId, amount, unit, loggedAt})` resolves grams using `food.weightPerUnit` (count) or fixed conversion (g/oz/lb), appends an entry with `{amount, unit, grams}`
2. `LogFood` rejects non-finite or negative `amount` → state unchanged
3. `LogFood` against a food whose `primaryUnit !== entry.unit` still works (override at log-time is supported)
4. `LogFood` against a soft-deleted food still works at reducer level (existing M1a invariant); UI guards it
5. `AddFood` rejects non-finite/non-positive `weightPerUnit` → state unchanged
6. `EditFood` patches `primaryUnit` and `weightPerUnit`; rejects invalid values
7. `calculateTotals` still uses `entry.grams` and per-100g nutrition (unchanged)

**Persistence:**
8. v1 blob loads, migrates, and round-trips back as v2 (writes v2 on next save)
9. v1 entries gain `amount: entry.grams, unit: 'g'`
10. v1 foods gain `primaryUnit: 'g', weightPerUnit: 100`
11. v2 blob loads as-is, no migration
12. Corrupt v1 blob → reset to default state (existing invariant, retested under v2)
13. Corrupt v2 blob → reset to default state

**UI (log form):**
14. Unit picker defaults to selected food's `primaryUnit` when a food is picked
15. Changing the unit picker doesn't change the food
16. Picking a food in `count` unit shows "amount" labeled (e.g. just plain "Amount", no g hardcoded)
17. Entry row renders `{amount}{unit shorthand}` (g/oz/lb/count) with totals still in g-resolved kcal

**UI (food form):**
18. Adding a new food requires picking a `primaryUnit`; UI defaults to `g`
19. When `primaryUnit === 'count'`, the form shows a required `weightPerUnit` (grams) field
20. When `primaryUnit !== 'count'`, the `weightPerUnit` field is hidden; the value is set to `100` under the hood (unused)
21. Edit form prefills `primaryUnit` and (if count) `weightPerUnit`

**Import/export:**
22. Export emits v2-shape JSON
23. Import accepts a v1 export and migrates it (same path as persistence)

## Notes
- `weightPerUnit` is required to be finite > 0 even for non-count foods, so we keep `Food` shape uniform. Default `100` matches the per-100g basis used by nutrition fields.
- Conversion constants live in `src/domain/units.ts` so they're easy to find and test in isolation.
- Existing seed foods get `primaryUnit: 'g', weightPerUnit: 100` in `src/domain/seed.ts` (or wherever seeds live).
- The migration is **one-way**; no need to write v1. Once v2 is on disk, v1 reader path is unused for that user (but kept in code for any user opening an old browser tab on stale storage).
