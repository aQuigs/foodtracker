import { dailyTotals, entryCalories } from '../domain/calc.js';
import { MACRO_KEYS, NUTRIENT_KEYS, NUTRIENT_LABEL, macroPctOfCalories } from '../domain/types.js';
import type { NutritionFacts, State, Unit } from '../domain/types.js';
import { UNITS, compatibleUnits, isUnit, needsWeightPerUnit } from '../domain/units.js';
import { filterFoods } from './search.js';
import type { RawFoodForm } from './foodIntents.js';
import { sortFoodsForLog } from './recent.js';

export type FoodFormState = RawFoodForm & {
  mode: 'add' | 'edit';
  foodId: string | null;
};

export type FoodFormField = keyof RawFoodForm;

export type ViewModel = {
  state: State;
  today: string;
  now: Date;
  selectedDate: string;
  query: string;
  selectedFoodId: string | null;
  amountRaw: string;
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
  onLog: (foodId: string, amountRaw: string, unit: Unit) => void;
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
  primaryUnit: 'g', weightPerUnit: '100',
};

const FOOD_FORM_LABEL: Record<keyof NutritionFacts, string> = {
  calories: 'cal / 100g',
  protein:  'Protein g/100g',
  carbs:    'Carbs g/100g',
  fat:      'Fat g/100g',
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

type FocusSnapshot = { testid: string; selectionStart: number | null; selectionEnd: number | null };

const SCROLL_TESTIDS = ['food-picker', 'foods-list'] as const;
type ScrollSnapshot = Record<string, number>;

function captureFocus(container: HTMLElement): FocusSnapshot | null {
  const active = document.activeElement;
  if (!active || !container.contains(active)) {
    return null;
  }

  const testid = active.getAttribute('data-testid');
  if (!testid) {
    return null;
  }

  const snap: FocusSnapshot = { testid, selectionStart: null, selectionEnd: null };
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    try {
      snap.selectionStart = active.selectionStart;
      snap.selectionEnd = active.selectionEnd;
    } catch {
      // Some input types (number, email) throw on selectionStart access in some browsers.
    }
  }
  return snap;
}

function restoreFocus(container: HTMLElement, snap: FocusSnapshot | null): void {
  if (!snap) {
    return;
  }

  const next = container.querySelector(`[data-testid="${snap.testid}"]`) as HTMLElement | null;
  if (!next) {
    return;
  }

  next.focus();
  if ((next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) && snap.selectionStart !== null) {
    try { next.setSelectionRange(snap.selectionStart, snap.selectionEnd ?? snap.selectionStart); } catch { /* see captureFocus */ }
  }
}

function captureScroll(container: HTMLElement): ScrollSnapshot {
  const out: ScrollSnapshot = {};
  for (const testid of SCROLL_TESTIDS) {
    const el = container.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
    if (el) {
      out[testid] = el.scrollTop;
    }
  }
  return out;
}

function restoreScroll(container: HTMLElement, snap: ScrollSnapshot): void {
  for (const [testid, top] of Object.entries(snap)) {
    const el = container.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
    if (el) {
      el.scrollTop = top;
    }
  }
}

function renderHeader(view: 'log' | 'foods', handlers: ViewHandlers): HTMLElement {
  const logBtn = el('button', {
    'data-testid': 'view-toggle-log',
    type: 'button',
    ...(view === 'log' ? { 'data-active': 'true' } : {}),
  }, ['Log']);
  logBtn.addEventListener('click', () => handlers.onViewChange('log'));

  const foodsBtn = el('button', {
    'data-testid': 'view-toggle-foods',
    type: 'button',
    ...(view === 'foods' ? { 'data-active': 'true' } : {}),
  }, ['Foods']);
  foodsBtn.addEventListener('click', () => handlers.onViewChange('foods'));

  return el('header', { class: 'app-header' }, [
    el('h1', {}, ['Food Tracker']),
    el('nav', { class: 'view-toggle' }, [logBtn, foodsBtn]),
  ]);
}

