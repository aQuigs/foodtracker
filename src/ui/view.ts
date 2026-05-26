import { dailyTotals, entryCalories } from '../domain/calc.js';
import { MACRO_KEYS, NUTRIENT_KEYS, NUTRIENTS, macroPctOfCalories } from '../domain/types.js';
import type { NutritionFacts, State, Unit } from '../domain/types.js';
import { UNITS, compatibleUnits, entryServings, isUnit } from '../domain/units.js';
import { filterFoods } from './search.js';
import type { FoodFormFields } from './foodIntents.js';
import { sortFoodsForLog } from './recent.js';

export type FoodFormState = FoodFormFields & {
  mode: 'add' | 'edit';
  foodId: string | null;
};

export type FoodFormField = keyof FoodFormFields;

export type ViewModel = {
  state: State;
  today: string;
  now: Date;
  selectedDate: string;
  query: string;
  selectedFoodId: string | null;
  amount: string;
  logUnit: Unit;
  error: string | null;
  view: 'log' | 'foods';
  foodForm: FoodFormState;
  foodFormError: string | null;
  importText: string;
  importError: string | null;
  exportText: string;
  foodsQuery: string;
};

export type ViewHandlers = {
  onLog: (foodId: string, amount: string, unit: Unit) => void;
  onDelete: (entryId: string) => void;
  onQueryChange: (q: string) => void;
  onFoodSelect: (foodId: string) => void;
  onAmountChange: (a: string) => void;
  onLogUnitChange: (u: Unit) => void;
  onDateChange: (date: string) => void;
  onPrevDate: () => void;
  onNextDate: () => void;
  onJumpToday: () => void;
  onViewChange: (view: 'log' | 'foods') => void;
  onFoodFormChange: (field: FoodFormField, value: string) => void;
  onFoodFormSubmit: () => void;
  onEditFood: (foodId: string) => void;
  onSoftDeleteFood: (foodId: string) => void;
  onCancelEdit: () => void;
  onExport: () => void;
  onImport: () => void;
  onImportTextChange: (text: string) => void;
  onFoodsQueryChange: (q: string) => void;
};

export const EMPTY_FOOD_FORM: FoodFormState = {
  mode: 'add', foodId: null,
  name: '', calories: '', protein: '', carbs: '', fat: '',
  servingSize: '100', servingUnit: 'g',
};

