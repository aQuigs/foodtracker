export type NutritionFacts = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const NutrientKind = {
  Energy: 'energy',
  Macro:  'macro',
} as const;

type NutrientKindValue = typeof NutrientKind[keyof typeof NutrientKind];

export const NUTRIENT_KIND: Record<keyof NutritionFacts, NutrientKindValue> = {
  calories: NutrientKind.Energy,
  protein:  NutrientKind.Macro,
  carbs:    NutrientKind.Macro,
  fat:      NutrientKind.Macro,
};

export function macros(n: NutritionFacts): Partial<NutritionFacts> {
  const out: Partial<NutritionFacts> = {};
  for (const key of Object.keys(NUTRIENT_KIND) as (keyof NutritionFacts)[]) {
    if (NUTRIENT_KIND[key] === NutrientKind.Macro) {
      out[key] = n[key];
    }
  }
  return out;
}

// Atwater factors: kcal per gram of each macronutrient. `calories` is itself the
// energy total, not a contributor, so it gets 0.
export const CALORIES_PER_GRAM: Record<keyof NutritionFacts, number> = {
  calories: 0,
  protein:  4,
  carbs:    4,
  fat:      9,
};

export const NUTRIENT_LABEL: Record<keyof NutritionFacts, string> = {
  calories: 'Calories',
  protein:  'Protein',
  carbs:    'Carbs',
  fat:      'Fat',
};

export function macroPctOfCalories(n: NutritionFacts): Partial<Record<keyof NutritionFacts, number>> {
  if (!Number.isFinite(n.calories) || n.calories <= 0) {
    return {};
  }

  const out: Partial<Record<keyof NutritionFacts, number>> = {};
  for (const key of Object.keys(macros(n)) as (keyof NutritionFacts)[]) {
    out[key] = (n[key] * CALORIES_PER_GRAM[key]) / n.calories * 100;
  }
  return out;
}

export type Food = {
  id: string;
  name: string;
  nutritionFacts: NutritionFacts;
  createdAt: string;
  deletedAt: string | null;
};

export type Entry = {
  id: string;
  date: string;
  foodId: string;
  grams: number;
  loggedAt: string;
};

export type State = {
  version: 1;
  foods: Food[];
  entries: Entry[];
};

export type Action =
  | { type: 'LogEntry'; entry: Entry }
  | { type: 'DeleteEntry'; entryId: string };

export type Totals = NutritionFacts;

export function zeroTotals(): Totals {
  return Object.fromEntries(
    Object.keys(NUTRIENT_KIND).map((k) => [k, 0]),
  ) as Totals;
}
