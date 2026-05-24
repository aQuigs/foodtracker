export type Nutrient = 'calories' | 'protein' | 'carbs' | 'fat';

export const NUTRIENTS: readonly Nutrient[] = ['calories', 'protein', 'carbs', 'fat'] as const;

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
  return Object.fromEntries(NUTRIENTS.map((n) => [n, 0])) as Totals;
}
