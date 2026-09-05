import { extendedMatch, Fzf } from 'fzf';
import type { Food } from '../domain/types.js';
import { searchKey } from '../domain/searchKey.js';
import { searchText, sourceBrand } from '../domain/foodSources.js';
import { mergeRanges } from './ranges.js';
import type { Range } from './ranges.js';

export type Named = { id: string; name: string; source?: string };

export type FoodMatch<T extends Named = Food> = {
  food: T;
  tier: number;
  indices: ReadonlyArray<Range>;
  brandIndices: ReadonlyArray<Range>;
};

// Lower tier = stronger match. fzf alone scores every subsequence hit on one
// flat scale, so against a large catalog an exact "Apple" sinks under noise.
// Classifying each hit into a tier lets an exact/prefix/word-start match always
// outrank a loose subsequence, with the fzf-found set as the fuzzy fallback.
const TIER = { EXACT: 0, PREFIX: 1, WORD_START: 2, SUBSTRING: 3, FUZZY: 4 } as const;

const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

export function liveFoods(foods: Food[]): Food[] {
  return foods.filter((f) => f.deletedAt === null);
}

function classify(nameKey: string, q: string, tokens: string[]): number {
  if (nameKey === q) {
    return TIER.EXACT;
  }

  if (nameKey.startsWith(q)) {
    return TIER.PREFIX;
  }

  const words = nameKey.split(WORD_SPLIT).filter(Boolean);

  if (tokens.every((t) => words.some((w) => w.startsWith(t)))) {
    return TIER.WORD_START;
  }

  if (tokens.every((t) => nameKey.includes(t))) {
    return TIER.SUBSTRING;
  }

  return TIER.FUZZY;
}

function positionsToRanges(positions: Set<number>, max: number): Range[] {
  const sorted = Array.from(positions).sort((a, b) => a - b);
  const raw: Range[] = sorted.map((p) => [p, p + 1] as const);
  return mergeRanges(raw, max);
}

// fzf matches over `searchText` (name, then a joining space, then the brand
// label for a brand source), so its positions cover both. Positions land in
// the name, in the brand, or on the joining space, which carries no
// character to highlight and is dropped.
function splitPositions(
  positions: Set<number>, nameLength: number, brandLength: number,
): { indices: Range[]; brandIndices: Range[] } {
  const namePositions = new Set<number>();
  const brandPositions = new Set<number>();

  for (const p of positions) {
    if (p < nameLength) {
      namePositions.add(p);
    } else if (p > nameLength) {
      brandPositions.add(p - nameLength - 1);
    }
  }

  return {
    indices: positionsToRanges(namePositions, nameLength),
    brandIndices: positionsToRanges(brandPositions, brandLength),
  };
}

export function fuzzyMatch<T extends Named>(foods: T[], query: string): FoodMatch<T>[] {
  const q = searchKey(query);

  if (q === '') {
    return foods.map((food) => ({ food, tier: TIER.EXACT, indices: [], brandIndices: [] }));
  }

  const tokens = q.split(/\s+/);

  // extendedMatch ANDs whitespace-separated terms in any order — needed for
  // natural queries ("greek yogurt") against comma-inverted catalog names
  // ("Yogurt, Greek, plain"). case-insensitive (not fzf's smart-case default)
  // keeps fzf agreeing with the catalog's case-insensitive matcher, so a
  // catalog-matched row always gets highlights. fzf folds diacritics in the
  // names it searches but not in the pattern, so it gets the folded query.
  // The selector matches on name + brand label (searchText) so a query like
  // "costco almonds" can find a pack row, but classify() below still tiers
  // against the name alone, so a plain-name query ranks exactly as before.
  // Fzf<Named[]> because fzf's option types stay unresolved for a generic
  // element type; r.item is the same T we passed in.
  const fzf = new Fzf<Named[]>(foods, {
    selector: (f) => searchText(f.name, f.source),
    match: extendedMatch,
    casing: 'case-insensitive',
    sort: false,
  });

  return fzf.find(q).map((r) => {
    const nameKey = searchKey(r.item.name);
    const brand = sourceBrand(r.item.source);
    const { indices, brandIndices } = splitPositions(r.positions, r.item.name.length, brand?.length ?? 0);
    return {
      food: r.item as T,
      tier: classify(nameKey, q, tokens),
      indices,
      brandIndices,
    };
  });
}

export function byRank<T extends Named>(
  tieBreaker: (a: T, b: T) => number,
): (a: FoodMatch<T>, b: FoodMatch<T>) => number {
  return (a, b) => (a.tier - b.tier) || tieBreaker(a.food, b.food);
}

export function searchLiveFoods(
  foods: Food[],
  query: string,
  tieBreaker: (a: Food, b: Food) => number,
): FoodMatch[] {
  const matches = fuzzyMatch(liveFoods(foods), query);
  matches.sort(byRank(tieBreaker));
  return matches;
}
