# 0003 — Food + grams logging model (M1)

**Date:** 2026-05-23

## Context

Two MVP models were considered: (a) free-text "ate a banana, 107 cal" entries, (b) pick a food from a DB + enter grams, calories computed. User chose (b). This decision locks in the schema for foods and entries from M1.

## Decision

**Nutrient registry — single source of truth:**

```ts
type NutrientDef = {
  key: string;
  label: string;          // UI display
  unit: string;           // "cal" | "g" | "mg" | …
  caloriesPerGram: number; // 0 = non-caloric; >0 = contributes to total calories
};

const NUTRIENT_DEFS = [
  { key: 'calories', label: 'Calories', unit: 'cal', caloriesPerGram: 0 },
  { key: 'protein',  label: 'Protein',  unit: 'g',   caloriesPerGram: 4 },
  { key: 'carbs',    label: 'Carbs',    unit: 'g',   caloriesPerGram: 4 },
  { key: 'fat',      label: 'Fat',      unit: 'g',   caloriesPerGram: 9 },
] as const satisfies readonly NutrientDef[];

type Nutrient = typeof NUTRIENT_DEFS[number]['key']; // derived, can't drift
```

**Food schema** (stored in `state.foods`):

```ts
type Food = {
  id: string;                          // crypto.randomUUID()
  name: string;                        // user-facing label
  per100g: Record<Nutrient, number>;   // calories number, macros in grams
  createdAt: string;                   // ISO timestamp, for sorting
  deletedAt: string | null;            // soft-delete (M3)
};
```

Adding a nutrient (sodium, fiber, sugar, …) is a single append to `NUTRIENT_DEFS` plus a value on each seed food. The `Nutrient` union widens automatically (it's derived). Calc, validation, and UI all iterate over the registry, so they pick up new entries with no code changes. `caloriesPerGram` lets the macro chart filter to calorie-contributing nutrients without hardcoding which ones those are.

**Entry schema** (stored in `state.entries`):

```ts
type Entry = {
  id: string;                 // crypto.randomUUID()
  date: string;               // YYYY-MM-DD, local timezone
  foodId: string;             // FK into state.foods
  grams: number;              // amount consumed
  loggedAt: string;           // ISO timestamp
};
```

**Computed at render time:**

```ts
function entryCalories(entry: Entry, food: Food): number {
  return (food.per100g.calories * entry.grams) / 100;
}
```

## Alternatives considered

- **Storing calories/macros directly on each entry (denormalized):** survives food edits/deletes cleanly. Rejected because edits should retroactively correct past entries (user expectation when fixing a wrong calorie value). We'll soft-delete foods (M3) to avoid orphaned `foodId` references.
- **Per-100g vs. per-serving:** per-100g is the food-API standard (USDA, OpenFoodFacts) and works for any quantity. Per-serving requires also storing serving size and double the conversion logic. Per-100g it is. We can layer a "default serving" hint later.
- **Free-text entries** (the rejected M1 option): kept as an option for "quick log" inside M3+ if needed.

## Consequences

- The food DB is the source of truth for nutritional data. Editing a food retroactively updates historical totals — call this out in UI (M3).
- Deleting a food needs to handle existing entries. We'll soft-delete (`deletedAt: string | null`) so historical entries still render. Hard delete is a future cleanup task.
- Grams is the only unit. If the user thinks in ounces/cups, that's a future units-conversion feature.
