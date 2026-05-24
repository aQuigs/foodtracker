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
