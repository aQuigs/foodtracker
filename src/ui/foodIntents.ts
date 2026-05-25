import { NUTRIENT_KEYS } from '../domain/types.js';
import type { Action, Food, NutritionFacts } from '../domain/types.js';
import type { IntentClock } from './intents.js';

type RawNutrition = {
  caloriesRaw: string;
  proteinRaw: string;
  carbsRaw: string;
  fatRaw: string;
};

export type FoodFormInput =
  | ({ mode: 'add'; name: string } & RawNutrition)
  | ({ mode: 'edit'; foodId: string; name: string } & RawNutrition);

export type FoodIntentResult =
  | { kind: 'action'; action: Action }
  | { kind: 'error'; message: string };

const RAW_KEY: Record<keyof NutritionFacts, keyof RawNutrition> = {
  calories: 'caloriesRaw',
  protein:  'proteinRaw',
  carbs:    'carbsRaw',
  fat:      'fatRaw',
};

function parseNutritionField(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return 0;
  }

  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }

  return n;
}

function parseNutritionFacts(raw: RawNutrition): NutritionFacts | null {
  const out = {} as NutritionFacts;
  for (const key of NUTRIENT_KEYS) {
    const n = parseNutritionField(raw[RAW_KEY[key]]);
    if (n === null) {
      return null;
    }

    out[key] = n;
  }
  return out;
}

function nameCollides(name: string, foods: Food[], ignoreId: string | null): boolean {
  const norm = name.trim().toLowerCase();
  return foods.some((f) => f.id !== ignoreId && f.deletedAt === null && f.name.toLowerCase() === norm);
}

export function parseFoodIntent(input: FoodFormInput, foods: Food[], clock: IntentClock): FoodIntentResult {
  const name = input.name.trim();
  if (name === '') {
    return { kind: 'error', message: 'Enter a name.' };
  }

  const ignoreId = input.mode === 'edit' ? input.foodId : null;
  if (nameCollides(name, foods, ignoreId)) {
    return { kind: 'error', message: 'A food with this name already exists.' };
  }

  const nutritionFacts = parseNutritionFacts(input);
  if (nutritionFacts === null) {
    return { kind: 'error', message: 'Nutrition values must be 0 or higher.' };
  }

  if (input.mode === 'add') {
    return {
      kind: 'action',
      action: {
        type: 'AddFood',
        food: {
          id: clock.newId(),
          name,
          nutritionFacts,
          createdAt: clock.now().toISOString(),
          deletedAt: null,
        },
      },
    };
  }

  return {
    kind: 'action',
    action: {
      type: 'EditFood',
      foodId: input.foodId,
      updates: { name, nutritionFacts },
    },
  };
}
