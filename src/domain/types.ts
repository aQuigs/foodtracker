export type Food = {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
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

export type Totals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
