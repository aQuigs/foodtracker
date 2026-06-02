import { MACRO_KEYS, NUTRIENT_KEYS, NUTRIENTS } from '../src/domain/types.js';
import type { NutritionFacts, SourcedFood, Unit } from '../src/domain/types.js';
import { scaleNutrition } from '../src/domain/calc.js';
import { toGrams } from '../src/domain/units.js';

export type UsdaNutrient = {
  nutrient?: { id?: number; number?: string; name?: string; unitName?: string };
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  amount?: number;
  value?: number;
};

export type UsdaFoodPortion = {
  gramWeight?: number;
  amount?: number;
  measureUnit?: { name?: string; abbreviation?: string };
  modifier?: string;
  portionDescription?: string;
};

export type UsdaFood = {
  fdcId?: number;
  description?: string;
  foodNutrients?: UsdaNutrient[];
  foodPortions?: UsdaFoodPortion[];
  servingSize?: number;
  servingSizeUnit?: string;
};

export type UsdaDump = {
  FoundationFoods?: UsdaFood[];
  SRLegacyFoods?: UsdaFood[];
  SurveyFoods?: UsdaFood[];
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
      const amount = n.amount ?? n.value;
      return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 ? amount : 0;
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

// servingGrams is the gram weight of one full serving (servingSize × servingUnit).
// USDA nutrient values are per 100 g, so it is the bridge that rescales them to
// the serving the app stores.
export type Serving = { servingSize: number; servingUnit: Unit; servingGrams: number };

const DEFAULT_SERVING: Serving = { servingSize: 100, servingUnit: 'g', servingGrams: 100 };

const WEIGHT_UNIT_WORDS = new Set([
  'g', 'gram', 'grams', 'oz', 'ounce', 'ounces', 'lb', 'pound', 'pounds',
]);

const SKIP_UNIT_WORDS = new Set([
  'undetermined', '', 'gram', 'grams', 'g',
]);

function normalizeUsdaUnit(raw: string | undefined): Unit | null {
  if (!raw) {
    return null;
  }

  const u = raw.trim().toLowerCase();
  if (u === 'g' || u === 'gram' || u === 'grams') {
    return 'g';
  }

  if (u === 'oz' || u === 'ounce' || u === 'ounces') {
    return 'oz';
  }

  if (u === 'lb' || u === 'pound' || u === 'pounds') {
    return 'lb';
  }

  return null;
}

function measureUnitWord(portion: UsdaFoodPortion): string | null {
  const raw = portion.measureUnit?.name ?? portion.measureUnit?.abbreviation;
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0 || SKIP_UNIT_WORDS.has(trimmed.toLowerCase())) {
    return null;
  }

  return trimmed;
}

type CountInfo = { amount: number; description: string };

// Returns parsed count info if `s` starts with a positive integer followed by
// at least one non-digit character (e.g. "1 medium", "2 cups"). Returns null
// for strings without a leading number (e.g. "Guideline amount per cup").
function parseLeadingCount(s: string): CountInfo | null {
  const m = s.trim().match(/^(\d+)\s+(\S.*)$/);
  if (m === null) {
    return null;
  }

  const amount = parseInt(m[1]!, 10);
  if (amount <= 0) {
    return null;
  }

  return { amount, description: `${amount} ${m[2]!.trim()}` };
}

function extractCountInfo(portion: UsdaFoodPortion): CountInfo | null {
  if (typeof portion.portionDescription === 'string') {
    const parsed = parseLeadingCount(portion.portionDescription);
    if (parsed !== null) {
      return parsed;
    }
  }

  if (typeof portion.amount !== 'number' || portion.amount <= 0) {
    return null;
  }

  const word = measureUnitWord(portion);
  if (word === null) {
    return null;
  }

  if (WEIGHT_UNIT_WORDS.has(word.toLowerCase())) {
    return null;
  }

  return { amount: portion.amount, description: `${portion.amount} ${word}` };
}

export function extractServing(food: UsdaFood): Serving {
  const directSize = food.servingSize;
  const directUnit = normalizeUsdaUnit(food.servingSizeUnit);

  if (typeof directSize === 'number' && directSize > 0 && directUnit !== null) {
    const grams = toGrams(directSize, directUnit);

    if (grams !== null) {
      return { servingSize: directSize, servingUnit: directUnit, servingGrams: grams };
    }
  }

  const portion = food.foodPortions?.[0];

  if (portion) {
    const raw = portion.gramWeight;
    const gram = typeof raw === 'number' && raw > 0 ? raw : null;

    // A count serving without a gram weight has no bridge back to the per-100g
    // nutrient basis, so it falls through to the default rather than ship
    // nutrition that cannot be rescaled.
    const info = extractCountInfo(portion);
    if (info !== null && gram !== null) {
      return { servingSize: info.amount, servingUnit: 'count', servingGrams: gram };
    }

    if (gram !== null) {
      return { servingSize: gram, servingUnit: 'g', servingGrams: gram };
    }
  }

  return DEFAULT_SERVING;
}

export function portionDescription(food: UsdaFood): string | null {
  const portion = food.foodPortions?.[0];
  if (!portion) {
    return null;
  }

  const info = extractCountInfo(portion);
  if (info === null) {
    return null;
  }

  const gram = portion.gramWeight;
  if (typeof gram === 'number' && gram > 0) {
    return `${info.description}, ${Math.round(gram)}g`;
  }

  return info.description;
}

function roundNutrition(n: NutritionFacts): NutritionFacts {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [k, Math.round(n[k] * 10) / 10]),
  ) as NutritionFacts;
}

export function mapUsdaFood(food: UsdaFood, sourceName: string): SourcedFood | null {
  if (typeof food.fdcId !== 'number' || typeof food.description !== 'string' || food.description.length === 0) {
    return null;
  }

  const sourceId = String(food.fdcId);
  const serving = extractServing(food);

  // USDA nutrient values are per 100 g; the app stores nutrition per serving.
  const nutrition = roundNutrition(
    scaleNutrition(extractNutritionFacts(food), serving.servingGrams / 100),
  );

  const desc = serving.servingUnit === 'count' ? portionDescription(food) : null;

  return {
    id: `${sourceName}:${sourceId}`,
    name: desc !== null ? `${food.description} (${desc})` : food.description,
    nutritionFacts: nutrition,
    servingSize: serving.servingSize,
    servingUnit: serving.servingUnit,
    source: sourceName,
    sourceId,
  };
}

export function mapUsdaDumps(dumps: UsdaDump[], sourceName: string): SourcedFood[] {
  const byName = new Map<string, SourcedFood>();
  for (const dump of dumps) {
    for (const list of [dump.FoundationFoods, dump.SRLegacyFoods, dump.SurveyFoods]) {
      if (!list) {
        continue;
      }

      for (const food of list) {
        const mapped = mapUsdaFood(food, sourceName);

        if (mapped !== null) {
          byName.set(mapped.name.toLowerCase(), mapped);
        }
      }
    }
  }

  const out = Array.from(byName.values());
  out.sort((a, b) => {
    if (a.name !== b.name) {
      return a.name < b.name ? -1 : 1;
    }

    return a.sourceId < b.sourceId ? -1 : 1;
  });

  return out;
}
