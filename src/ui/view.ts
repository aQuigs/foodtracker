import { dailyTotals, entryKcal } from '../domain/calc.js';
import type { State, Unit } from '../domain/types.js';
import { filterFoods } from './search.js';
import { sortFoodsForLog } from './recent.js';

export const UNIT_OPTIONS: Unit[] = ['g', 'oz', 'lb', 'count'];

export type FoodFormState = {
  mode: 'add' | 'edit';
  foodId: string | null;
  name: string;
  kcalRaw: string;
  proteinRaw: string;
  carbsRaw: string;
  fatRaw: string;
  primaryUnit: Unit;
  weightPerUnitRaw: string;
};

export type FoodFormField = 'name' | 'kcalRaw' | 'proteinRaw' | 'carbsRaw' | 'fatRaw' | 'weightPerUnitRaw' | 'primaryUnit';

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

function formatAmount(amount: number, unit: Unit): string {
  const n = Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(3)));
  return unit === 'count' ? `${n} count` : `${n}${unit}`;
}

type FocusSnapshot = { testid: string; selectionStart: number | null; selectionEnd: number | null };

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
    try {
      next.setSelectionRange(snap.selectionStart, snap.selectionEnd ?? snap.selectionStart);
    } catch {
      // see captureFocus
    }
  }
}

