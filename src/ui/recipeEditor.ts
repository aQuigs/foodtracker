import type { Food, Unit } from '../domain/types.js';
import { UNITS, compatibleUnits, isUnit } from '../domain/units.js';
import { byRank, fuzzyMatch, liveFoods } from './search.js';
import { el, reconcileChildren, renderError, searchInput, setInputValue } from './dom.js';
import { createUnitPicker } from './unitPicker.js';
import type { UnitPicker } from './unitPicker.js';
import { createPickerOption } from './pickerOption.js';
import { foodLabel, foodTitle } from './foodTitle.js';
import type { RecipeFormFields } from './recipeIntents.js';

export type RecipeFormState = RecipeFormFields & {
  mode: 'add' | 'edit';
  recipeId: string | null;
  foodQuery: string;
};

export const EMPTY_RECIPE_FORM: RecipeFormState = {
  mode: 'add', recipeId: null, name: '', items: [], foodQuery: '',
};

export type RecipeEditorVm = {
  form: RecipeFormState;
  foods: Food[];
  error: string | null;
};

export type RecipeEditorHandlers = {
  onNameChange: (name: string) => void;
  onFoodQueryChange: (q: string) => void;
  onAddItem: (foodId: string) => void;
  onItemAmountChange: (foodId: string, amount: string) => void;
  onItemUnitChange: (foodId: string, unit: Unit) => void;
  onRemoveItem: (foodId: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

type ItemRow = {
  li: HTMLLIElement;
  nameSpan: HTMLSpanElement;
  amountInput: HTMLInputElement;
  unitPicker: UnitPicker;
  removeBtn: HTMLButtonElement;
};

export type RecipeEditor = {
  node: HTMLElement;
  render: (vm: RecipeEditorVm) => void;
};

export function createRecipeEditor(handlers: RecipeEditorHandlers): RecipeEditor {
  const heading = el('h2', {}, ['Add new recipe']);

  const nameInput = el('input', {
    'data-testid': 'recipe-form-name', type: 'text', 'aria-label': 'Name', placeholder: 'Name',
  });
  nameInput.addEventListener('input', () => handlers.onNameChange(nameInput.value));
  const nameField = el('label', { class: 'food-form-field' }, [
    el('span', { class: 'food-form-field-label' }, ['Name']),
    nameInput,
  ]);

  const foodSearchInput = searchInput('recipe-food-search', 'Add a food', handlers.onFoodQueryChange);
  const foodPicker = el('ul', { 'data-testid': 'recipe-food-picker', class: 'picker' });

  const itemsList = el('ul', { 'data-testid': 'recipe-form-items', class: 'recipe-form-items' });

  const submitBtn = el('button', { 'data-testid': 'recipe-form-submit', type: 'button', class: 'primary' }, ['Add recipe']);
  submitBtn.addEventListener('click', handlers.onSubmit);
  const actions = el('div', { class: 'food-form-actions' }, [submitBtn]);

  const node = el('section', { 'data-testid': 'recipe-form', class: 'recipe-form' }, [
    heading,
    nameField,
    foodSearchInput,
    foodPicker,
    itemsList,
    actions,
  ]);

  // Keyed by foodId so an amount input keeps focus and caret position across
  // the re-render every keystroke triggers.
  const itemRows = new Map<string, ItemRow>();

  function rowFor(foodId: string): ItemRow {
    let row = itemRows.get(foodId);
    if (row) {
      return row;
    }

    const nameSpan = el('span', { 'data-testid': 'recipe-form-item-name', class: 'recipe-form-item-name' });

    const amountInput = el('input', {
      'data-testid': 'recipe-form-amount', class: 'recipe-form-item-amount', type: 'number',
      inputmode: 'decimal', step: 'any', min: '0',
    });
    amountInput.addEventListener('input', () => handlers.onItemAmountChange(foodId, amountInput.value));

    const unitPicker = createUnitPicker(`recipe-form-unit-${foodId}`, 'Unit');
    const unitWrap = el('div', { class: 'recipe-form-item-unit' }, [unitPicker.group]);

    const removeBtn = el('button', { 'data-testid': 'recipe-form-remove', class: 'recipe-form-item-remove', type: 'button' }, ['×']);
    removeBtn.addEventListener('click', () => handlers.onRemoveItem(foodId));

    const li = el('li', { 'data-testid': 'recipe-form-item', 'data-food-id': foodId, class: 'recipe-form-item' }, [
      nameSpan, amountInput, unitWrap, removeBtn,
    ]);

    row = { li, nameSpan, amountInput, unitPicker, removeBtn };
    itemRows.set(foodId, row);
    return row;
  }

  function renderFoodPicker(vm: RecipeEditorVm): void {
    const query = vm.form.foodQuery;
    foodPicker.hidden = query.trim() === '';
    if (foodPicker.hidden) {
      return;
    }

    const inFormIds = new Set(vm.form.items.map((i) => i.foodId));
    const available = liveFoods(vm.foods).filter((f) => !inFormIds.has(f.id));
    const matches = fuzzyMatch(available, query);
    matches.sort(byRank((a, b) => a.name.localeCompare(b.name)));

    if (matches.length === 0) {
      foodPicker.replaceChildren(el('li', { 'data-testid': 'recipe-food-empty', class: 'picker-empty' }, ['No foods match.']));
      return;
    }

    foodPicker.replaceChildren(...matches.map(({ food, indices, brandIndices }) => {
      const row = createPickerOption({ testid: 'recipe-food-option', idAttr: 'data-food-id', id: food.id });
      row.update({ title: foodTitle(food, indices, brandIndices), onActivate: () => handlers.onAddItem(food.id) });
      return row.li;
    }));
  }

  function renderItems(vm: RecipeEditorVm): void {
    const foodsById = new Map(vm.foods.map((f) => [f.id, f]));

    const desired = vm.form.items.map((item) => {
      const row = rowFor(item.foodId);
      const food = foodsById.get(item.foodId);
      const ariaName = food ? foodLabel(food) : 'Unknown food';

      row.nameSpan.replaceChildren(...(food ? foodTitle(food, [], []) : ['Unknown food']));
      setInputValue(row.amountInput, item.amount);
      row.amountInput.setAttribute('aria-label', `Amount of ${ariaName}`);

      const allowed = food ? compatibleUnits(food) : UNITS;
      row.unitPicker.group.setAttribute('aria-label', `Unit for ${ariaName}`);
      row.unitPicker.render(allowed, isUnit(item.unit) ? item.unit : null, (u) => handlers.onItemUnitChange(item.foodId, u));

      row.removeBtn.setAttribute('aria-label', `Remove ${ariaName}`);

      return row.li;
    });

    reconcileChildren(itemsList, desired);

    const currentIds = new Set(vm.form.items.map((i) => i.foodId));
    for (const id of itemRows.keys()) {
      if (!currentIds.has(id)) {
        itemRows.delete(id);
      }
    }
  }

  function render(vm: RecipeEditorVm): void {
    setInputValue(nameInput, vm.form.name);
    heading.textContent = vm.form.mode === 'edit' ? 'Edit recipe' : 'Add new recipe';
    submitBtn.textContent = vm.form.mode === 'edit' ? 'Save' : 'Add recipe';

    const hasCancel = actions.querySelector('[data-testid="recipe-form-cancel"]');
    if (vm.form.mode === 'edit' && !hasCancel) {
      const cancel = el('button', { 'data-testid': 'recipe-form-cancel', type: 'button' }, ['Cancel']);
      cancel.addEventListener('click', handlers.onCancel);
      actions.append(cancel);
    } else if (vm.form.mode !== 'edit' && hasCancel) {
      hasCancel.remove();
    }

    setInputValue(foodSearchInput, vm.form.foodQuery);
    renderFoodPicker(vm);
    renderItems(vm);

    renderError(node, 'recipe-form-error', vm.error);
  }

  return { node, render };
}
