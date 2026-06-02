import { extendedMatch, Fzf } from 'fzf';
import type { Food } from '../domain/types.js';
import { mergeRanges } from './ranges.js';
import type { Range } from './ranges.js';

export type Named = { id: string; name: string };

export type FoodMatch<T extends Named = Food> = {
  food: T;
  score: number;
  indices: ReadonlyArray<Range>;
};

export function liveFoods(foods: Food[]): Food[] {
  return foods.filter((f) => f.deletedAt === null);
}

function positionsToRanges(positions: Set<number>, max: number): Range[] {
  const sorted = Array.from(positions).sort((a, b) => a - b);
  const raw: Range[] = sorted.map((p) => [p, p + 1] as const);
  return mergeRanges(raw, max);
}

export function fuzzyMatch<T extends Named>(foods: T[], query: string): FoodMatch<T>[] {
  const q = query.trim();
  if (q === '') {
    return foods.map((food) => ({ food, score: 0, indices: [] }));
  }

  // extendedMatch ANDs whitespace-separated terms in any order — needed for
  // natural queries ("greek yogurt") against comma-inverted USDA names
  // ("Yogurt, Greek, plain, nonfat"). case-insensitive (not fzf's smart-case
  // default) keeps fzf agreeing with the catalog's case-insensitive matcher,
  // so a catalog-matched row always gets highlights.
  // Instantiated as Fzf<Named[]> because fzf's option types stay unresolved
  // for a generic element type; r.item is the same T we passed in.
  const fzf = new Fzf<Named[]>(foods, {
    selector: (f) => f.name,
    match: extendedMatch,
    casing: 'case-insensitive',
    sort: false,
  });

  return fzf.find(q).map((r) => ({
    food: r.item as T,
    // fzf scores higher = better; negate so byScoreThen (ascending) works.
    score: -r.score,
    indices: positionsToRanges(r.positions, r.item.name.length),
  }));
}

export function byScoreThen<T extends Named>(
  tieBreaker: (a: T, b: T) => number,
): (a: FoodMatch<T>, b: FoodMatch<T>) => number {
  return (a, b) => (a.score - b.score) || tieBreaker(a.food, b.food);
}

export function userPickerOrder(
  foods: Food[],
  query: string,
  tieBreaker: (a: Food, b: Food) => number,
): FoodMatch[] {
  const matches = fuzzyMatch(liveFoods(foods), query);
  matches.sort(byScoreThen(tieBreaker));
  return matches;
}