function renderDateNav(vm: ViewModel, handlers: ViewHandlers): HTMLElement {
  const prev = el('button', { 'data-testid': 'prev-date', type: 'button', 'aria-label': 'Previous day' }, ['‹']);
  prev.addEventListener('click', handlers.onPrevDate);

  const next = el('button', { 'data-testid': 'next-date', type: 'button', 'aria-label': 'Next day' }, ['›']);
  next.addEventListener('click', handlers.onNextDate);

  const dateInput = el('input', {
    'data-testid': 'date-input',
    type: 'date',
    'aria-label': 'Selected date',
  });
  dateInput.value = vm.selectedDate;
  dateInput.addEventListener('change', () => handlers.onDateChange(dateInput.value));

  const nav = el('div', { class: 'date-nav' }, [prev, dateInput, next]);
  if (vm.selectedDate !== vm.today) {
    const todayBtn = el('button', { 'data-testid': 'jump-today', type: 'button', class: 'jump-today' }, ['Today']);
    todayBtn.addEventListener('click', handlers.onJumpToday);
    nav.append(todayBtn);
  }

  return nav;
}

function renderTotals(state: State, selectedDate: string): HTMLElement {
  const totals = dailyTotals(state, selectedDate);
  const pcts = macroPctOfCalories(totals);
  const totalsRow = el('ul', { 'data-testid': 'totals-row', class: 'totals' });
  totalsRow.append(el('li', { 'data-testid': 'totals-calories' }, [
    `${NUTRIENT_LABEL.calories}: ${Math.round(totals.calories)} cal`,
  ]));
  for (const key of MACRO_KEYS) {
    const pct = pcts[key];
    const pctText = pct === undefined ? '' : ` (${Math.round(pct)}%)`;
    totalsRow.append(el('li', { 'data-testid': `totals-${key}` }, [
      `${NUTRIENT_LABEL[key]}: ${Math.round(totals[key])}g${pctText}`,
    ]));
  }
  return totalsRow;
}

function renderLogView(vm: ViewModel, handlers: ViewHandlers): HTMLElement[] {
  const foodsById = new Map(vm.state.foods.map((f) => [f.id, f]));
  const baseFoods = vm.query.trim() === ''
    ? sortFoodsForLog(vm.state, vm.now)
    : filterFoods(vm.state.foods, vm.query);
  const visibleEntries = vm.state.entries.filter((e) => e.date === vm.selectedDate);

  const search = el('input', {
    'data-testid': 'search-input',
    type: 'search',
    placeholder: 'Search foods…',
    'aria-label': 'Search foods',
  });
  search.value = vm.query;
  search.addEventListener('input', () => handlers.onQueryChange(search.value));

  const picker = el('ul', { 'data-testid': 'food-picker', class: 'picker' });
  for (const food of baseFoods) {
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
    picker.append(opt);
  }

  const amount = el('input', {
    'data-testid': 'amount-input',
    type: 'number',
    inputmode: 'decimal',
    step: 'any',
    placeholder: 'Amount',
    'aria-label': 'Amount',
  });
  amount.value = vm.amountRaw;
  amount.addEventListener('input', () => handlers.onAmountChange(amount.value));

  const selectedFood = vm.state.foods.find((f) => f.id === vm.selectedFoodId);
  const allowedUnits = selectedFood ? compatibleUnits(selectedFood) : UNITS;
  const unitSelect = el('select', {
    'data-testid': 'log-unit-select',
    'aria-label': 'Unit',
  });
  for (const u of allowedUnits) {
    unitSelect.append(el('option', { value: u }, [u]));
  }
  unitSelect.value = vm.logUnit;
  unitSelect.addEventListener('change', () => {
    if (isUnit(unitSelect.value)) {
      handlers.onLogUnitChange(unitSelect.value);
    }
  });

  const logBtn = el('button', { 'data-testid': 'log-button', type: 'button' }, ['Log it']);
  logBtn.addEventListener('click', () => handlers.onLog(vm.selectedFoodId ?? '', vm.amountRaw, vm.logUnit));

  const form = el('section', { class: 'form' }, [
    search,
    picker,
    el('div', { class: 'log-row' }, [amount, unitSelect, logBtn]),
  ]);

  if (vm.error !== null) {
    form.append(el('p', { 'data-testid': 'error-message', class: 'error', role: 'alert' }, [vm.error]));
  }

  const list = el('ul', { 'data-testid': 'entry-list', class: 'entries' });
  for (const entry of visibleEntries) {
    const food = foodsById.get(entry.foodId);
    if (!food) {
      continue;
    }

    const calories = Math.round(entryCalories(entry, food));
    const del = el('button', {
      'data-testid': 'delete-button',
      'data-entry-id': entry.id,
      type: 'button',
      'aria-label': `Delete ${food.name}`,
    }, ['×']);
    del.addEventListener('click', () => handlers.onDelete(entry.id));
    list.append(el('li', { 'data-testid': 'entry-row' }, [
      `${food.name}  ${entry.amount} ${entry.unit}  ${calories} cal `,
      del,
    ]));
  }

  return [renderDateNav(vm, handlers), form, list, renderTotals(vm.state, vm.selectedDate)];
}

