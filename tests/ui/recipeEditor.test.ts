import { expect } from '@esm-bundle/chai';
import { createRecipeEditor, EMPTY_RECIPE_FORM } from '../../src/ui/recipeEditor.js';
import type { RecipeEditorHandlers, RecipeEditorVm } from '../../src/ui/recipeEditor.js';
import { makeContainer } from '../_helpers.js';
import type { Food } from '../../src/domain/types.js';

const egg: Food = {
  id: 'egg', name: 'Egg',
  nutritionFacts: { calories: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
  servingSize: 1, servingUnit: 'count',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const ham: Food = {
  id: 'ham', name: 'Ham',
  nutritionFacts: { calories: 46, protein: 5.5, carbs: 1.5, fat: 1.4 },
  servingSize: 28, servingUnit: 'g',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const deadCheddar: Food = {
  id: 'cheddar', name: 'Cheddar',
  nutritionFacts: { calories: 113, protein: 7, carbs: 0.4, fat: 9.3 },
  servingSize: 28, servingUnit: 'g',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: '2026-02-01T00:00:00Z',
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

function vm(overrides: Partial<RecipeEditorVm> = {}): RecipeEditorVm {
  return { form: { ...EMPTY_RECIPE_FORM }, foods: [egg, ham, deadCheddar], error: null, ...overrides };
}

describe('recipeEditor', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('shows "Add new recipe" in add mode and "Edit recipe" in edit mode', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    render(vm());
    expect(node.querySelector('h2')!.textContent).to.equal('Add new recipe');
    render(vm({ form: { ...EMPTY_RECIPE_FORM, mode: 'edit', recipeId: 'r1' } }));
    expect(node.querySelector('h2')!.textContent).to.equal('Edit recipe');
  });

  it('reflects the name in the input and fires onNameChange on input', () => {
    let captured = '';
    const { node, render } = createRecipeEditor({ ...noopHandlers(), onNameChange: (n) => { captured = n; } });
    container.append(node);
    render(vm({ form: { ...EMPTY_RECIPE_FORM, name: 'Omelette' } }));
    expect((node.querySelector('[data-testid="recipe-form-name"]') as HTMLInputElement).value).to.equal('Omelette');

    const input = node.querySelector('[data-testid="recipe-form-name"]') as HTMLInputElement;
    input.value = 'Frittata';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.equal('Frittata');
  });

  it('fires onFoodQueryChange on the food search input', () => {
    let captured = '';
    const { node, render } = createRecipeEditor({ ...noopHandlers(), onFoodQueryChange: (q) => { captured = q; } });
    container.append(node);
    render(vm());
    const input = node.querySelector('[data-testid="recipe-food-search"]') as HTMLInputElement;
    input.value = 'ha';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.equal('ha');
  });

  it('hides the food picker when the query is empty', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    render(vm());
    const picker = node.querySelector('[data-testid="recipe-food-picker"]') as HTMLElement;
    expect(picker.hidden).to.equal(true);
  });

  it('shows matching live foods not already in the form when the query is non-empty', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    render(vm({ form: { ...EMPTY_RECIPE_FORM, foodQuery: 'e' } }));
    const picker = node.querySelector('[data-testid="recipe-food-picker"]') as HTMLElement;
    expect(picker.hidden).to.equal(false);
    const ids = Array.from(picker.querySelectorAll('[data-testid="recipe-food-option"]')).map((o) => o.getAttribute('data-food-id'));
    expect(ids).to.include('egg');
    expect(ids).to.not.include('cheddar');
  });

  it('excludes a food already added to the form from the picker', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    render(vm({
      form: { ...EMPTY_RECIPE_FORM, foodQuery: 'e', items: [{ foodId: 'egg', amount: '1', unit: 'count' }] },
    }));
    const ids = Array.from(node.querySelectorAll('[data-testid="recipe-food-option"]')).map((o) => o.getAttribute('data-food-id'));
    expect(ids).to.not.include('egg');
  });

  it('shows "No foods match." when nothing matches the query', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    render(vm({ form: { ...EMPTY_RECIPE_FORM, foodQuery: 'zzz' } }));
    const empty = node.querySelector('[data-testid="recipe-food-empty"]');
    expect(empty).to.exist;
    expect(empty!.textContent).to.equal('No foods match.');
  });

  it('fires onAddItem when a picker row is clicked', () => {
    let captured = '';
    const { node, render } = createRecipeEditor({ ...noopHandlers(), onAddItem: (id) => { captured = id; } });
    container.append(node);
    render(vm({ form: { ...EMPTY_RECIPE_FORM, foodQuery: 'egg' } }));
    (node.querySelector('[data-testid="recipe-food-option"]') as HTMLElement).click();
    expect(captured).to.equal('egg');
  });

  it('fires onAddItem on Enter and Space keydown', () => {
    let count = 0;
    const { node, render } = createRecipeEditor({ ...noopHandlers(), onAddItem: () => { count++; } });
    container.append(node);
    render(vm({ form: { ...EMPTY_RECIPE_FORM, foodQuery: 'egg' } }));
    const opt = node.querySelector('[data-testid="recipe-food-option"]') as HTMLElement;
    opt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    opt.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(count).to.equal(2);
  });

  it('renders one item row per form item, resolving the food name', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    render(vm({
      form: {
        ...EMPTY_RECIPE_FORM,
        items: [{ foodId: 'egg', amount: '3', unit: 'count' }, { foodId: 'ham', amount: '56', unit: 'g' }],
      },
    }));
    expect(node.querySelectorAll('[data-testid="recipe-form-item"]')).to.have.lengthOf(2);
    const names = Array.from(node.querySelectorAll('[data-testid="recipe-form-item-name"]')).map((n) => n.textContent);
    expect(names).to.deep.equal(['Egg', 'Ham']);
  });

  it('shows "Unknown food" for an item whose food is missing from vm.foods', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    render(vm({ form: { ...EMPTY_RECIPE_FORM, items: [{ foodId: 'ghost', amount: '1', unit: 'g' }] } }));
    expect(node.querySelector('[data-testid="recipe-form-item-name"]')!.textContent).to.equal('Unknown food');
  });

  it('reflects each item\'s amount and fires onItemAmountChange with the foodId', () => {
    let captured: [string, string] | null = null;
    const { node, render } = createRecipeEditor({
      ...noopHandlers(), onItemAmountChange: (id, amount) => { captured = [id, amount]; },
    });
    container.append(node);
    render(vm({ form: { ...EMPTY_RECIPE_FORM, items: [{ foodId: 'egg', amount: '3', unit: 'count' }] } }));
    const input = node.querySelector('[data-testid="recipe-form-amount"]') as HTMLInputElement;
    expect(input.value).to.equal('3');
    input.value = '4';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.deep.equal(['egg', '4']);
  });

  it('offers only compatible units for a known food and all units for an unknown one', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    render(vm({
      form: {
        ...EMPTY_RECIPE_FORM,
        items: [{ foodId: 'egg', amount: '3', unit: 'count' }, { foodId: 'ghost', amount: '1', unit: 'g' }],
      },
    }));
    const rows = node.querySelectorAll('[data-testid="recipe-form-item"]');
    const eggGroup = (rows[0] as HTMLElement).querySelector('.unit-picker') as HTMLElement;
    const eggEnabled = Array.from(eggGroup.querySelectorAll('button')).filter((b) => !b.disabled);
    expect(eggEnabled.map((b) => b.getAttribute('data-unit'))).to.deep.equal(['count']);

    const ghostGroup = (rows[1] as HTMLElement).querySelector('.unit-picker') as HTMLElement;
    const ghostEnabled = Array.from(ghostGroup.querySelectorAll('button')).filter((b) => !b.disabled);
    expect(ghostEnabled.map((b) => b.getAttribute('data-unit'))).to.deep.equal(['g', 'oz', 'lb', 'count']);
  });

  it('fires onItemUnitChange with the foodId and unit when a unit button is clicked', () => {
    let captured: [string, string] | null = null;
    const { node, render } = createRecipeEditor({
      ...noopHandlers(), onItemUnitChange: (id, u) => { captured = [id, u]; },
    });
    container.append(node);
    render(vm({ form: { ...EMPTY_RECIPE_FORM, items: [{ foodId: 'ham', amount: '56', unit: 'g' }] } }));
    const group = node.querySelector('.unit-picker') as HTMLElement;
    (group.querySelector('[data-unit="oz"]') as HTMLButtonElement).click();
    expect(captured).to.deep.equal(['ham', 'oz']);
  });

  it('fires onRemoveItem with the foodId when the remove button is clicked', () => {
    let captured = '';
    const { node, render } = createRecipeEditor({ ...noopHandlers(), onRemoveItem: (id) => { captured = id; } });
    container.append(node);
    render(vm({ form: { ...EMPTY_RECIPE_FORM, items: [{ foodId: 'egg', amount: '3', unit: 'count' }] } }));
    (node.querySelector('[data-testid="recipe-form-remove"]') as HTMLButtonElement).click();
    expect(captured).to.equal('egg');
  });

  it('preserves focus on an amount input across a re-render that only changes its value', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    const items = [{ foodId: 'egg', amount: '3', unit: 'count' }];
    render(vm({ form: { ...EMPTY_RECIPE_FORM, items } }));
    const input = node.querySelector('[data-testid="recipe-form-amount"]') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).to.equal(input);

    render(vm({ form: { ...EMPTY_RECIPE_FORM, items: [{ ...items[0]!, amount: '4' }] } }));
    expect(document.activeElement).to.equal(input);
    expect(input.value).to.equal('4');
  });

  it('shows "Add recipe" on submit in add mode and "Save" in edit mode', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    render(vm());
    expect(node.querySelector('[data-testid="recipe-form-submit"]')!.textContent).to.equal('Add recipe');
    render(vm({ form: { ...EMPTY_RECIPE_FORM, mode: 'edit', recipeId: 'r1' } }));
    expect(node.querySelector('[data-testid="recipe-form-submit"]')!.textContent).to.equal('Save');
  });

  it('fires onSubmit when the submit button is clicked', () => {
    let fired = false;
    const { node, render } = createRecipeEditor({ ...noopHandlers(), onSubmit: () => { fired = true; } });
    container.append(node);
    render(vm());
    (node.querySelector('[data-testid="recipe-form-submit"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('shows a cancel button only in edit mode and fires onCancel', () => {
    let fired = false;
    const { node, render } = createRecipeEditor({ ...noopHandlers(), onCancel: () => { fired = true; } });
    container.append(node);
    render(vm());
    expect(node.querySelector('[data-testid="recipe-form-cancel"]')).to.equal(null);

    render(vm({ form: { ...EMPTY_RECIPE_FORM, mode: 'edit', recipeId: 'r1' } }));
    const cancel = node.querySelector('[data-testid="recipe-form-cancel"]') as HTMLButtonElement;
    expect(cancel).to.exist;
    cancel.click();
    expect(fired).to.equal(true);
  });

  it('shows and clears the form error', () => {
    const { node, render } = createRecipeEditor(noopHandlers());
    container.append(node);
    render(vm({ error: 'Enter a name.' }));
    expect(node.querySelector('[data-testid="recipe-form-error"]')!.textContent).to.equal('Enter a name.');
    render(vm({ error: null }));
    expect(node.querySelector('[data-testid="recipe-form-error"]')).to.equal(null);
  });
});
