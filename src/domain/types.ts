export type NutritionFacts = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

// Per-nutrient metadata. Adding a nutrient is one line on NutritionFacts +
// one entry here; everything else iterates this map.
export const NUTRIENTS: Record<keyof NutritionFacts, { label: string; calPerGram: number }> = {
  calories: { label: 'Calories', calPerGram: 0 },
  protein:  { label: 'Protein',  calPerGram: 4 },
  carbs:    { label: 'Carbs',    calPerGram: 4 },
  fat:      { label: 'Fat',      calPerGram: 9 },
};

export const NUTRIENT_KEYS = Object.keys(NUTRIENTS) as (keyof NutritionFacts)[];
export const MACRO_KEYS = NUTRIENT_KEYS.filter((k) => NUTRIENTS[k].calPerGram > 0);

export function macroPctOfCalories(n: NutritionFacts): Partial<Record<keyof NutritionFacts, number>> {
  if (!Number.isFinite(n.calories) || n.calories <= 0) {
    return {};
  }

  const out: Partial<Record<keyof NutritionFacts, number>> = {};
  for (const key of MACRO_KEYS) {
    out[key] = (n[key] * NUTRIENTS[key].calPerGram) / n.calories * 100;
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
  // Reserved for future schema migrations. Not currently inspected.
  version: 1;
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