const FOOD_FORM_LABEL: Record<keyof NutritionFacts, string> = {
  calories: 'Calories (per serving)',
  protein:  'Protein g (per serving)',
  carbs:    'Carbs g (per serving)',
  fat:      'Fat g (per serving)',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

// Mount references: kept across renders so scrollable containers and live inputs
// don't get torn down on every state change.
type Mount = {
  logSection: HTMLElement;
  foodsSection: HTMLElement;
  // log view
  logToggle: HTMLButtonElement;
  foodsToggle: HTMLButtonElement;
  dateInput: HTMLInputElement;
  dateNav: HTMLElement;
  search: HTMLInputElement;
  picker: HTMLUListElement;
  amountInput: HTMLInputElement;
  unitSelect: HTMLSelectElement;
  logBtn: HTMLButtonElement;
  formSection: HTMLElement;
  entryList: HTMLUListElement;
  totals: HTMLUListElement;
  // foods view
  foodsSearch: HTMLInputElement;
  foodForm: HTMLElement;
  foodFormInputs: Record<FoodFormField, HTMLInputElement | HTMLSelectElement>;
  foodFormHeading: HTMLElement;
  foodFormSubmit: HTMLButtonElement;
  foodFormButtons: HTMLElement;
  foodsList: HTMLUListElement;
  exportTextarea: HTMLTextAreaElement;
  importTextarea: HTMLTextAreaElement;
};

const mounts = new WeakMap<HTMLElement, Mount>();

function mount(container: HTMLElement, handlers: ViewHandlers): Mount {
  const existing = mounts.get(container);
  if (existing) {
    return existing;
  }

  const logToggle = el('button', { 'data-testid': 'view-toggle-log', type: 'button' }, ['Log']);
  logToggle.addEventListener('click', () => handlers.onViewChange('log'));
  const foodsToggle = el('button', { 'data-testid': 'view-toggle-foods', type: 'button' }, ['Foods']);
  foodsToggle.addEventListener('click', () => handlers.onViewChange('foods'));
  const header = el('header', { class: 'app-header' }, [
    el('h1', {}, ['Food Tracker']),
    el('nav', { class: 'view-toggle' }, [logToggle, foodsToggle]),
  ]);

  // Log view
  const prevBtn = el('button', { 'data-testid': 'prev-date', type: 'button', 'aria-label': 'Previous day' }, ['‹']);
  prevBtn.addEventListener('click', handlers.onPrevDate);
  const nextBtn = el('button', { 'data-testid': 'next-date', type: 'button', 'aria-label': 'Next day' }, ['›']);
  nextBtn.addEventListener('click', handlers.onNextDate);
  const dateInput = el('input', { 'data-testid': 'date-input', type: 'date', 'aria-label': 'Selected date' });
  dateInput.addEventListener('change', () => handlers.onDateChange(dateInput.value));
  const dateNav = el('div', { class: 'date-nav' }, [prevBtn, dateInput, nextBtn]);

  const search = el('input', {
    'data-testid': 'search-input', type: 'search',
    placeholder: 'Search foods…', 'aria-label': 'Search foods',
  });
  search.addEventListener('input', () => handlers.onQueryChange(search.value));

  const picker = el('ul', { 'data-testid': 'food-picker', class: 'picker' });

  const amountInput = el('input', {
    'data-testid': 'amount-input', type: 'number',
    inputmode: 'decimal', step: 'any',
    placeholder: 'Amount', 'aria-label': 'Amount',
  });
  amountInput.addEventListener('input', () => handlers.onAmountChange(amountInput.value));
  const amountLabel = el('label', { class: 'log-field' }, [
    el('span', { class: 'log-field-label' }, ['Amount']),
    amountInput,
  ]);

  const unitSelect = el('select', { 'data-testid': 'log-unit-select', 'aria-label': 'Unit' });
  unitSelect.addEventListener('change', () => {
    if (isUnit(unitSelect.value)) {
      handlers.onLogUnitChange(unitSelect.value);
    }
  });
  const unitLabel = el('label', { class: 'log-field' }, [
    el('span', { class: 'log-field-label' }, ['Unit']),
    unitSelect,
  ]);

  const logBtn = el('button', { 'data-testid': 'log-button', type: 'button' }, ['Log it']);

  const formSection = el('section', { class: 'form' }, [
    search,
    picker,
    el('div', { class: 'log-row' }, [amountLabel, unitLabel, logBtn]),
  ]);

  const entryList = el('ul', { 'data-testid': 'entry-list', class: 'entries' });
  const totals = el('ul', { 'data-testid': 'totals-row', class: 'totals' });

  const logSection = el('section', { 'data-view': 'log' }, [dateNav, formSection, entryList, totals]);

  // Foods view
  const foodsSearch = el('input', {
    'data-testid': 'foods-search', type: 'search',
    placeholder: 'Search foods…', 'aria-label': 'Search foods',
  });
  foodsSearch.addEventListener('input', () => handlers.onFoodsQueryChange(foodsSearch.value));

  const foodFormName = makeTextInput('name', 'Name', handlers);
  const foodFormNutrients = NUTRIENT_KEYS.map((k) => makeNumberInput(k, FOOD_FORM_LABEL[k], handlers));
  const foodFormSize = makeNumberInput('servingSize', 'Serving size', handlers);
  const foodFormUnit = makeUnitSelect('food-form-servingUnit', 'Serving unit', UNITS,
    (v) => handlers.onFoodFormChange('servingUnit', v));

  const unitRow = el('div', { class: 'food-form-unit-row' }, [foodFormSize.label, wrapFormField('Serving unit', foodFormUnit)]);

  const foodFormHeading = el('h2', {}, ['Add new food']);
  const foodFormSubmit = el('button', { 'data-testid': 'food-form-submit', type: 'button', class: 'primary' }, ['Add food']);
  foodFormSubmit.addEventListener('click', handlers.onFoodFormSubmit);
  const foodFormButtons = el('div', { class: 'food-form-actions' }, [foodFormSubmit]);

  const foodForm = el('section', { 'data-testid': 'food-form', class: 'food-form' }, [
    foodFormHeading,
    foodFormName.label,
    ...foodFormNutrients.map((n) => n.label),
    unitRow,
    foodFormButtons,
  ]);

  const foodFormInputs: Record<FoodFormField, HTMLInputElement | HTMLSelectElement> = {
    name: foodFormName.input,
    calories: foodFormNutrients[0]!.input,
    protein: foodFormNutrients[1]!.input,
    carbs: foodFormNutrients[2]!.input,
    fat: foodFormNutrients[3]!.input,
    servingSize: foodFormSize.input,
    servingUnit: foodFormUnit,
  };

  const foodsList = el('ul', { 'data-testid': 'foods-list', class: 'foods-list' });

  const exportBtn = el('button', { 'data-testid': 'export-button', type: 'button' }, ['Export JSON']);
  exportBtn.addEventListener('click', handlers.onExport);
  const exportTextarea = el('textarea', {
    'data-testid': 'export-textarea', rows: '4', readonly: '',
    'aria-label': 'Exported JSON', placeholder: 'Click Export JSON to populate.',
  });
  const importTextarea = el('textarea', {
    'data-testid': 'import-textarea', rows: '4',
    placeholder: 'Paste exported JSON here…', 'aria-label': 'Import JSON',
  });
  importTextarea.addEventListener('input', () => handlers.onImportTextChange(importTextarea.value));
  const importBtn = el('button', { 'data-testid': 'import-button', type: 'button' }, ['Import JSON']);
  importBtn.addEventListener('click', handlers.onImport);
  const ioSection = el('section', { class: 'import-export' }, [
    el('h2', {}, ['Backup']),
    exportBtn, exportTextarea, importTextarea, importBtn,
  ]);

  const foodsSection = el('section', { 'data-view': 'foods' }, [foodsSearch, foodForm, foodsList, ioSection]);

  container.replaceChildren(header);

  const m: Mount = {
    logSection, foodsSection,
    logToggle, foodsToggle,
    dateInput, dateNav,
    search, picker, amountInput, unitSelect, logBtn,
    formSection, entryList, totals,
    foodsSearch,
    foodForm, foodFormInputs,
    foodFormHeading, foodFormSubmit, foodFormButtons,
    foodsList, exportTextarea, importTextarea,
  };
  mounts.set(container, m);
  return m;
}

type FoodFormInputRef = { input: HTMLInputElement; label: HTMLElement };

function makeTextInput(field: FoodFormField, label: string, handlers: ViewHandlers): FoodFormInputRef {
  return makeFoodFormInput(field, label, 'text', handlers);
}

function makeNumberInput(field: FoodFormField, label: string, handlers: ViewHandlers): FoodFormInputRef {
  return makeFoodFormInput(field, label, 'number', handlers);
}

function makeUnitSelect(testid: string, ariaLabel: string, units: readonly Unit[], onChange: (v: string) => void): HTMLSelectElement {
  const sel = el('select', { 'data-testid': testid, 'aria-label': ariaLabel });
  for (const u of units) {
    sel.append(el('option', { value: u }, [u]));
  }

  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

function makeFoodFormInput(
  field: FoodFormField, label: string, type: 'text' | 'number', handlers: ViewHandlers,
): FoodFormInputRef {
  const input = el('input', {
    'data-testid': `food-form-${field}`,
    type,
    ...(type === 'number' ? { inputmode: 'decimal', step: 'any', min: '0' } : {}),
    'aria-label': label,
    placeholder: label,
  });
  input.addEventListener('input', () => handlers.onFoodFormChange(field, input.value));
  return { input, label: wrapFormField(label, input) };
}

function wrapFormField(label: string, input: HTMLElement): HTMLElement {
  return el('label', { class: 'food-form-field' }, [
    el('span', { class: 'food-form-field-label' }, [label]),
    input,
  ]);
}

function setActive(btn: HTMLElement, active: boolean): void {
  if (active) {
    btn.setAttribute('data-active', 'true');
  } else {
    btn.removeAttribute('data-active');
  }
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  if (input.value !== value) {
    input.value = value;
  }
}

function renderPicker(picker: HTMLUListElement, vm: ViewModel, handlers: ViewHandlers): void {
  const baseFoods = vm.query.trim() === ''
    ? sortFoodsForLog(vm.state, vm.now)
    : filterFoods(vm.state.foods, vm.query);
  picker.replaceChildren(...baseFoods.map((food) => {
    const opt = el('li', {
      'data-testid': 'food-option',
      'data-food-id': food.id,
      ...(food.id === vm.selectedFoodId ? { 'data-selected': 'true' } : {}),
      role: 'button',
      tabindex: '0',
    }, [food.name]);
    opt.addEventListener('click', () => handlers.onFoodSelect(food.id));
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlers.onFoodSelect(food.id);
      }
    });
    return opt;
  }));
}

