import { CALORIE_KEYS, NUTRIENTS, NUTRIENT_KEYS } from '../domain/types.js';
import type { Action, NutritionFacts, Pieces, State, Unit } from '../domain/types.js';
import { nameTaken } from '../domain/foodNames.js';
import { isUnit, shownFor, toGrams } from '../domain/units.js';
import type { PickerUnit } from '../domain/units.js';
import { unitLock } from '../domain/foodLocks.js';
import type { UnitLock } from '../domain/foodLocks.js';
import { liveRecipeUsing } from '../domain/recipes.js';
import type { IntentClock } from './intents.js';
import { parsePositive } from './parsePositive.js';

export type FoodFormFields = {
  name: string;
  servingSize: string;
  servingUnit: string;
  piecesPerServing: string;
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

// A count-unit food has no separate piece size to record, so the field is
// ignored (not merely disabled) whatever it holds; blank is "no pieces" for
// every other food, matching every other optional-number convention here.
function parsePiecesField(raw: string, servingUnit: Unit): Pieces | null | 'invalid' {
  if (servingUnit === 'count' || raw.trim() === '') {
    return null;
  }

  const perServing = parsePositive(raw);
  if (perServing === null || perServing < MIN_SERVING_SIZE || perServing > MAX_SERVING_SIZE) {
    return 'invalid';
  }

  return { perServing };
}

// unitLock names the stored unit; this re-finds the row for what's shown.
function lockedShownUnit(lock: UnitLock, state: State, foodId: string): PickerUnit {
  const row = lock.kind === 'entries'
    ? state.entries.find((e) => e.foodId === foodId && e.unit === lock.unit)
    : lock.recipe.items.find((i) => i.foodId === foodId && i.unit === lock.unit);

  return row === undefined ? lock.unit : shownFor(row).unit;
}

function unitLockMessage(lock: UnitLock, shown: PickerUnit): string {
  if (lock.kind === 'entries') {
    return `Can’t save — entries logged by ${shown} reference this food. Delete those entries first.`;
  }

  return `Can’t save — the ${lock.recipe.name} recipe uses ${shown} for this food. Remove it from the recipe first.`;
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

  const pieces = parsePiecesField(input.piecesPerServing, serving.unit);
  if (pieces === 'invalid') {
    return { kind: 'error', message: `Count per serving must be between ${MIN_SERVING_SIZE} and ${MAX_SERVING_SIZE.toLocaleString('en-US')}, or blank.` };
  }

  // The lock refuses the change itself, so it outranks any bound on the
  // numbers: a count food switched to grams reads as absurdly dense, and that
  // is not the reason the switch is refused.
  if (input.mode === 'edit') {
    const current = foods.find((f) => f.id === input.foodId);
    if (current) {
      const next = { servingUnit: serving.unit, ...(pieces === null ? {} : { pieces }) };
      const lock = unitLock(state, current, next);
      if (lock !== null) {
        return { kind: 'error', message: unitLockMessage(lock, lockedShownUnit(lock, state, current.id)) };
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
          ...(pieces === null ? {} : { pieces }),
        },
      },
    };
  }

  return {
    kind: 'action',
    action: {
      type: 'EditFood',
      foodId: input.foodId,
      updates: { name, nutritionFacts, servingSize: serving.size, servingUnit: serving.unit, pieces },
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