function renderFoodForm(foodForm: FoodFormState, foodFormError: string | null, handlers: ViewHandlers): HTMLElement {
  const fields: Array<[FoodFormField, string]> = [
    ['name', 'Name'],
    ...NUTRIENT_KEYS.map((k) => [k, FOOD_FORM_LABEL[k]] as [FoodFormField, string]),
  ];

  const inputs = fields.map(([field, label]) => {
    const isName = field === 'name';
    const input = el('input', {
      'data-testid': `food-form-${field}`,
      type: isName ? 'text' : 'number',
      ...(isName ? {} : { inputmode: 'decimal', step: 'any', min: '0' }),
      'aria-label': label,
      placeholder: label,
    });
    input.value = foodForm[field];
    input.addEventListener('input', () => handlers.onFoodFormChange(field, input.value));
    return el('label', { class: 'food-form-field' }, [
      el('span', { class: 'food-form-field-label' }, [label]),
      input,
    ]);
  });

  const unitSelect = el('select', { 'data-testid': 'food-form-primaryUnit', 'aria-label': 'Primary unit' });
  for (const u of UNITS) {
    unitSelect.append(el('option', { value: u }, [u]));
  }
  unitSelect.value = foodForm.primaryUnit;
  unitSelect.addEventListener('change', () => handlers.onFoodFormChange('primaryUnit', unitSelect.value));

  const unitRow = el('div', { class: 'food-form-unit-row' }, [
    el('label', {}, ['Primary unit:', unitSelect]),
  ]);

  if (isUnit(foodForm.primaryUnit) && needsWeightPerUnit(foodForm.primaryUnit)) {
    const wInput = el('input', {
      'data-testid': 'food-form-weightPerUnit',
      type: 'number',
      inputmode: 'decimal',
      step: 'any',
      min: '0',
      'aria-label': 'Weight per unit (g)',
      placeholder: 'g per unit',
    });
    wInput.value = foodForm.weightPerUnit;
    wInput.addEventListener('input', () => handlers.onFoodFormChange('weightPerUnit', wInput.value));
    unitRow.append(el('label', {}, ['Weight per unit (g):', wInput]));
  }

  const submit = el('button', { 'data-testid': 'food-form-submit', type: 'button', class: 'primary' }, [
    foodForm.mode === 'edit' ? 'Save' : 'Add food',
  ]);
  submit.addEventListener('click', handlers.onFoodFormSubmit);

  const buttons: HTMLElement[] = [submit];
  if (foodForm.mode === 'edit') {
    const cancel = el('button', { 'data-testid': 'food-form-cancel', type: 'button' }, ['Cancel']);
    cancel.addEventListener('click', handlers.onCancelEdit);
    buttons.push(cancel);
  }

  const form = el('section', { 'data-testid': 'food-form', class: 'food-form' }, [
    el('h2', {}, [foodForm.mode === 'edit' ? 'Edit food' : 'Add new food']),
    ...inputs,
    unitRow,
    el('div', { class: 'food-form-actions' }, buttons),
  ]);

  if (foodFormError !== null) {
    form.append(el('p', { 'data-testid': 'food-form-error', class: 'error', role: 'alert' }, [foodFormError]));
  }

  return form;
}