function renderHeader(vm: ViewModel, handlers: ViewHandlers): HTMLElement {
  const logBtn = el('button', {
    'data-testid': 'view-toggle-log',
    type: 'button',
    ...(vm.view === 'log' ? { 'data-active': 'true' } : {}),
  }, ['Log']);
  logBtn.addEventListener('click', () => handlers.onViewChange('log'));

  const foodsBtn = el('button', {
    'data-testid': 'view-toggle-foods',
    type: 'button',
    ...(vm.view === 'foods' ? { 'data-active': 'true' } : {}),
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

function renderLogView(vm: ViewModel, handlers: ViewHandlers): HTMLElement[] {
  const foodsById = new Map(vm.state.foods.map((f) => [f.id, f]));
  const baseFoods = vm.query.trim() === ''
    ? sortFoodsForLog(vm.state, vm.now)
    : filterFoods(vm.state.foods, vm.query);
  const totals = dailyTotals(vm.state, vm.selectedDate);
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

  const unitSelect = el('select', {
    'data-testid': 'log-unit',
    'aria-label': 'Unit',
  });
  for (const u of UNIT_OPTIONS) {
    const option = el('option', { value: u, ...(u === vm.logUnit ? { selected: 'true' } : {}) }, [u]);
    unitSelect.append(option);
  }
  unitSelect.value = vm.logUnit;
  unitSelect.addEventListener('change', () => handlers.onLogUnitChange(unitSelect.value as Unit));

  const logBtn = el('button', {
    'data-testid': 'log-button',
    type: 'button',
  }, ['Log it']);
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

    const kcal = Math.round(entryKcal(entry, food));
    const del = el('button', {
      'data-testid': 'delete-button',
      'data-entry-id': entry.id,
      type: 'button',
      'aria-label': `Delete ${food.name}`,
    }, ['×']);
    del.addEventListener('click', () => handlers.onDelete(entry.id));

    list.append(el('li', { 'data-testid': 'entry-row' }, [
      `${food.name}  ${formatAmount(entry.amount, entry.unit)}  ${kcal} cal `,
      del,
    ]));
  }

  const totalsRow = el('div', { 'data-testid': 'totals-row', class: 'totals' }, [
    `Total: ${Math.round(totals.kcal)} cal   ` +
    `Protein ${Math.round(totals.protein)}g   ` +
    `Carbs ${Math.round(totals.carbs)}g   ` +
    `Fat ${Math.round(totals.fat)}g`,
  ]);

  return [renderDateNav(vm, handlers), form, list, totalsRow];
}

function renderFoodForm(vm: ViewModel, handlers: ViewHandlers): HTMLElement {
  const fields: Array<[FoodFormField, string, string]> = [
    ['name',       'Name',           vm.foodForm.name],
    ['kcalRaw',    'kcal / 100g',    vm.foodForm.kcalRaw],
    ['proteinRaw', 'Protein g/100g', vm.foodForm.proteinRaw],
    ['carbsRaw',   'Carbs g/100g',   vm.foodForm.carbsRaw],
    ['fatRaw',     'Fat g/100g',     vm.foodForm.fatRaw],
  ];

  const inputs = fields.map(([field, label, value]) => {
    const input = el('input', {
      'data-testid': `food-form-${field === 'name' ? 'name' : field.replace('Raw', '')}`,
      type: field === 'name' ? 'text' : 'number',
      ...(field !== 'name' ? { inputmode: 'decimal', step: 'any', min: '0' } : {}),
      'aria-label': label,
      placeholder: label,
    });
    input.value = value;
    input.addEventListener('input', () => handlers.onFoodFormChange(field, input.value));
    return input;
  });

  const unitSelect = el('select', {
    'data-testid': 'food-form-primary-unit',
    'aria-label': 'Primary unit',
  });
  for (const u of UNIT_OPTIONS) {
    const option = el('option', { value: u, ...(u === vm.foodForm.primaryUnit ? { selected: 'true' } : {}) }, [u]);
    unitSelect.append(option);
  }
  unitSelect.value = vm.foodForm.primaryUnit;
  unitSelect.addEventListener('change', () => handlers.onFoodFormChange('primaryUnit', unitSelect.value));

  const unitRow: HTMLElement[] = [unitSelect];
  if (vm.foodForm.primaryUnit === 'count') {
    const wpu = el('input', {
      'data-testid': 'food-form-weight-per-unit',
      type: 'number',
      inputmode: 'decimal',
      step: 'any',
      min: '0',
      placeholder: 'Weight per unit (g)',
      'aria-label': 'Weight per unit in grams',
    });
    wpu.value = vm.foodForm.weightPerUnitRaw;
    wpu.addEventListener('input', () => handlers.onFoodFormChange('weightPerUnitRaw', wpu.value));
    unitRow.push(wpu);
  }

  const submit = el('button', { 'data-testid': 'food-form-submit', type: 'button', class: 'primary' }, [
    vm.foodForm.mode === 'edit' ? 'Save' : 'Add food',
  ]);
  submit.addEventListener('click', handlers.onFoodFormSubmit);

  const buttons: HTMLElement[] = [submit];
  if (vm.foodForm.mode === 'edit') {
    const cancel = el('button', { 'data-testid': 'food-form-cancel', type: 'button' }, ['Cancel']);
    cancel.addEventListener('click', handlers.onCancelEdit);
    buttons.push(cancel);
  }

  const form = el('section', { 'data-testid': 'food-form', class: 'food-form' }, [
    el('h2', {}, [vm.foodForm.mode === 'edit' ? 'Edit food' : 'Add new food']),
    ...inputs,
    el('div', { class: 'food-form-unit-row' }, unitRow),
    el('div', { class: 'food-form-actions' }, buttons),
  ]);

  if (vm.foodFormError !== null) {
    form.append(el('p', { 'data-testid': 'food-form-error', class: 'error', role: 'alert' }, [vm.foodFormError]));
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
      el('span', { class: 'food-row-kcal' }, [`${Math.round(food.kcalPer100g)} kcal`]),
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

  return [foodsSearch, renderFoodForm(vm, handlers), list, ioSection];
}

export function render(container: HTMLElement, vm: ViewModel, handlers: ViewHandlers): void {
  const focused = captureFocus(container);
  const sections = vm.view === 'log'
    ? renderLogView(vm, handlers)
    : renderFoodsView(vm, handlers);
  container.replaceChildren(renderHeader(vm, handlers), ...sections);
  restoreFocus(container, focused);
}

