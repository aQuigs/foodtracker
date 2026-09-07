import type { Food, Portion, Unit } from '../domain/types.js';
import { sumNutrition } from '../domain/calc.js';
import { UNITS, compatibleUnits, isUnit } from '../domain/units.js';
import { byRank, fuzzyMatch, liveFoods } from './search.js';
import { el, formField, numberInput, reconcileChildren, renderError, searchField, setInputValue } from './dom.js';
import { formatTotals } from './nutritionFormat.js';
import { parsePositive } from './parsePositive.js';
import { createUnitPicker } from './unitPicker.js';
import type { UnitPicker } from './unitPicker.js';
import { createPickerOption } from './pickerOption.js';
import { foodLabel, foodTitle } from './foodTitle.js';
import { keyedRows } from './keyedRows.js';
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

  const nameInput = el('input', { 'data-testid': 'recipe-form-name', type: 'text' });
  nameInput.addEventListener('input', () => handlers.onNameChange(nameInput.value));
  const nameField = formField('Name', nameInput);

  const foodSearch = searchField('recipe-food-search', 'Add a food', handlers.onFoodQueryChange);
  const foodPicker = el('ul', { 'data-testid': 'recipe-food-picker', class: 'picker' });

  const itemsList = el('ul', { 'data-testid': 'recipe-form-items', class: 'recipe-form-items' });
  const total = el('p', { 'data-testid': 'recipe-form-total', class: 'recipe-form-total' });

  const submitBtn = el('button', { 'data-testid': 'recipe-form-submit', type: 'button', class: 'primary' }, ['Add recipe']);
  submitBtn.addEventListener('click', handlers.onSubmit);
  const actions = el('div', { class: 'food-form-actions' }, [submitBtn]);

  const node = el('section', { 'data-testid': 'recipe-form', class: 'recipe-form' }, [
    heading,
    nameField,
    foodSearch.field,
    foodPicker,
    itemsList,
    total,
    actions,
  ]);

  // Adding a food empties the query, which unmounts the row that was just
  // clicked and drops focus to <body>. Only that click asks for focus back;
  // loading a recipe to edit fills the same list without touching it.
  let focusSearchNext = false;

  // Keyed by foodId so an amount input keeps focus and caret position across
  // the re-render every keystroke triggers.
  const itemRows = keyedRows<ItemRow>((foodId) => {
    const nameSpan = el('span', { 'data-testid': 'recipe-form-item-name', class: 'recipe-form-item-name' });

    const amountInput = numberInput({ 'data-testid': 'recipe-form-amount', class: 'recipe-form-item-amount' });
    amountInput.addEventListener('input', () => handlers.onItemAmountChange(foodId, amountInput.value));

    const unitPicker = createUnitPicker(`recipe-form-unit-${foodId}`, 'Unit');
    const unitWrap = el('div', { class: 'recipe-form-item-unit' }, [unitPicker.group]);

    const removeBtn = el('button', { 'data-testid': 'recipe-form-remove', class: 'recipe-form-item-remove', type: 'button' }, ['×']);
    removeBtn.addEventListener('click', () => handlers.onRemoveItem(foodId));

    const li = el('li', { 'data-testid': 'recipe-form-item', 'data-food-id': foodId, class: 'recipe-form-item' }, [
      nameSpan, amountInput, unitWrap, removeBtn,
    ]);

    return { li, nameSpan, amountInput, unitPicker, removeBtn };
  });

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
      row.update({
        title: foodTitle(food, indices, brandIndices),
        onActivate: () => {
          focusSearchNext = true;
          handlers.onAddItem(food.id);
        },
      });
      return row.li;
    }));
  }

  function renderItems(vm: RecipeEditorVm, foodsById: Map<string, Food>): void {
    const desired = vm.form.items.map((item) => {
      const row = itemRows.get(item.foodId);
      const food = foodsById.get(item.foodId);
      const deleted = food === undefined || food.deletedAt !== null;
      const suffix = deleted ? ' (deleted)' : '';
      const title = food ? foodTitle(food, [], []) : ['Unknown food'];
      const ariaName = (food ? foodLabel(food) : 'Unknown food') + suffix;

      row.nameSpan.replaceChildren(...title, suffix);
      setInputValue(row.amountInput, item.amount);
      row.amountInput.setAttribute('aria-label', `Amount of ${ariaName}`);

      const allowed = food ? compatibleUnits(food) : UNITS;
      row.unitPicker.group.setAttribute('aria-label', `Unit for ${ariaName}`);
      row.unitPicker.render(allowed, isUnit(item.unit) ? item.unit : null, (u) => handlers.onItemUnitChange(item.foodId, u));

      row.removeBtn.setAttribute('aria-label', `Remove ${ariaName}`);

      return row.li;
    });

    reconcileChildren(itemsList, desired);
    itemRows.prune(vm.form.items.map((i) => i.foodId));
  }

  // A row still being filled in — no amount yet, a unit its food can't take,
  // a food since deleted — drops out of the sum rather than blanking it, so
  // the figure keeps answering "how much so far?" while the form is in flux.
  // With nothing countable yet it reads the same dash the recipe card shows,
  // rather than a row of zeros a new form has not earned.
  function renderTotal(vm: RecipeEditorVm, foodsById: Map<string, Food>): void {
    const portions: Portion[] = [];
    for (const item of vm.form.items) {
      const food = foodsById.get(item.foodId);
      if (food === undefined || food.deletedAt !== null) {
        continue;
      }

      const amount = parsePositive(item.amount);
      if (amount === null) {
        continue;
      }

      if (!isUnit(item.unit) || !compatibleUnits(food).includes(item.unit)) {
        continue;
      }

      portions.push({ foodId: item.foodId, amount, unit: item.unit });
    }

    if (portions.length === 0) {
      total.textContent = 'Total —';
      return;
    }

    total.textContent = `Total ${formatTotals(sumNutrition(portions, foodsById))}`;
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

    setInputValue(foodSearch.input, vm.form.foodQuery);
    renderFoodPicker(vm);

    const foodsById = new Map(vm.foods.map((f) => [f.id, f]));
    renderItems(vm, foodsById);
    renderTotal(vm, foodsById);

    renderError(node, 'recipe-form-error', vm.error);

    if (focusSearchNext) {
      focusSearchNext = false;
      foodSearch.input.focus();
    }
  }

  return { node, render };
}
