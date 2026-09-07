import { CALORIE_KEYS, NUTRIENTS, NUTRIENT_KEYS } from '../domain/types.js';
import { nameTaken } from '../domain/foodNames.js';
import type { Action, NutritionFacts, State, Unit } from '../domain/types.js';
import { isCountUnit, isUnit, toGrams } from '../domain/units.js';
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
    return null;
  }

  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }

  return n;
}

function firstBlankNutrient(form: FoodFormFields): keyof NutritionFacts | null {
  return NUTRIENT_KEYS.find((key) => form[key].trim() === '') ?? null;
}

function firstOversizedNutrient(facts: NutritionFacts): keyof NutritionFacts | null {
  return NUTRIENT_KEYS.find((key) => facts[key] > NUTRIENTS[key].maxPerServing) ?? null;
}

function firstOverdenseNutrient(facts: NutritionFacts, servingGrams: number): keyof NutritionFacts | null {
  return NUTRIENT_KEYS.find((key) => facts[key] / servingGrams > NUTRIENTS[key].maxPerGram) ?? null;
}

function overdenseMessage(key: keyof NutritionFacts): string {
  const { label, maxPerGram } = NUTRIENTS[key];
  const ceiling = CALORIE_KEYS.includes(key) ? `${maxPerGram} calories` : `${maxPerGram} g of ${label.toLowerCase()}`;

  return `That’s more than ${ceiling} per gram — check the serving size.`;
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

const MIN_SERVING_SIZE = 0.01;
const MAX_SERVING_SIZE = 100000;

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

  const blank = firstBlankNutrient(input);
  if (blank !== null) {
    return { kind: 'error', message: `Enter ${NUTRIENTS[blank].label} (0 if none).` };
  }

  const nutritionFacts = parseNutritionFacts(input);
  if (nutritionFacts === null) {
    return { kind: 'error', message: 'Nutrition values must be 0 or higher.' };
  }

  const oversized = firstOversizedNutrient(nutritionFacts);
  if (oversized !== null) {
    const { label, maxPerServing } = NUTRIENTS[oversized];
    return { kind: 'error', message: `${label} can’t be more than ${maxPerServing} per serving.` };
  }

  const serving = parseServingFields(input);
  if (serving === null) {
    return { kind: 'error', message: 'Pick a serving unit and a serving size > 0.' };
  }

  // The lock refuses the change itself, so it outranks any bound on the
  // numbers: a count food switched to grams reads as absurdly dense, and that
  // is not the reason the switch is refused.
  if (input.mode === 'edit') {
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
  }

  if (serving.size < MIN_SERVING_SIZE || serving.size > MAX_SERVING_SIZE) {
    return { kind: 'error', message: `Serving size must be between ${MIN_SERVING_SIZE} and ${MAX_SERVING_SIZE.toLocaleString('en-US')}.` };
  }

  // Count foods have no gram basis; only the per-serving ceilings bound them.
  const servingGrams = toGrams(serving.size, serving.unit);
  if (servingGrams !== null) {
    const overdense = firstOverdenseNutrient(nutritionFacts, servingGrams);

    if (overdense !== null) {
      return { kind: 'error', message: overdenseMessage(overdense) };
    }
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
