import { NUTRIENT_KEYS } from '../domain/types.js';
import type { Action, Entry, Food, NutritionFacts, Unit } from '../domain/types.js';
import { isCountUnit, isUnit } from '../domain/units.js';
import type { IntentClock } from './intents.js';

export type RawFoodForm = {
  name: string;
  servingSize: string;
  servingUnit: string;
} & Record<keyof NutritionFacts, string>;

export type FoodFormInput =
  | ({ mode: 'add' } & RawFoodForm)
  | ({ mode: 'edit'; foodId: string } & RawFoodForm);

export type FoodIntentResult =
  | { kind: 'action'; action: Action }
  | { kind: 'error'; message: string };

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

function parseNutritionFacts(raw: RawFoodForm): NutritionFacts | null {
  const out = {} as NutritionFacts;
  for (const key of NUTRIENT_KEYS) {
    const n = parseNutritionField(raw[key]);
    if (n === null) {
      return null;
    }

    out[key] = n;
  }
  return out;
}

function nameCollides(name: string, foods: Food[], ignoreId: string | null): boolean {
  const norm = name.toLowerCase();
  return foods.some((f) => f.id !== ignoreId && f.deletedAt === null && f.name.toLowerCase() === norm);
}

function parseServingFields(raw: RawFoodForm): { unit: Unit; size: number } | null {
  if (!isUnit(raw.servingUnit)) {
    return null;
  }

  const size = Number(raw.servingSize.trim());
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }

  return { unit: raw.servingUnit, size };
}

export function parseFoodIntent(input: FoodFormInput, foods: Food[], entries: Entry[], clock: IntentClock): FoodIntentResult {
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

  const serving = parseServingFields(input);
  if (serving === null) {
    return { kind: 'error', message: 'Pick a serving unit and a serving size > 0.' };
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
          servingSize: serving.size,
          servingUnit: serving.unit,
          createdAt: clock.now().toISOString(),
          deletedAt: null,
        },
      },
    };
  }

  const current = foods.find((f) => f.id === input.foodId);
  if (current && isCountUnit(current.servingUnit) !== isCountUnit(serving.unit)
    && entries.some((e) => e.foodId === input.foodId)) {
    return { kind: 'error', message: 'Can’t switch this food between count and weight while existing entries reference it. Delete those entries first.' };
  }

  return {
    kind: 'action',
    action: {
      type: 'EditFood',
      foodId: input.foodId,
      updates: { name, nutritionFacts, servingSize: serving.size, servingUnit: serving.unit },
    },
  };
}
