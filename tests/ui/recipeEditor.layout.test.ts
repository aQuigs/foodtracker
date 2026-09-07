import { expect } from '@esm-bundle/chai';
import { createRecipeEditor, EMPTY_RECIPE_FORM } from '../../src/ui/recipeEditor.js';
import type { RecipeEditorHandlers, RecipeEditorVm } from '../../src/ui/recipeEditor.js';
import { SEED_AT, loadStyles, makeContainer } from '../_helpers.js';
import type { Food } from '../../src/domain/types.js';

const egg: Food = {
  id: 'egg', name: 'Egg',
  nutritionFacts: { calories: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
  servingSize: 1, servingUnit: 'count', createdAt: SEED_AT, deletedAt: null,
};

function noopHandlers(): RecipeEditorHandlers {
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

function vm(): RecipeEditorVm {
  return {
    form: { ...EMPTY_RECIPE_FORM, name: 'Omelette', items: [{ foodId: 'egg', amount: '3', unit: 'count' }] },
    foods: [egg],
    error: null,
  };
}

describe('recipe editor — item row layout', () => {
  before(loadStyles);

  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
    container.style.width = '480px';
    const editor = createRecipeEditor(noopHandlers());
    container.append(editor.node);
    editor.render(vm());
  });

  afterEach(() => container.remove());

  it('sits the unit buttons next to the amount they apply to', () => {
    const amount = container.querySelector('[data-testid="recipe-form-amount"]') as HTMLElement;
    const units = container.querySelector('.unit-picker') as HTMLElement;
    const gap = units.getBoundingClientRect().left - amount.getBoundingClientRect().right;

    expect(gap, `${Math.round(gap)}px of dead space between the amount and its units`).to.be.below(24);
  });

  it('fits the row without a horizontal scrollbar', () => {
    const row = container.querySelector('[data-testid="recipe-form-item"]') as HTMLElement;
    const overflow = row.scrollWidth - row.clientWidth;

    expect(overflow, `the row runs ${overflow}px past its column`).to.be.at.most(0);
  });
});
