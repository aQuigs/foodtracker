import Fuse from 'fuse.js';
import type { Food } from '../domain/types.js';

export type FoodMatch = {
  food: Food;
  score: number;
  indices: ReadonlyArray<readonly [number, number]>;
};

const FUSE_OPTIONS = {
  keys: ['name'],
  includeScore: true,
  includeMatches: true,
  threshold: 0.5,
  ignoreLocation: true,
  minMatchCharLength: 1,
  shouldSort: false,
};

export function liveFoods(foods: Food[]): Food[] {
  return foods.filter((f) => f.deletedAt === null);
}

function searchSingleToken(fuse: Fuse<Food>, token: string): FoodMatch[] {
  return fuse.search(token).map((r) => {
    const nameMatch = r.matches?.find((m) => m.key === 'name');
    return {
      food: r.item,
      score: r.score ?? 1,
      indices: nameMatch?.indices ?? [],
    };
  });
}

export function fuzzyMatch(foods: Food[], query: string): FoodMatch[] {
  const q = query.trim();
  if (q === '') {
    return foods.map((food) => ({ food, score: 0, indices: [] }));
  }

  const fuse = new Fuse(foods, FUSE_OPTIONS);
  const tokens = q.split(/\s+/);
  if (tokens.length === 1) {
    return searchSingleToken(fuse, tokens[0]!);
  }

  const perToken = tokens.map((t) => searchSingleToken(fuse, t));
  const idCounts = new Map<string, number>();
  for (const list of perToken) {
    for (const m of list) {
      idCounts.set(m.food.id, (idCounts.get(m.food.id) ?? 0) + 1);
    }
  }

  const survivors = new Set<string>();
  for (const [id, n] of idCounts) {
    if (n === tokens.length) {
      survivors.add(id);
    }
  }

  const merged = new Map<string, FoodMatch>();
  for (const list of perToken) {
    for (const m of list) {
      if (!survivors.has(m.food.id)) {
        continue;
      }

      const prev = merged.get(m.food.id);
      if (prev === undefined) {
        merged.set(m.food.id, { food: m.food, score: m.score, indices: [...m.indices] });
      } else {
        merged.set(m.food.id, {
          food: m.food,
          score: prev.score + m.score,
          indices: [...prev.indices, ...m.indices],
        });
      }
    }
  }

  return [...merged.values()];
}

export function byScoreThen<T extends FoodMatch>(
  tieBreaker: (a: Food, b: Food) => number,
): (a: T, b: T) => number {
  return (a, b) => (a.score - b.score) || tieBreaker(a.food, b.food);
}