function renderUnitSelect(sel: HTMLSelectElement, units: readonly Unit[], current: Unit): void {
  sel.replaceChildren(...units.map((u) => el('option', { value: u }, [u])));
  if (units.includes(current)) {
    sel.value = current;
  }
}

function renderEntries(list: HTMLUListElement, vm: ViewModel, handlers: ViewHandlers): void {
  const foodsById = new Map(vm.state.foods.map((f) => [f.id, f]));
  const visible = vm.state.entries.filter((e) => e.date === vm.selectedDate);
  const rows: HTMLElement[] = [];
  for (const entry of visible) {
    const food = foodsById.get(entry.foodId);
    if (!food) {
      continue;
    }

    const invalid = entryServings(entry, food) === null;
    const calText = invalid ? '— (unit no longer matches food)' : `${Math.round(entryCalories(entry, food))} cal`;
    const del = el('button', {
      'data-testid': 'delete-button',
      'data-entry-id': entry.id,
      type: 'button',
      'aria-label': `Delete ${food.name}`,
    }, ['×']);
    del.addEventListener('click', () => handlers.onDelete(entry.id));
    const attrs: Record<string, string> = { 'data-testid': 'entry-row' };
    if (invalid) {
      attrs['data-invalid'] = 'true';
      attrs['class'] = 'entry-row-invalid';
    }

    rows.push(el('li', attrs, [
      `${food.name}  ${entry.amount} ${entry.unit}  ${calText} `,
      del,
    ]));
  }

  list.replaceChildren(...rows);
}

