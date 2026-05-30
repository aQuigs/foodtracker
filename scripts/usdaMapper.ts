import type { NutritionFacts, SourcedFood, Unit } from '../src/domain/types.js';

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

function findNutrient(nutrients: UsdaNutrient[] | undefined, nutrientId: number, nutrientNumber: string): number {
  if (!nutrients) {
    return 0;
  }

  for (const n of nutrients) {
    const id = n.nutrient?.id ?? n.nutrientId;
    const num = n.nutrient?.number ?? n.nutrientNumber;

    if (id === nutrientId || num === nutrientNumber) {
      const amount = n.amount ?? n.value;
      return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 ? amount : 0;
    }
  }

  return 0;
}

export function extractNutritionFacts(food: UsdaFood): NutritionFacts {
  return {
    calories: findNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.ENERGY_KCAL, USDA_NUTRIENT_NUMBERS.ENERGY_KCAL),
    protein:  findNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.PROTEIN,     USDA_NUTRIENT_NUMBERS.PROTEIN),
    carbs:    findNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.CARBS,       USDA_NUTRIENT_NUMBERS.CARBS),
    fat:      findNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.FAT,         USDA_NUTRIENT_NUMBERS.FAT),
  };
}

export type Serving = { servingSize: number; servingUnit: Unit };

const DEFAULT_SERVING: Serving = { servingSize: 100, servingUnit: 'g' };

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
    return { servingSize: directSize, servingUnit: directUnit };
  }

  const portion = food.foodPortions?.[0];

  if (portion) {
    const info = extractCountInfo(portion);
    if (info !== null) {
      return { servingSize: info.amount, servingUnit: 'count' };
    }

    const gram = portion.gramWeight;

    if (typeof gram === 'number' && gram > 0) {
      return { servingSize: gram, servingUnit: 'g' };
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

export function mapUsdaFood(food: UsdaFood, sourceName: string): SourcedFood | null {
  if (typeof food.fdcId !== 'number' || typeof food.description !== 'string' || food.description.length === 0) {
    return null;
  }

  const sourceId = String(food.fdcId);
  const serving = extractServing(food);
  const nutrition = extractNutritionFacts(food);
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
  const out: SourcedFood[] = [];
  for (const dump of dumps) {
    for (const list of [dump.FoundationFoods, dump.SRLegacyFoods, dump.SurveyFoods]) {
      if (!list) {
        continue;
      }

      for (const food of list) {
        const mapped = mapUsdaFood(food, sourceName);

        if (mapped !== null) {
          out.push(mapped);
        }
      }
    }
  }

  out.sort((a, b) => {
    if (a.name !== b.name) {
      return a.name < b.name ? -1 : 1;
    }

    return a.sourceId < b.sourceId ? -1 : 1;
  });

  return out;
}
