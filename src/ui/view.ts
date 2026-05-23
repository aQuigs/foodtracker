import { dailyTotals, entryKcal, mealTotals, scaledNutrition } from '../domain/calc.js';
import type { Meal, State, Unit } from '../domain/types.js';
import { filterFoods } from './search.js';
import { sortFoodsForLog } from './recent.js';
import { getChipsForUnit, getChipsForLog } from './chips.js';

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
  chipsRaw: [string, string, string, string];
};

export type FoodFormField = 'name' | 'kcalRaw' | 'proteinRaw' | 'carbsRaw' | 'fatRaw' | 'weightPerUnitRaw' | 'primaryUnit';
export type ChipIndex = 0 | 1 | 2 | 3;

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
  expandedEntryId: string | null;
  currentMealId: string | null;
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
  onFoodFormChipChange: (index: ChipIndex, value: string) => void;
  onFoodFormChipsReset: () => void;
  onToggleEntry: (entryId: string) => void;
  onEditEntry: (entryId: string) => void;
  onStartNextMeal: () => void;
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

function renderMealSection(
  vm: ViewModel,
  handlers: ViewHandlers,
  meal: Meal,
  mealIndex: number,
): HTMLElement {
  const mealEntries = vm.state.entries.filter((e) => e.mealId === meal.id);
  const subtotals = mealTotals(vm.state, meal.id);
  const mealName = `Meal ${mealIndex + 1}`;
  const isCurrentMeal = meal.id === vm.currentMealId;

  const section = el('section', { class: 'meal-section', 'data-meal-id': meal.id });
  section.append(el('h3', { class: 'meal-heading' }, [mealName]));

  for (const entry of mealEntries) {
    const food = vm.state.foods.find((f) => f.id === entry.foodId);
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
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      handlers.onDelete(entry.id);
    });

    const row = el('li', {
      'data-testid': 'entry-row',
      style: 'cursor:pointer',
    }, [
      `${food.name}  ${formatAmount(entry.amount, entry.unit)}  ${kcal} cal `,
      del,
    ]);
    row.addEventListener('click', () => handlers.onToggleEntry(entry.id));
    section.append(row);

    if (vm.expandedEntryId === entry.id) {
      const scaled = scaledNutrition(entry, food);
      const per100g = el('div', { 'data-testid': 'entry-detail-per-100g' }, [
        `${Math.round(food.kcalPer100g)} kcal · ` +
        `${food.proteinPer100g}g protein · ` +
        `${food.carbsPer100g}g carbs · ` +
        `${food.fatPer100g}g fat`,
      ]);
      const scaledEl = el('div', { 'data-testid': 'entry-detail-scaled' }, [
        `${Math.round(scaled.kcal)} kcal · ` +
        `${scaled.protein.toFixed(1)}g protein · ` +
        `${scaled.carbs.toFixed(1)}g carbs · ` +
        `${scaled.fat.toFixed(1)}g fat`,
      ]);

      const editBtn = el('button', {
        'data-testid': 'entry-detail-edit',
        type: 'button',
        'aria-label': `Edit ${food.name} entry`,
      }, ['Edit']);
      editBtn.addEventListener('click', () => handlers.onEditEntry(entry.id));

      const delBtn = el('button', {
        'data-testid': 'entry-detail-delete',
        type: 'button',
        'aria-label': `Delete ${food.name} entry`,
      }, ['Delete']);
      delBtn.addEventListener('click', () => handlers.onDelete(entry.id));

      section.append(el('li', { 'data-testid': 'entry-detail' }, [per100g, scaledEl, editBtn, delBtn]));
    }
  }

  const subtotalRow = el('div', {
    'data-testid': `meal-subtotal-${meal.id}`,
    class: 'meal-subtotal',
  }, [
    `${mealName}: ${Math.round(subtotals.kcal)} cal   ` +
    `Protein ${Math.round(subtotals.protein)}g   ` +
    `Carbs ${Math.round(subtotals.carbs)}g   ` +
    `Fat ${Math.round(subtotals.fat)}g`,
  ]);
  section.append(subtotalRow);

  if (isCurrentMeal) {
    const currentMealEntryCount = mealEntries.length;
    const nextMealBtn = el('button', {
      'data-testid': 'start-next-meal',
      type: 'button',
      ...(currentMealEntryCount === 0 ? { disabled: 'true' } : {}),
    }, ['End meal & start next meal']);
    nextMealBtn.addEventListener('click', () => handlers.onStartNextMeal());
    section.append(nextMealBtn);
  }

  return section;
}

function renderLogView(vm: ViewModel, handlers: ViewHandlers): HTMLElement[] {
  const baseFoods = vm.query.trim() === ''
    ? sortFoodsForLog(vm.state, vm.now)
    : filterFoods(vm.state.foods, vm.query);
  const totals = dailyTotals(vm.state, vm.selectedDate);

  const mealsForDay = vm.state.meals
    .filter((m) => m.date === vm.selectedDate)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

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

  const formChildren: (Node | string)[] = [
    search,
    picker,
    el('div', { class: 'log-row' }, [amount, unitSelect, logBtn]),
  ];

  if (vm.selectedFoodId !== null) {
    const selectedFood = vm.state.foods.find((f) => f.id === vm.selectedFoodId) ?? null;
    const chipValues = selectedFood !== null
      ? getChipsForLog(selectedFood, vm.logUnit)
      : getChipsForUnit(vm.logUnit);

    const chipRow = el('div', { 'data-testid': 'chip-row', class: 'chip-row' });

    for (const value of chipValues) {
      const chip = el('button', {
        'data-testid': `chip-${value}`,
        type: 'button',
        class: 'chip',
      }, [String(value)]);

      chip.addEventListener('click', () => handlers.onAmountChange(String(value)));
      chipRow.append(chip);
    }

    formChildren.push(chipRow);
  }

  const form = el('section', { class: 'form' }, formChildren);

  if (vm.error !== null) {
    form.append(el('p', { 'data-testid': 'error-message', class: 'error', role: 'alert' }, [vm.error]));
  }

  const list = el('ul', { 'data-testid': 'entry-list', class: 'entries' });
  for (const [i, meal] of mealsForDay.entries()) {
    list.append(renderMealSection(vm, handlers, meal, i));
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

  const chipInputs = ([0, 1, 2, 3] as ChipIndex[]).map((i) => {
    const chipInput = el('input', {
      'data-testid': `food-form-chip-${i}`,
      type: 'number',
      inputmode: 'decimal',
      step: 'any',
      min: '0',
      placeholder: `Chip ${i + 1}`,
      'aria-label': `Chip value ${i + 1}`,
    });
    chipInput.value = vm.foodForm.chipsRaw[i];
    chipInput.addEventListener('input', () => handlers.onFoodFormChipChange(i, chipInput.value));
    return chipInput;
  });

  const resetBtn = el('button', { 'data-testid': 'food-form-chips-reset', type: 'button' }, ['Reset to defaults']);
  resetBtn.addEventListener('click', handlers.onFoodFormChipsReset);

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
    el('div', { class: 'food-form-chips-row' }, [...chipInputs, resetBtn]),
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

