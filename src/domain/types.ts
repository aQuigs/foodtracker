export type NutrientDef = {
  key: string;
  label: string;
  unit: string;
  caloriesPerGram: number;
};

export const NUTRIENT_DEFS = [
  { key: 'calories', label: 'Calories', unit: 'cal', caloriesPerGram: 0 },
  { key: 'protein',  label: 'Protein',  unit: 'g',   caloriesPerGram: 4 },
  { key: 'carbs',    label: 'Carbs',    unit: 'g',   caloriesPerGram: 4 },
  { key: 'fat',      label: 'Fat',      unit: 'g',   caloriesPerGram: 9 },
] as const satisfies readonly NutrientDef[];

export type Nutrient = typeof NUTRIENT_DEFS[number]['key'];

export type Food = {
  id: string;
  name: string;
  per100g: Record<Nutrient, number>;
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

export type Totals = Record<Nutrient, number>;

export function zeroTotals(): Totals {
  return Object.fromEntries(NUTRIENT_DEFS.map((d) => [d.key, 0])) as Totals;
}