function renderTotals(totals: HTMLUListElement, state: State, selectedDate: string): void {
  const sums = dailyTotals(state, selectedDate);
  const pcts = macroPctOfCalories(sums);
  const items: HTMLElement[] = [];
  items.push(el('li', { 'data-testid': 'totals-calories' }, [
    `${NUTRIENTS.calories.label}: ${Math.round(sums.calories)} cal`,
  ]));
  for (const key of MACRO_KEYS) {
    const pct = pcts[key];
    const pctText = pct === undefined ? '' : ` (${Math.round(pct)}%)`;
    items.push(el('li', { 'data-testid': `totals-${key}` }, [
      `${NUTRIENTS[key].label}: ${Math.round(sums[key])}g${pctText}`,
    ]));
  }

  const foodsById = new Map(state.foods.map((f) => [f.id, f]));
  const excluded = state.entries.filter((e) => {
    if (e.date !== selectedDate) {
      return false;
    }

    const food = foodsById.get(e.foodId);
    return !!food && entryServings(e, food) === null;
  }).length;
  if (excluded > 0) {
    items.push(el('li', {
      'data-testid': 'totals-excluded',
      class: 'totals-warning',
      role: 'status',
    }, [`${excluded} ${excluded === 1 ? 'entry' : 'entries'} excluded — unit no longer matches food.`]));
  }

  totals.replaceChildren(...items);
}

function renderDateNav(m: Mount, vm: ViewModel, handlers: ViewHandlers): void {
  setInputValue(m.dateInput, vm.selectedDate);
  const existingJump = m.dateNav.querySelector('[data-testid="jump-today"]');
  if (vm.selectedDate !== vm.today && !existingJump) {
    const todayBtn = el('button', { 'data-testid': 'jump-today', type: 'button', class: 'jump-today' }, ['Today']);
    todayBtn.addEventListener('click', handlers.onJumpToday);
    m.dateNav.append(todayBtn);
  } else if (vm.selectedDate === vm.today && existingJump) {
    existingJump.remove();
  }
}

