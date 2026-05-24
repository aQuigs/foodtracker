import type { Action, Food, Unit } from '../domain/types.js';
import type { IntentClock } from './intents.js';

type FoodFormFields = {
  name: string;
  kcalRaw: string;
  proteinRaw: string;
  carbsRaw: string;
  fatRaw: string;
  primaryUnit: Unit;
  weightPerUnitRaw: string;
};

export type FoodFormInput =
  | (FoodFormFields & { mode: 'add' })
  | (FoodFormFields & { mode: 'edit'; foodId: string });

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

function parseWeightPerUnit(raw: string, primaryUnit: Unit): number | null {
  if (primaryUnit !== 'count') {
    return 100;
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }

  return n;
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

  const kcal    = parseNutritionField(input.kcalRaw);
  const protein = parseNutritionField(input.proteinRaw);
  const carbs   = parseNutritionField(input.carbsRaw);
  const fat     = parseNutritionField(input.fatRaw);
  if (kcal === null || protein === null || carbs === null || fat === null) {
    return { kind: 'error', message: 'Nutrition values must be 0 or higher.' };
  }

  const weightPerUnit = parseWeightPerUnit(input.weightPerUnitRaw, input.primaryUnit);
  if (weightPerUnit === null) {
    return { kind: 'error', message: 'Enter a weight per unit greater than 0.' };
  }

  if (input.mode === 'add') {
    return {
      kind: 'action',
      action: {
        type: 'AddFood',
        food: {
          id: clock.newId(),
          name,
          kcalPer100g: kcal,
          proteinPer100g: protein,
          carbsPer100g: carbs,
          fatPer100g: fat,
          primaryUnit: input.primaryUnit,
          weightPerUnit,
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
      updates: {
        name,
        kcalPer100g: kcal,
        proteinPer100g: protein,
        carbsPer100g: carbs,
        fatPer100g: fat,
        primaryUnit: input.primaryUnit,
        weightPerUnit,
      },
    },
  };
}
