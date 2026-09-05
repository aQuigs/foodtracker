export type NutritionFacts = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

// Per-nutrient metadata. Adding a nutrient is one line on NutritionFacts +
// one entry here; everything else iterates this map.
export const NUTRIENTS: Record<keyof NutritionFacts, {
  label: string;
  shortLabel: string;
  calPerGram: number;
  unit: 'cal' | 'g';
  decimals: number;
  sliceColor: string;
}> = {
  calories: { label: 'Calories', shortLabel: 'cal', calPerGram: 0, unit: 'cal', decimals: 0, sliceColor: 'var(--accent)' },
  protein:  { label: 'Protein',  shortLabel: 'P',   calPerGram: 4, unit: 'g',   decimals: 1, sliceColor: 'var(--macro-protein)' },
  carbs:    { label: 'Carbs',    shortLabel: 'C',   calPerGram: 4, unit: 'g',   decimals: 1, sliceColor: 'var(--macro-carbs)' },
  fat:      { label: 'Fat',      shortLabel: 'F',   calPerGram: 9, unit: 'g',   decimals: 1, sliceColor: 'var(--macro-fat)' },
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
  source?: string;
};

export type Entry = {
  id: string;
  date: string;
  foodId: string;
  amount: number;
  unit: Unit;
  mealId: string;
  loggedAt: string;
  recipeLogId?: string;
};

export type Meal = {
  id: string;
  date: string;
  position: number;
};

// An amount of a food. `Entry` satisfies it structurally, so calc can sum a
// recipe's portions and a day's entries with one function.
export type Portion = {
  foodId: string;
  amount: number;
  unit: Unit;
};

export type Recipe = {
  id: string;
  name: string;
  items: Portion[];
  createdAt: string;
  deletedAt: string | null;
};

// One logged instance of a recipe. The entries it produced carry this id via
// `recipeLogId` so the log view can group and delete them together while
// calc, export and the entry detail card keep treating them as plain entries.
export type RecipeLog = {
  id: string;
  recipeId: string;
  servings: number;
};

export type State = {
  version: 2;
  enabledSources: string[];
  foods: Food[];
  meals: Meal[];
  entries: Entry[];
  recipes: Recipe[];
  recipeLogs: RecipeLog[];
};

export type FoodUpdates = Partial<Pick<Food, 'name' | 'nutritionFacts' | 'servingSize' | 'servingUnit'>>;

export type RecipeUpdates = Partial<Pick<Recipe, 'name' | 'items'>>;

// A draft can't declare a group id, any more than it can declare a meal id —
// the reducer alone stamps both when it resolves the entry into a meal.
export type EntryDraft = Omit<Entry, 'mealId' | 'recipeLogId'>;

export type Action =
  | { type: 'LogEntry'; entry: EntryDraft; newMealId: string }
  | { type: 'NewMeal'; mealId: string; date: string }
  | { type: 'DeleteEntry'; entryId: string }
  | { type: 'AddFood'; food: Food }
  | { type: 'EditFood'; foodId: string; updates: FoodUpdates }
  | { type: 'SoftDeleteFood'; foodId: string; deletedAt: string }
  | { type: 'ReviveFood'; food: Food }
  | { type: 'AddRecipe'; recipe: Recipe }
  | { type: 'EditRecipe'; recipeId: string; updates: RecipeUpdates }
  | { type: 'SoftDeleteRecipe'; recipeId: string; deletedAt: string }
  | { type: 'LogRecipe'; recipeLog: RecipeLog; entries: EntryDraft[]; newMealId: string }
  | { type: 'DeleteRecipeLog'; recipeLogId: string }
  | { type: 'ReplaceState'; state: State }
  | { type: 'SetSourceEnabled'; source: string; enabled: boolean };

export type SourcedFood = {
  id: string;
  name: string;
  nutritionFacts: NutritionFacts;
  servingSize: number;
  servingUnit: Unit;
  source: string;
  sourceId: string;
  tags?: string[];
};

export type FoodSourceManifest = {
  source: string;
  version: string;
  itemCount: number;
  sha256: string;
  generatedAt: string;
};

export type SearchOptions = {
  limit?: number;
  sources?: string[];
};
