import { MACRO_KEYS, NUTRIENT_KEYS, NUTRIENTS } from '../src/domain/types.js';
import type { NutritionFacts, SourcedFood } from '../src/domain/types.js';
import { scaleNutrition } from '../src/domain/calc.js';

export type UsdaNutrient = {
  nutrient?: { id?: number; number?: string; name?: string; unitName?: string };
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  amount?: number;
  value?: number;
};

export type UsdaFood = {
  fdcId?: number;
  description?: string;
  foodCategory?: { description?: string };
  foodNutrients?: UsdaNutrient[];
};

export type UsdaDump = {
  FoundationFoods?: UsdaFood[];
  SRLegacyFoods?: UsdaFood[];
};

// One entry in scripts/food-classifications.json: a keep/drop judgment for a
// USDA row, made once and cached forever. The build refuses to ship any
// eligible dump row that lacks a judgment, so a dataset update fails loudly
// listing exactly the new rows — nothing ships or vanishes silently.
export type FoodClassification = {
  fdcId: number;
  keep: boolean;
  name?: string;
  reason?: string;
};

// One entry in scripts/curated-foods.json: a clean display name pointing at a
// USDA FoodData Central row. Nutrition always comes from the USDA dumps; the
// curation file only decides which rows ship and what they are called.
// countGrams marks foods logged by count (eggs): the shipped serving becomes
// 1 count weighing that many grams, with nutrition scaled to match.
export type CuratedFood = {
  name: string;
  fdcId: number;
  category: string;
  countGrams?: number;
};

const USDA_NUTRIENT_NUMBERS = {
  ENERGY_KCAL: '208',
  PROTEIN: '203',
  CARBS: '205',
  FAT: '204',
} as const;

const USDA_NUTRIENT_IDS = {
  ENERGY_KCAL: 1008,
  PROTEIN: 1003,
  CARBS: 1005,
  FAT: 1004,
} as const;

// Newer Foundation items omit the plain kcal nutrient and carry energy only
// under the Atwater entries (also kcal). Probed in order; first present wins.
const ENERGY_KCAL_FALLBACKS: ReadonlyArray<[id: number, num: string]> = [
  [USDA_NUTRIENT_IDS.ENERGY_KCAL, USDA_NUTRIENT_NUMBERS.ENERGY_KCAL],
  [2047, '957'], // Energy (Atwater General Factors)
  [2048, '958'], // Energy (Atwater Specific Factors)
];

// Some Foundation oil entries omit total fat and carry only the fatty-acid
// subcomponents. Their sum slightly understates total fat (the glycerol
// backbone isn't counted) but beats shipping a 0-fat, 0-calorie oil.
const FAT_SUBCOMPONENTS: ReadonlyArray<[id: number, num: string]> = [
  [1258, '606'], // saturated
  [1292, '645'], // monounsaturated
  [1293, '646'], // polyunsaturated
  [1257, '605'], // trans
];

function findNutrient(nutrients: UsdaNutrient[] | undefined, nutrientId: number, nutrientNumber: string): number | null {
  if (!nutrients) {
    return null;
  }

  for (const n of nutrients) {
    const id = n.nutrient?.id ?? n.nutrientId;
    const num = n.nutrient?.number ?? n.nutrientNumber;

    if (id === nutrientId || num === nutrientNumber) {
      // FDC omits `amount` on rows whose value is null; such a row must read
      // as absent so the energy and fat fallbacks still run.
      const amount = n.amount ?? n.value;
      if (typeof amount === 'number' && Number.isFinite(amount)) {
        return Math.max(amount, 0);
      }
    }
  }

  return null;
}

function findCalories(nutrients: UsdaNutrient[] | undefined): number | null {
  for (const [id, num] of ENERGY_KCAL_FALLBACKS) {
    const found = findNutrient(nutrients, id, num);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

function findFat(nutrients: UsdaNutrient[] | undefined): number {
  const explicit = findNutrient(nutrients, USDA_NUTRIENT_IDS.FAT, USDA_NUTRIENT_NUMBERS.FAT);

  if (explicit !== null) {
    return explicit;
  }

  return FAT_SUBCOMPONENTS.reduce(
    (sum, [id, num]) => sum + (findNutrient(nutrients, id, num) ?? 0), 0);
}

export function extractNutritionFacts(food: UsdaFood): NutritionFacts {
  const n: NutritionFacts = {
    calories: 0,
    protein:  findNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.PROTEIN, USDA_NUTRIENT_NUMBERS.PROTEIN) ?? 0,
    carbs:    findNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.CARBS,   USDA_NUTRIENT_NUMBERS.CARBS) ?? 0,
    fat:      findFat(food.foodNutrients),
  };

  const explicit = findCalories(food.foodNutrients);

  // Some research-grade items carry macros but no energy nutrient at all;
  // derive energy from the macros' Atwater factors rather than ship 0 kcal.
  n.calories = explicit ?? MACRO_KEYS.reduce((sum, k) => sum + n[k] * NUTRIENTS[k].calPerGram, 0);

  return n;
}

function roundNutrition(n: NutritionFacts): NutritionFacts {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [k, Math.round(n[k] * 10) / 10]),
  ) as NutritionFacts;
}

