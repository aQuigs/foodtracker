import { NUTRIENT_KEYS } from '../domain/types.js';
import { nameTaken } from '../domain/foodNames.js';
import type { Action, NutritionFacts, State, Unit } from '../domain/types.js';
import { isCountUnit, isUnit } from '../domain/units.js';
import { axisLock } from '../domain/foodLocks.js';
import { liveRecipeUsing } from '../domain/recipes.js';
import type { IntentClock } from './intents.js';
import { parsePositive } from './parsePositive.js';

export type FoodFormFields = {
  name: string;
  servingSize: string;
  servingUnit: string;
} & Record<keyof NutritionFacts, string>;

export type FoodFormInput =
  | ({ mode: 'add' } & FoodFormFields)
  | ({ mode: 'edit'; foodId: string } & FoodFormFields);

export type FoodIntentResult =
  | { kind: 'action'; action: Action }
  | { kind: 'error'; message: string };

function parseNutritionField(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === '') {
    return 0;
  }

  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }

  return n;
}

function parseNutritionFacts(form: FoodFormFields): NutritionFacts | null {
  const out = {} as NutritionFacts;
  for (const key of NUTRIENT_KEYS) {
    const n = parseNutritionField(form[key]);
    if (n === null) {
      return null;
    }

    out[key] = n;
  }
  return out;
}

function parseServingFields(form: FoodFormFields): { unit: Unit; size: number } | null {
  if (!isUnit(form.servingUnit)) {
    return null;
  }

  const size = parsePositive(form.servingSize);
  if (size === null) {
    return null;
  }

  return { unit: form.servingUnit, size };
}

export function parseFoodIntent(input: FoodFormInput, state: State, clock: IntentClock): FoodIntentResult {
  const { foods } = state;
  if (input.mode === 'edit' && !foods.some((f) => f.id === input.foodId && f.deletedAt === null)) {
    return { kind: 'error', message: 'This food was deleted.' };
  }

  const name = input.name.trim();
  if (name === '') {
    return { kind: 'error', message: 'Enter a name.' };
  }

  // The form only ever creates or edits an untagged (user-made) food, so
  // identity is name alone here.
  const ignoreId = input.mode === 'edit' ? input.foodId : null;
  if (nameTaken({ name }, foods, ignoreId)) {
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
  if (current && isCountUnit(current.servingUnit) !== isCountUnit(serving.unit)) {
    const lock = axisLock(state, input.foodId);
    if (lock !== null) {
      const message = lock.kind === 'entries'
        ? 'Can’t switch this food between count and weight while existing entries reference it. Delete those entries first.'
        : `Can’t switch this food between count and weight while the ${lock.recipe.name} recipe uses it. Remove it from the recipe first.`;
      return { kind: 'error', message };
    }
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

export function parseDeleteFoodIntent(foodId: string, state: State, clock: IntentClock): FoodIntentResult {
  const food = state.foods.find((f) => f.id === foodId && f.deletedAt === null);
  if (!food) {
    return { kind: 'error', message: 'Pick a food.' };
  }

  const recipe = liveRecipeUsing(state.recipes, foodId);
  if (recipe !== null) {
    return { kind: 'error', message: `${food.name} is in the ${recipe.name} recipe. Remove it from the recipe first.` };
  }

  return {
    kind: 'action',
    action: { type: 'SoftDeleteFood', foodId, deletedAt: clock.now().toISOString() },
  };
}
