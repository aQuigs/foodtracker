import { NUTRIENT_KEYS } from '../domain/types.js';
import type { Action, Food, NutritionFacts, Unit } from '../domain/types.js';
import { isUnit } from '../domain/units.js';
import type { IntentClock } from './intents.js';

export type RawFoodForm = {
  name: string;
  primaryUnit: string;
  weightPerUnit: string;
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

function parseUnitFields(raw: RawFoodForm): { unit: Unit; weightPerUnit: number } | null {
  if (!isUnit(raw.primaryUnit)) {
    return null;
  }

  if (raw.primaryUnit !== 'count') {
    return { unit: raw.primaryUnit, weightPerUnit: 100 };
  }

  const w = Number(raw.weightPerUnit.trim());
  if (!Number.isFinite(w) || w <= 0) {
    return null;
  }

  return { unit: 'count', weightPerUnit: w };
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

  const unitFields = parseUnitFields(input);
  if (unitFields === null) {
    return { kind: 'error', message: 'Pick a primary unit, and (for count) a weight per unit > 0.' };
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
          primaryUnit: unitFields.unit,
          weightPerUnit: unitFields.weightPerUnit,
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
      updates: { name, nutritionFacts, primaryUnit: unitFields.unit, weightPerUnit: unitFields.weightPerUnit },
    },
  };
}