function renderFoodsView(vm: ViewModel, handlers: ViewHandlers): HTMLElement[] {
  const filtered = filterFoods(vm.state.foods, vm.foodsQuery);
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const foodsSearch = el('input', {
    'data-testid': 'foods-search',
    type: 'search',
    placeholder: 'Search foods…',
    'aria-label': 'Search foods',
  });
  foodsSearch.value = vm.foodsQuery;
  foodsSearch.addEventListener('input', () => handlers.onFoodsQueryChange(foodsSearch.value));

  const list = el('ul', { 'data-testid': 'foods-list', class: 'foods-list' });
  for (const food of sorted) {
    const editBtn = el('button', { 'data-testid': 'food-edit', 'data-food-id': food.id, type: 'button', 'aria-label': `Edit ${food.name}` }, ['Edit']);
    editBtn.addEventListener('click', () => handlers.onEditFood(food.id));
    const deleteBtn = el('button', { 'data-testid': 'food-delete', 'data-food-id': food.id, type: 'button', 'aria-label': `Delete ${food.name}` }, ['×']);
    deleteBtn.addEventListener('click', () => handlers.onSoftDeleteFood(food.id));

    list.append(el('li', { 'data-testid': 'food-row' }, [
      el('span', { 'data-testid': 'food-row-name', class: 'food-row-name' }, [food.name]),
      el('span', { class: 'food-row-cal' }, [`${Math.round(food.nutritionFacts.calories)} cal`]),
      el('div', { class: 'food-row-actions' }, [editBtn, deleteBtn]),
    ]));
  }

  const exportBtn = el('button', { 'data-testid': 'export-button', type: 'button' }, ['Export JSON']);
  exportBtn.addEventListener('click', handlers.onExport);

  const exportTextarea = el('textarea', {
    'data-testid': 'export-textarea',
    rows: '4',
    readonly: '',
    'aria-label': 'Exported JSON',
    placeholder: 'Click Export JSON to populate.',
  });
  exportTextarea.value = vm.exportText;

  const importTextarea = el('textarea', {
    'data-testid': 'import-textarea',
    rows: '4',
    placeholder: 'Paste exported JSON here…',
    'aria-label': 'Import JSON',
  });
  importTextarea.value = vm.importText;
  importTextarea.addEventListener('input', () => handlers.onImportTextChange(importTextarea.value));

  const importBtn = el('button', { 'data-testid': 'import-button', type: 'button' }, ['Import JSON']);
  importBtn.addEventListener('click', handlers.onImport);

  const ioSection = el('section', { class: 'import-export' }, [
    el('h2', {}, ['Backup']),
    exportBtn,
    exportTextarea,
    importTextarea,
    importBtn,
  ]);

  if (vm.importError !== null) {
    ioSection.append(el('p', { 'data-testid': 'import-error', class: 'error', role: 'alert' }, [vm.importError]));
  }

  return [foodsSearch, renderFoodForm(vm.foodForm, vm.foodFormError, handlers), list, ioSection];
}

export function render(container: HTMLElement, vm: ViewModel, handlers: ViewHandlers): void {
  const focused = captureFocus(container);
  const scroll = captureScroll(container);
  const sections = vm.view === 'log' ? renderLogView(vm, handlers) : renderFoodsView(vm, handlers);
  container.replaceChildren(renderHeader(vm.view, handlers), ...sections);
  restoreScroll(container, scroll);
  restoreFocus(container, focused);
}
