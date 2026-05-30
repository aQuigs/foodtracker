import Fuse from 'fuse.js';
import type { Food } from '../domain/types.js';
import { mergeRanges } from './ranges.js';
import type { Range } from './ranges.js';

export type Named = { id: string; name: string };

export type FoodMatch<T extends Named = Food> = {
  food: T;
  score: number;
  indices: ReadonlyArray<Range>;
};

const FUSE_OPTIONS = {
  keys: ['name'],
  includeScore: true,
  includeMatches: true,
  // 0.5 is looser than Fuse's default (0.6) but lets initials-style queries
  // like "gy" surface "Greek yogurt"; at 0.4 they would miss entirely.
  threshold: 0.5,
  ignoreLocation: true,
  minMatchCharLength: 1,
  shouldSort: false,
};

export function liveFoods(foods: Food[]): Food[] {
  return foods.filter((f) => f.deletedAt === null);
}

function searchToken<T extends Named>(fuse: Fuse<T>, token: string): FoodMatch<T>[] {
  return fuse.search(token).map((r) => {
    const nameMatch = r.matches?.[0];
    const raw: Range[] = (nameMatch?.indices ?? []).map(([s, e]) => [s, e + 1] as const);
    return {
      food: r.item,
      score: r.score ?? 1,
      indices: mergeRanges(raw, r.item.name.length),
    };
  });
}

type Acc<T> = { food: T; tokenHits: number; score: number; indices: Range[] };

export function fuzzyMatch<T extends Named>(foods: T[], query: string): FoodMatch<T>[] {
  const q = query.trim();
  if (q === '') {
    return foods.map((food) => ({ food, score: 0, indices: [] }));
  }

  const fuse = new Fuse(foods, FUSE_OPTIONS);
  const tokens = q.split(/\s+/);
  if (tokens.length === 1) {
    return searchToken(fuse, tokens[0]!);
  }

  const acc = new Map<string, Acc<T>>();
  for (const token of tokens) {
    for (const m of searchToken(fuse, token)) {
      const prev = acc.get(m.food.id);
      if (prev === undefined) {
        acc.set(m.food.id, { food: m.food, tokenHits: 1, score: m.score, indices: [...m.indices] });
      } else {
        prev.tokenHits += 1;
        prev.score += m.score;
        prev.indices.push(...m.indices);
      }
    }
  }

  const out: FoodMatch<T>[] = [];
  for (const { food, tokenHits, score, indices } of acc.values()) {
    if (tokenHits === tokens.length) {
      out.push({ food, score, indices: mergeRanges(indices, food.name.length) });
    }
  }

  return out;
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
