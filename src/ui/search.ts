import type { Food } from '../domain/types.js';

/**
 * Subsequence match with gap penalty.
 *
 * Returns a score > 0 when every character of `query` appears in `name` in
 * order (case-insensitive), or null when no such subsequence exists.
 *
 * Score = matchedChars - (totalGapChars * 0.1)
 *
 * Smaller gaps between matched characters produce higher scores, so tighter
 * matches ("ban" in "Banana") rank above sparser ones ("ban" in "Cranberry").
 */
export function fuzzyScore(name: string, query: string): number | null {
  if (query.length === 0) {
    return null;
  }

  const n = name.toLowerCase();
  const q = query.toLowerCase();

  let ni = 0;
  let qi = 0;
  let totalGaps = 0;
  let lastMatchIndex = -1;

  while (qi < q.length && ni < n.length) {
    if (n[ni] === q[qi]) {
      if (lastMatchIndex >= 0) {
        totalGaps += ni - lastMatchIndex - 1;
      }

      lastMatchIndex = ni;
      qi++;
    }

    ni++;
  }

  if (qi < q.length) {
    return null;
  }

  return q.length - totalGaps * 0.1;
}

export function filterFoods(foods: Food[], query: string): Food[] {
  const q = query.trim();
  const live = foods.filter((f) => f.deletedAt === null);

  if (q === '') {
    return live;
  }

  type Scored = { food: Food; score: number };

  const scored: Scored[] = [];
  for (const food of live) {
    const score = fuzzyScore(food.name, q);

    if (score !== null) {
      scored.push({ food, score });
    }
  }

  scored.sort((a, b) => {
    const diff = b.score - a.score;

    if (diff !== 0) {
      return diff;
    }

    return a.food.name.localeCompare(b.food.name);
  });

  return scored.map((s) => s.food);
}
