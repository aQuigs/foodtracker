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

export const NUTRIENT_KEYS = Object.keys(NUTRIENT_KIND) as (keyof NutritionFacts)[];
export const MACRO_KEYS = NUTRIENT_KEYS.filter((k) => NUTRIENT_KIND[k] === NutrientKind.Macro);

export function macros(n: NutritionFacts): Partial<NutritionFacts> {
  const out: Partial<NutritionFacts> = {};
  for (const key of MACRO_KEYS) {
    out[key] = n[key];
  }
  return out;
}

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
  for (const key of MACRO_KEYS) {
    out[key] = (n[key] * CALORIES_PER_GRAM[key]) / n.calories * 100;
  }
  return out;
}

export type Unit = 'g' | 'oz' | 'lb' | 'count';

export type Food = {
  id: string;
  name: string;
  nutritionFacts: NutritionFacts;
  servingSize: number;
  servingUnit: Unit;
  createdAt: string;
  deletedAt: string | null;
};

export type Entry = {
  id: string;
  date: string;
  foodId: string;
  amount: number;
  unit: Unit;
  loggedAt: string;
};

export type State = {
  version: 3;
  foods: Food[];
  entries: Entry[];
};

export type FoodUpdates = Partial<Pick<Food, 'name' | 'nutritionFacts' | 'servingSize' | 'servingUnit'>>;

export type Action =
  | { type: 'LogEntry'; entry: Entry }
  | { type: 'DeleteEntry'; entryId: string }
  | { type: 'AddFood'; food: Food }
  | { type: 'EditFood'; foodId: string; updates: FoodUpdates }
  | { type: 'SoftDeleteFood'; foodId: string; deletedAt: string }
  | { type: 'ReplaceState'; state: State };

export type Totals = NutritionFacts;

export function zeroTotals(): Totals {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Totals;
}