function renderError(parent: HTMLElement, testid: string, message: string | null): void {
  const existing = parent.querySelector(`[data-testid="${testid}"]`);
  if (message === null) {
    if (existing) {
      existing.remove();
    }

    return;
  }

  if (existing) {
    existing.textContent = message;
    return;
  }

  parent.append(el('p', { 'data-testid': testid, class: 'error', role: 'alert' }, [message]));
}

function renderFoodsList(list: HTMLUListElement, vm: ViewModel, handlers: ViewHandlers): void {
  const filtered = filterFoods(vm.state.foods, vm.foodsQuery);
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  list.replaceChildren(...sorted.map((food) => {
    const editBtn = el('button', {
      'data-testid': 'food-edit', 'data-food-id': food.id, type: 'button', 'aria-label': `Edit ${food.name}`,
    }, ['Edit']);
    editBtn.addEventListener('click', () => handlers.onEditFood(food.id));
    const deleteBtn = el('button', {
      'data-testid': 'food-delete', 'data-food-id': food.id, type: 'button', 'aria-label': `Delete ${food.name}`,
    }, ['×']);
    deleteBtn.addEventListener('click', () => handlers.onSoftDeleteFood(food.id));
    return el('li', { 'data-testid': 'food-row' }, [
      el('span', { 'data-testid': 'food-row-name', class: 'food-row-name' }, [food.name]),
      el('span', { class: 'food-row-cal' }, [`${Math.round(food.nutritionFacts.calories)} cal`]),
      el('div', { class: 'food-row-actions' }, [editBtn, deleteBtn]),
    ]);
  }));
}

function renderFoodForm(m: Mount, vm: ViewModel, handlers: ViewHandlers): void {
  for (const field of Object.keys(m.foodFormInputs) as FoodFormField[]) {
    setInputValue(m.foodFormInputs[field], vm.foodForm[field]);
  }

  const editing = vm.foodForm.mode === 'edit';
  m.foodFormHeading.textContent = editing ? 'Edit food' : 'Add new food';
  m.foodFormSubmit.textContent = editing ? 'Save' : 'Add food';

  const hasCancel = m.foodFormButtons.querySelector('[data-testid="food-form-cancel"]');
  if (editing && !hasCancel) {
    const cancel = el('button', { 'data-testid': 'food-form-cancel', type: 'button' }, ['Cancel']);
    cancel.addEventListener('click', handlers.onCancelEdit);
    m.foodFormButtons.append(cancel);
  } else if (!editing && hasCancel) {
    hasCancel.remove();
  }

  renderError(m.foodForm, 'food-form-error', vm.foodFormError);
}

export function render(container: HTMLElement, vm: ViewModel, handlers: ViewHandlers): void {
  const m = mount(container, handlers);

  // Active view
  setActive(m.logToggle, vm.view === 'log');
  setActive(m.foodsToggle, vm.view === 'foods');
  const want = vm.view === 'log' ? m.logSection : m.foodsSection;
  const other = vm.view === 'log' ? m.foodsSection : m.logSection;
  if (other.parentElement) {
    other.remove();
  }

  if (!want.parentElement) {
    container.append(want);
  }

  if (vm.view === 'log') {
    renderDateNav(m, vm, handlers);
    setInputValue(m.search, vm.query);
    renderPicker(m.picker, vm, handlers);
    setInputValue(m.amountInput, vm.amount);

    const selectedFood = vm.state.foods.find((f) => f.id === vm.selectedFoodId);
    const allowedUnits = selectedFood ? compatibleUnits(selectedFood) : UNITS;
    renderUnitSelect(m.unitSelect, allowedUnits, vm.logUnit);

    m.logBtn.onclick = () => handlers.onLog(vm.selectedFoodId ?? '', vm.amount, vm.logUnit);

    renderError(m.formSection, 'error-message', vm.error);
    renderEntries(m.entryList, vm, handlers);
    renderTotals(m.totals, vm.state, vm.selectedDate);
  } else {
    setInputValue(m.foodsSearch, vm.foodsQuery);
    renderFoodForm(m, vm, handlers);
    renderFoodsList(m.foodsList, vm, handlers);
    setInputValue(m.exportTextarea, vm.exportText);
    setInputValue(m.importTextarea, vm.importText);

    const ioSection = m.foodsSection.querySelector('.import-export') as HTMLElement;
    renderError(ioSection, 'import-error', vm.importError);
  }
}
