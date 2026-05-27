import Fuse from 'fuse.js';
import type { Food } from '../domain/types.js';

export type Range = readonly [start: number, endExclusive: number];

export type FoodMatch = {
  food: Food;
  score: number;
  indices: ReadonlyArray<Range>;
};

const NAME_KEY = 'name' as const satisfies keyof Food;

const FUSE_OPTIONS = {
  keys: [NAME_KEY],
  includeScore: true,
  includeMatches: true,
  // 0.5 is looser than Fuse's default (0.6) but lets initials-style queries
  // like "gy" surface "Greek yogurt"; at 0.4 they would miss entirely.
  threshold: 0.5,
  ignoreLocation: true,
  minMatchCharLength: 1,
  shouldSort: false,
};

let cachedFoods: Food[] | null = null;
let cachedFuse: Fuse<Food> | null = null;

function getFuse(foods: Food[]): Fuse<Food> {
  if (foods !== cachedFoods || cachedFuse === null) {
    cachedFuse = new Fuse(foods, FUSE_OPTIONS);
    cachedFoods = foods;
  }

  return cachedFuse;
}

export function liveFoods(foods: Food[]): Food[] {
  return foods.filter((f) => f.deletedAt === null);
}

function searchToken(fuse: Fuse<Food>, token: string): FoodMatch[] {
  return fuse.search(token).map((r) => {
    const nameMatch = r.matches?.[0];
    const indices: Range[] = (nameMatch?.indices ?? []).map(([s, e]) => [s, e + 1] as const);
    return { food: r.item, score: r.score ?? 1, indices };
  });
}

function mergeRanges(ranges: ReadonlyArray<Range>): Range[] {
  if (ranges.length === 0) {
    return [];
  }

  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: Range[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const [start, end] = sorted[i]!;
    const last = out[out.length - 1]!;
    if (start <= last[1]) {
      if (end > last[1]) {
        out[out.length - 1] = [last[0], end];
      }
    } else {
      out.push([start, end]);
    }
  }

  return out;
}

type Acc = { food: Food; tokenHits: number; score: number; indices: Range[] };

export function fuzzyMatch(foods: Food[], query: string): FoodMatch[] {
  const q = query.trim();
  if (q === '') {
    return foods.map((food) => ({ food, score: 0, indices: [] }));
  }

  const fuse = getFuse(foods);
  const tokens = q.split(/\s+/);
  if (tokens.length === 1) {
    return searchToken(fuse, tokens[0]!).map((m) => ({ ...m, indices: mergeRanges(m.indices) }));
  }

  const acc = new Map<string, Acc>();
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

  const out: FoodMatch[] = [];
  for (const { food, tokenHits, score, indices } of acc.values()) {
    if (tokenHits === tokens.length) {
      out.push({ food, score, indices: mergeRanges(indices) });
    }
  }

  return out;
}

export function byScoreThen(
  tieBreaker: (a: Food, b: Food) => number,
): (a: FoodMatch, b: FoodMatch) => number {
  return (a, b) => (a.score - b.score) || tieBreaker(a.food, b.food);
}
