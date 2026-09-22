import type { Action, EntryDraft, Portion, Recipe, State } from '../domain/types.js';
import { nameTaken } from '../domain/foodNames.js';
import { liveRecipes } from '../domain/recipes.js';
import { compatiblePickerUnits, isPickerUnit, resolvePickerAmount, roundSig, shownFor } from '../domain/units.js';
import { isPosFinite } from '../domain/validate.js';
import type { IntentClock } from './intents.js';
import { parsePositive } from './parsePositive.js';

// original: the item's own stored Portion, when editing an existing recipe —
// set once from the recipe being loaded, never reassigned as the form
// changes. It's what lets a row keep scaling from its own frozen ratio (see
// scalePortion) instead of re-resolving through the food on every save.
export type RecipeFormItem = { foodId: string; amount: string; unit: string; original?: Portion };
export type RecipeFormFields = { name: string; items: RecipeFormItem[] };
export type RecipeFormInput =
  | ({ mode: 'add' } & RecipeFormFields)
  | ({ mode: 'edit'; recipeId: string } & RecipeFormFields);

export type RecipeIntentResult =
  | { kind: 'action'; action: Action }
  | { kind: 'error'; message: string };

export function parseRecipeIntent(input: RecipeFormInput, state: State, clock: IntentClock): RecipeIntentResult {
  if (input.mode === 'edit' && !state.recipes.some((r) => r.id === input.recipeId && r.deletedAt === null)) {
    return { kind: 'error', message: 'This recipe was deleted.' };
  }

  const name = input.name.trim();
  if (name === '') {
    return { kind: 'error', message: 'Enter a name.' };
  }

  const ignoreId = input.mode === 'edit' ? input.recipeId : null;
  if (nameTaken({ name }, state.recipes, ignoreId)) {
    return { kind: 'error', message: 'A recipe with this name already exists.' };
  }

  if (input.items.length === 0) {
    return { kind: 'error', message: 'Add at least one food.' };
  }

  const seenFoodIds = new Set<string>();
  const items: Portion[] = [];
  for (const formItem of input.items) {
    const food = state.foods.find((f) => f.id === formItem.foodId && f.deletedAt === null);
    if (!food) {
      return { kind: 'error', message: 'One of the foods is no longer available.' };
    }

    if (!isPickerUnit(formItem.unit)) {
      return { kind: 'error', message: 'Pick a unit for every item.' };
    }

    const unit = formItem.unit;
    const original = formItem.original;
    const keepsOriginalUnit = original !== undefined && unit === shownFor(original).unit;

    if (!keepsOriginalUnit && !compatiblePickerUnits(food).includes(unit)) {
      return { kind: 'error', message: 'Pick a unit for every item.' };
    }

    const amount = parsePositive(formItem.amount);
    if (amount === null) {
      return { kind: 'error', message: 'Every item needs an amount greater than 0.' };
    }

    if (seenFoodIds.has(formItem.foodId)) {
      return { kind: 'error', message: 'Each food can only appear once.' };
    }

    seenFoodIds.add(formItem.foodId);

    items.push(original !== undefined && keepsOriginalUnit
      ? scalePortion(original, amount / shownFor(original).amount)
      : { foodId: formItem.foodId, ...resolvePickerAmount(amount, unit, food) });
  }

  if (input.mode === 'add') {
    return {
      kind: 'action',
      action: {
        type: 'AddRecipe',
        recipe: { id: clock.newId(), name, items, createdAt: clock.now().toISOString(), deletedAt: null },
      },
    };
  }

  return {
    kind: 'action',
    action: { type: 'EditRecipe', recipeId: input.recipeId, updates: { name, items } },
  };
}

// Amounts are keyed by foodId, not item position, so the card survives the
// recipe's items being reordered, added to, or removed from between edits.
export type RecipeDraft = { recipeId: string; amounts: Record<string, string>; servings: string };

export function draftForRecipe(recipe: Recipe): RecipeDraft {
  const amounts = Object.fromEntries(recipe.items.map((i) => [i.foodId, String(shownFor(i).amount)]));
  return { recipeId: recipe.id, amounts, servings: '1' };
}

export type RecipeDraftResult =
  | { kind: 'ok'; servings: number; portions: (Portion | null)[] }
  | { kind: 'error'; message: string };

// A blank or zero amount means "skip this item" — the card lets you log a
// subset of a recipe's foods. Anything else must be a positive number. Each
// item scales from its own stored ratio (see scalePortion), never through
// the food, so a pieces edit since the recipe was saved can't rewrite it.
export function parseRecipeDraft(draft: RecipeDraft, recipe: Recipe): RecipeDraftResult {
  const servings = parsePositive(draft.servings);
  if (servings === null) {
    return { kind: 'error', message: 'Enter servings greater than 0.' };
  }

  const portions: (Portion | null)[] = [];
  for (const item of recipe.items) {
    const typed = Number((draft.amounts[item.foodId] ?? '').trim());
    if (typed === 0) {
      portions.push(null);
      continue;
    }

    if (!Number.isFinite(typed) || typed < 0) {
      return { kind: 'error', message: 'Enter amounts of 0 or more.' };
    }

    portions.push(scalePortion(item, typed / shownFor(item).amount));
  }

  if (portions.every((p) => p === null)) {
    return { kind: 'error', message: 'Enter at least one amount greater than 0.' };
  }

  return { kind: 'ok', servings, portions };
}

// Scales a stored portion's amount and shown amount by the same factor,
// never consulting the food — the one operation allowed to rescale a row
// that's already frozen (see resolvePickerAmount).
export function scalePortion(p: Portion, k: number): Portion {
  return {
    ...p,
    amount: roundSig(p.amount * k),
    ...(p.shown === undefined ? {} : { shown: { ...p.shown, amount: roundSig(p.shown.amount * k) } }),
  };
}

export function scalePortions(portions: Portion[], servings: number): Portion[] {
  return portions.map((p) => scalePortion(p, servings));
}

export function parseRecipeLogIntent(
  draft: RecipeDraft, date: string, state: State, clock: IntentClock,
): RecipeIntentResult {
  const recipe = liveRecipes(state.recipes).find((r) => r.id === draft.recipeId);
  if (!recipe) {
    return { kind: 'error', message: 'This recipe was deleted.' };
  }

  const parsed = parseRecipeDraft(draft, recipe);
  if (parsed.kind === 'error') {
    return parsed;
  }

  const live: Portion[] = [];
  for (const portion of parsed.portions) {
    if (portion === null) {
      continue;
    }

    const food = state.foods.find((f) => f.id === portion.foodId);
    if (!food || food.deletedAt !== null) {
      return { kind: 'error', message: `${food?.name ?? 'This food'} was deleted. Edit the recipe.` };
    }

    live.push(portion);
  }

  const recipeLog = { id: clock.newId(), recipeId: recipe.id, servings: parsed.servings };
  const loggedAt = clock.now().toISOString();
  const entries: EntryDraft[] = [];
  for (const portion of scalePortions(live, parsed.servings)) {
    if (!isPosFinite(portion.amount)) {
      return { kind: 'error', message: 'Amount × servings must be greater than 0.' };
    }

    entries.push({ id: clock.newId(), date, ...portion, loggedAt });
  }

  const newMealId = clock.newId();

  return {
    kind: 'action',
    action: { type: 'LogRecipe', recipeLog, entries, newMealId },
  };
}
