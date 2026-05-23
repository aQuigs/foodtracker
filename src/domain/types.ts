export type Unit = 'g' | 'oz' | 'lb' | 'count';

export type Food = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  primaryUnit: Unit;
  weightPerUnit: number;
  chips: number[] | null;
  createdAt: string;
  deletedAt: string | null;
};

export type Meal = {
  id: string;
  date: string;
  name: string;
  createdAt: string;
};

export type Entry = {
  id: string;
  date: string;
  foodId: string;
  amount: number;
  unit: Unit;
  grams: number;
  loggedAt: string;
  mealId: string;
};

export type State = {
  version: 5;
  foods: Food[];
  entries: Entry[];
  meals: Meal[];
};

export type FoodUpdates = Partial<Pick<Food, 'name' | 'kcalPer100g' | 'proteinPer100g' | 'carbsPer100g' | 'fatPer100g' | 'primaryUnit' | 'weightPerUnit' | 'chips'>>;

export type Action =
  | { type: 'LogEntry'; entry: Entry }
  | { type: 'DeleteEntry'; entryId: string }
  | { type: 'AddFood'; food: Food }
  | { type: 'EditFood'; foodId: string; updates: FoodUpdates }
  | { type: 'SoftDeleteFood'; foodId: string; deletedAt: string }
  | { type: 'ReplaceState'; state: State }
  | { type: 'StartNextMeal'; meal: Meal };

export type Totals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};
