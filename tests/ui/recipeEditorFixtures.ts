import { EMPTY_RECIPE_FORM } from '../../src/ui/recipeEditor.js';
import type { RecipeEditorHandlers, RecipeEditorVm } from '../../src/ui/recipeEditor.js';
import { SEED_AT } from '../_helpers.js';
import type { Food } from '../../src/domain/types.js';

export const egg: Food = {
  id: 'egg', name: 'Egg',
  nutritionFacts: { calories: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
  servingSize: 1, servingUnit: 'count',
  createdAt: SEED_AT, deletedAt: null,
};

export const ham: Food = {
  id: 'ham', name: 'Ham',
  nutritionFacts: { calories: 46, protein: 5.5, carbs: 1.5, fat: 1.4 },
  servingSize: 28, servingUnit: 'g',
  createdAt: SEED_AT, deletedAt: null,
};

export const deadCheddar: Food = {
  id: 'cheddar', name: 'Cheddar',
  nutritionFacts: { calories: 113, protein: 7, carbs: 0.4, fat: 9.3 },
  servingSize: 28, servingUnit: 'g',
  createdAt: SEED_AT, deletedAt: '2026-02-01T00:00:00Z',
};

export const costcoAlmonds: Food = {
  id: 'costco-almonds', name: 'Almonds', source: 'costco',
  nutritionFacts: { calories: 579, protein: 21, carbs: 22, fat: 50 },
  servingSize: 100, servingUnit: 'g',
  createdAt: SEED_AT, deletedAt: null,
};

export function noopHandlers(): RecipeEditorHandlers {
  return {
    onNameChange: () => {},
    onFoodQueryChange: () => {},
    onAddItem: () => {},
    onItemAmountChange: () => {},
    onItemUnitChange: () => {},
    onRemoveItem: () => {},
    onSubmit: () => {},
    onCancel: () => {},
  };
}

export function vm(overrides: Partial<RecipeEditorVm> = {}): RecipeEditorVm {
  return { form: { ...EMPTY_RECIPE_FORM }, foods: [egg, ham, deadCheddar], error: null, ...overrides };
}
