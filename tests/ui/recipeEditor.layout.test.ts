import { expect } from '@esm-bundle/chai';
import { createRecipeEditor, EMPTY_RECIPE_FORM } from '../../src/ui/recipeEditor.js';
import { loadStyles, makeContainer } from '../_helpers.js';
import { noopHandlers, vm } from './recipeEditorFixtures.js';

const omelette = vm({
  form: { ...EMPTY_RECIPE_FORM, name: 'Omelette', items: [{ foodId: 'egg', amount: '3', unit: 'count' }] },
});

describe('recipe editor — item row layout', () => {
  before(loadStyles);

  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
    container.style.width = '480px';
    const editor = createRecipeEditor(noopHandlers());
    container.append(editor.node);
    editor.render(omelette);
  });

  afterEach(() => container.remove());

  it('sits the unit buttons next to the amount they apply to', () => {
    const amount = (container.querySelector('[data-testid="recipe-form-amount"]') as HTMLElement).getBoundingClientRect();
    const units = (container.querySelector('.unit-picker') as HTMLElement).getBoundingClientRect();
    const gap = units.left - amount.right;

    expect(gap, `${Math.round(gap)}px between the amount and its units`).to.be.within(0, 24);
    expect(units.top, 'the units sit below the amount rather than beside it').to.be.below(amount.bottom);
    expect(amount.top, 'the amount sits below the units rather than beside them').to.be.below(units.bottom);
  });

  it('fits the row without a horizontal scrollbar', () => {
    const row = container.querySelector('[data-testid="recipe-form-item"]') as HTMLElement;
    const overflow = row.scrollWidth - row.clientWidth;

    expect(overflow, `the row runs ${overflow}px past its column`).to.be.at.most(0);
  });
});
