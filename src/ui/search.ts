import { Fzf } from 'fzf';
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

// Fzf scores higher = better; invert so existing byScoreThen (ascending) works.
function invertScore(score: number): number {
  return -score;
}

export function fuzzyMatch<T extends Named>(foods: T[], query: string): FoodMatch<T>[] {
  const q = query.trim();
  if (q === '') {
    return foods.map((food) => ({ food, score: 0, indices: [] }));
  }

  type Tagged = { i: number; n: string };
  const tagged: Tagged[] = foods.map((f, i) => ({ i, n: f.name }));
  const fzf = new Fzf(tagged, { selector: (t: Tagged) => t.n, sort: false });

  return fzf.find(q).map((r) => {
    const food = foods[r.item.i]!;
    return {
      food,
      score: invertScore(r.score),
      indices: positionsToRanges(r.positions, food.name.length),
    };
  });
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