function validateCurated(curated: CuratedFood[], byFdcId: Map<number, UsdaFood>): void {
  const nameSeen = new Map<string, string>();
  const idSeen = new Set<number>();
  const missing: string[] = [];

  for (const entry of curated) {
    const key = entry.name.toLowerCase();
    const prior = nameSeen.get(key);
    if (prior !== undefined) {
      throw new Error(`duplicate curated name: "${entry.name}" collides with "${prior}"`);
    }

    nameSeen.set(key, entry.name);

    if (idSeen.has(entry.fdcId)) {
      throw new Error(`duplicate curated fdcId: ${entry.fdcId} ("${entry.name}")`);
    }

    idSeen.add(entry.fdcId);

    if (entry.countGrams !== undefined && !(Number.isFinite(entry.countGrams) && entry.countGrams > 0)) {
      throw new Error(`"${entry.name}": countGrams must be a positive number`);
    }

    if (!byFdcId.has(entry.fdcId)) {
      missing.push(`${entry.name} (${entry.fdcId})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`curated fdcIds not found in the provided dumps: ${missing.join(', ')}`);
  }
}

// Rows no judgment should ever see: whole USDA categories that are out of
// scope for a grocery-style catalog, and brand/restaurant rows (ALL-CAPS
// tokens). Changing these rules re-opens classification for the affected rows.
const EXCLUDED_CATEGORIES = new Set([
  'Baby Foods',
  'Fast Foods',
  'Restaurant Foods',
  'Meals, Entrees, and Side Dishes',
]);

type EligibleFood = UsdaFood & { fdcId: number; description: string };

function isEligible(food: UsdaFood): food is EligibleFood {
  if (typeof food.fdcId !== 'number' || typeof food.description !== 'string') {
    return false;
  }

  if (EXCLUDED_CATEGORIES.has(food.foodCategory?.description ?? '')) {
    return false;
  }

  return !/\b[A-Z][A-Z&'.]{2,}/.test(food.description.replace(/\b(USDA|BBQ)\b/g, ''));
}

function eachDumpFood(dumps: UsdaDump[], visit: (food: UsdaFood) => void): void {
  for (const dump of dumps) {
    for (const list of [dump.FoundationFoods, dump.SRLegacyFoods]) {
      for (const food of list ?? []) {
        if (food) {
          visit(food);
        }
      }
    }
  }
}

function sortByName(out: SourcedFood[]): SourcedFood[] {
  out.sort((a, b) => {
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    if (an !== bn) {
      return an < bn ? -1 : 1;
    }

    return a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0;
  });

  return out;
}

export function mapClassifiedFoods(
  dumps: UsdaDump[],
  classifications: FoodClassification[],
  sourceName: string,
  reservedNames: ReadonlySet<string> = new Set(),
): SourcedFood[] {
  const byFdcId = new Map<number, FoodClassification>();
  for (const c of classifications) {
    if (byFdcId.has(c.fdcId)) {
      throw new Error(`duplicate classification fdcId: ${c.fdcId}`);
    }

    byFdcId.set(c.fdcId, c);
  }

  const eligibleById = new Map<number, EligibleFood>();
  eachDumpFood(dumps, (food) => {
    if (isEligible(food)) {
      eligibleById.set(food.fdcId, food);
    }
  });
  const eligible = [...eligibleById.values()];

  const unclassified = eligible.filter((f) => !byFdcId.has(f.fdcId));
  if (unclassified.length > 0) {
    const listed = unclassified.slice(0, 20).map((f) => `${f.fdcId} (${f.description})`).join('\n  ');
    throw new Error(`${unclassified.length} eligible rows are unclassified — judge them in scripts/food-classifications.json:\n  ${listed}${unclassified.length > 20 ? '\n  …' : ''}`);
  }

  const nameSeen = new Map<string, string>();
  const out: SourcedFood[] = [];
  for (const food of eligible) {
    const c = byFdcId.get(food.fdcId)!;

    if (!c.keep) {
      continue;
    }

    if (typeof c.name !== 'string' || c.name.length === 0) {
      throw new Error(`classification ${c.fdcId} is kept but has no name`);
    }

    const key = c.name.toLowerCase();
    if (reservedNames.has(key)) {
      throw new Error(`classified name "${c.name}" collides with a curated food name`);
    }

    const prior = nameSeen.get(key);
    if (prior !== undefined) {
      throw new Error(`duplicate classified name: "${c.name}" collides with "${prior}"`);
    }

    nameSeen.set(key, c.name);

    out.push({
      id: `${sourceName}:${food.fdcId}`,
      name: c.name,
      nutritionFacts: roundNutrition(extractNutritionFacts(food)),
      servingSize: 100,
      servingUnit: 'g',
      source: sourceName,
      sourceId: String(food.fdcId),
      tags: [food.foodCategory?.description ?? ''].filter((t) => t.length > 0),
    });
  }

  return sortByName(out);
}

export function mapCuratedFoods(dumps: UsdaDump[], curated: CuratedFood[], sourceName: string): SourcedFood[] {
  const byFdcId = new Map<number, UsdaFood>();
  eachDumpFood(dumps, (food) => {
    if (typeof food.fdcId === 'number') {
      byFdcId.set(food.fdcId, food);
    }
  });

  validateCurated(curated, byFdcId);

  const out = curated.map((entry): SourcedFood => {
    // USDA nutrient values are per 100 g. Weight foods ship as-is on a 100 g
    // serving; count foods rescale to the gram weight of one item.
    const per100g = extractNutritionFacts(byFdcId.get(entry.fdcId)!);
    const counted = entry.countGrams !== undefined;

    return {
      id: `${sourceName}:${entry.fdcId}`,
      name: entry.name,
      nutritionFacts: roundNutrition(scaleNutrition(per100g, (entry.countGrams ?? 100) / 100)),
      servingSize: counted ? 1 : 100,
      servingUnit: counted ? 'count' : 'g',
      source: sourceName,
      sourceId: String(entry.fdcId),
      tags: [entry.category],
    };
  });

  return sortByName(out);
}
