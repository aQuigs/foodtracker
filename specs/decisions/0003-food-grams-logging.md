# 0003 — Food + grams logging model (M1)

**Date:** 2026-05-23

## Context

Two MVP models were considered: (a) free-text "ate a banana, 107 cal" entries, (b) pick a food from a DB + enter grams, calories computed. User chose (b). This decision locks in the schema for foods and entries from M1.

## Decision

**Nutrition facts — concrete struct, values per 100g of food:**

```ts
type NutritionFacts = {
  calories: number;
  protein: number;  // grams
  carbs: number;    // grams
  fat: number;      // grams
};
```

**Subset classification, kept beside the struct:**

```ts
type NutrientKind = 'energy' | 'macro';

const NUTRIENT_KIND: Record<keyof NutritionFacts, NutrientKind> = {
  calories: 'energy',
  protein:  'macro',
  carbs:    'macro',
  fat:      'macro',
};

function macros(n: NutritionFacts): Partial<NutritionFacts> { … }   // filters by kind
```

Adding a nutrient (sodium, fiber, sugar, …) is: one new field on `NutritionFacts`, one entry in `NUTRIENT_KIND` (`Record<keyof NutritionFacts, …>` forces this — the compiler refuses to build until you classify the new field), one value per seed food, one line on the validator. Call sites that render macros iterate `Object.entries(macros(food.nutritionFacts))` — they never enumerate field names as string literals, so a new macro appears in the chart with zero edits at render code.

**Food schema** (stored in `state.foods`):

```ts
type Food = {
  id: string;                       // crypto.randomUUID()
  name: string;                     // user-facing label
  nutritionFacts: NutritionFacts;   // see above; values per 100g
  createdAt: string;                // ISO timestamp, for sorting
  deletedAt: string | null;         // soft-delete (M3)
};
```

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
  return (food.nutritionFacts.calories * entry.grams) / 100;
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
