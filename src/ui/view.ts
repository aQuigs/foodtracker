import { dailyTotals, entryCalories, entryNutrition, scaleNutrition, zeroNutrition } from '../domain/calc.js';
import { isPosFinite } from '../domain/validate.js';
import { MACRO_KEYS, NUTRIENT_KEYS, NUTRIENTS, macroPctOfCalories } from '../domain/types.js';
import type { Entry, Food, NutritionFacts, State, Unit } from '../domain/types.js';
import { UNITS, compatibleUnits, entryServings, isUnit } from '../domain/units.js';
import { filterFoods } from './search.js';
import type { FoodFormFields } from './foodIntents.js';
import { sortFoodsForLog } from './recent.js';
import { amountUnitLabel, getChipsForUnit, unitPlural } from './chips.js';

export type FoodFormState = FoodFormFields & {
  mode: 'add' | 'edit';
  foodId: string | null;
};

export type FoodFormField = keyof FoodFormFields;

export type ExpandedDetail =
  | { kind: 'entry'; id: string }
  | { kind: 'food'; id: string };

function expandedEntryId(d: ExpandedDetail | null): string | null {
  return d?.kind === 'entry' ? d.id : null;
}

function expandedFoodId(d: ExpandedDetail | null): string | null {
  return d?.kind === 'food' ? d.id : null;
}

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
  expandedDetail: ExpandedDetail | null;
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
  onToggleEntry: (entryId: string) => void;
  onToggleFood: (foodId: string) => void;
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
  jumpToday: HTMLButtonElement;
  search: HTMLInputElement;
  picker: HTMLUListElement;
  amountInput: HTMLInputElement;
  unitSelect: HTMLSelectElement;
  logBtn: HTMLButtonElement;
  chipRow: HTMLDivElement;
  chipState: { lastUnit: Unit | null };
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
  const jumpToday = el('button', { 'data-testid': 'jump-today', type: 'button', class: 'jump-today' }, ['Today']);
  jumpToday.addEventListener('click', handlers.onJumpToday);
  const dateNav = el('div', { class: 'date-nav' }, [prevBtn, dateInput, nextBtn, jumpToday]);

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

  const chipRow = el('div', {
    'data-testid': 'chip-row',
    class: 'chip-row',
    role: 'group',
  });

  const formSection = el('section', { class: 'form' }, [
    search,
    picker,
    el('div', { class: 'log-row' }, [amountLabel, unitLabel, logBtn]),
    chipRow,
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

  const foodFormName = makeFormInput('name', 'Name', 'text', handlers);
  const foodFormNutrients = NUTRIENT_KEYS.map((k) => makeFormInput(k, FOOD_FORM_LABEL[k], 'number', handlers));
  const foodFormSize = makeFormInput('servingSize', 'Serving size', 'number', handlers);
  const foodFormUnit = el('select', { 'data-testid': 'food-form-servingUnit', 'aria-label': 'Serving unit' });
  for (const u of UNITS) {
    foodFormUnit.append(el('option', { value: u }, [u]));
  }
  foodFormUnit.addEventListener('change', () => handlers.onFoodFormChange('servingUnit', foodFormUnit.value));

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
    dateInput, jumpToday,
    search, picker, amountInput, unitSelect, logBtn, chipRow,
    chipState: { lastUnit: null },
    formSection, entryList, totals,
    foodsSearch,
    foodForm, foodFormInputs,
    foodFormHeading, foodFormSubmit, foodFormButtons,
    foodsList, exportTextarea, importTextarea,
  };
  mounts.set(container, m);
  return m;
}

function makeFormInput(
  field: FoodFormField, label: string, type: 'text' | 'number', handlers: ViewHandlers,
): { input: HTMLInputElement; label: HTMLElement } {
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

function renderPicker(m: Mount, vm: ViewModel, handlers: ViewHandlers): void {
  const baseFoods = vm.query.trim() === ''
    ? sortFoodsForLog(vm.state, vm.now)
    : filterFoods(vm.state.foods, vm.query);
  const openFoodId = expandedFoodId(vm.expandedDetail);
  const items: HTMLElement[] = [];
  for (const food of baseFoods) {
    const isSelected = food.id === vm.selectedFoodId;
    const isOpen = isSelected && openFoodId === food.id;
    const detailId = `food-detail-${food.id}`;
    const attrs: Record<string, string> = {
      'data-testid': 'food-option',
      'data-food-id': food.id,
      role: 'button',
      tabindex: '0',
    };
    if (isSelected) {
      attrs['data-selected'] = 'true';
      attrs['aria-expanded'] = isOpen ? 'true' : 'false';
      if (isOpen) {
        attrs['aria-controls'] = detailId;
      }
    }
    const opt = el('li', attrs, [food.name]);
    const activate = (): void => {
      if (isSelected) {
        handlers.onToggleFood(food.id);
      } else {
        handlers.onFoodSelect(food.id);
      }
    };
    opt.addEventListener('click', activate);
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
    items.push(opt);
    if (isOpen) {
      items.push(renderFoodDetail(food, detailId, vm.amount, vm.logUnit));
    }
  }
  m.picker.replaceChildren(...items);
}

function renderEntries(list: HTMLUListElement, vm: ViewModel, handlers: ViewHandlers): void {
  const active = document.activeElement;
  const focusedEntryId = active instanceof HTMLElement
    && active.getAttribute('data-testid') === 'entry-row'
    ? active.getAttribute('data-entry-id')
    : null;

  const foodsById = new Map(vm.state.foods.map((f) => [f.id, f]));
  const visible = vm.state.entries.filter((e) => e.date === vm.selectedDate);
  const openEntryId = expandedEntryId(vm.expandedDetail);
  const items: HTMLElement[] = [];
  for (const entry of visible) {
    const food = foodsById.get(entry.foodId);
    if (!food) {
      continue;
    }

    const invalid = entryServings(entry, food) === null;
    const calText = invalid ? '— (unit no longer matches food)' : `${Math.round(entryCalories(entry, food))} cal`;
    const expanded = !invalid && openEntryId === entry.id;
    const detailId = `entry-detail-${entry.id}`;

    const del = el('button', {
      'data-testid': 'delete-button',
      'data-entry-id': entry.id,
      type: 'button',
      'aria-label': `Delete ${food.name}`,
    }, ['×']);
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onDelete(entry.id);
    });
    del.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation();
      }
    });

    const attrs: Record<string, string> = {
      'data-testid': 'entry-row',
      'data-entry-id': entry.id,
    };
    if (invalid) {
      attrs['data-invalid'] = 'true';
      attrs['class'] = 'entry-row-invalid';
    } else {
      attrs['role'] = 'button';
      attrs['tabindex'] = '0';
      attrs['aria-expanded'] = expanded ? 'true' : 'false';
      if (expanded) {
        attrs['aria-controls'] = detailId;
      }
    }

    const row = el('li', attrs, [
      `${food.name}  ${entry.amount} ${entry.unit}  ${calText} `,
      del,
    ]);
    if (!invalid) {
      row.addEventListener('click', () => handlers.onToggleEntry(entry.id));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handlers.onToggleEntry(entry.id);
        }
      });
    }

    items.push(row);

    if (expanded) {
      items.push(renderEntryDetail(entry, food, detailId));
    }
  }

  list.replaceChildren(...items);

  if (focusedEntryId !== null) {
    const restored = list.querySelector(
      `[data-testid="entry-row"][data-entry-id="${CSS.escape(focusedEntryId)}"]`,
    );
    if (restored instanceof HTMLElement) {
      restored.focus();
    }
  }
}

function formatNutrient(key: keyof NutritionFacts, value: number): string {
  const meta = NUTRIENTS[key];
  const factor = 10 ** meta.decimals;
  const rounded = Math.round(value * factor) / factor;
  return `${rounded} ${meta.unit}`;
}

function renderDetailRow(testid: string, key: keyof NutritionFacts, value: number, pct: number | undefined): HTMLElement {
  const valueText = pct === undefined
    ? formatNutrient(key, value)
    : `${formatNutrient(key, value)} (${Math.round(pct)}%)`;
  return el('div', { 'data-testid': testid, class: 'entry-detail-row' }, [
    el('span', { class: 'entry-detail-label' }, [NUTRIENTS[key].label]),
    el('span', { class: 'entry-detail-value' }, [valueText]),
  ]);
}

function renderDashRow(testid: string, key: keyof NutritionFacts): HTMLElement {
  return el('div', { 'data-testid': testid, class: 'entry-detail-row' }, [
    el('span', { class: 'entry-detail-label' }, [NUTRIENTS[key].label]),
    el('span', { class: 'entry-detail-value' }, ['—']),
  ]);
}

function renderEntryDetail(entry: Entry, food: Food, detailId: string): HTMLElement {
  const n = entryNutrition(entry, food);
  const pcts = macroPctOfCalories(n);
  const lines = NUTRIENT_KEYS.map((key) =>
    renderDetailRow(`entry-detail-${key}`, key, n[key], pcts[key]));

  return el('li', {
    id: detailId,
    'data-testid': 'entry-detail',
    'data-entry-id': entry.id,
    class: 'entry-detail',
    role: 'region',
    'aria-label': `Nutrition details for ${food.name}`,
  }, lines);
}

function parseLiveAmount(amount: string, unit: Unit, food: Food): NutritionFacts | null {
  if (amount.trim() === '0') {
    return zeroNutrition();
  }

  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }

  const servings = entryServings({ id: '', date: '', foodId: food.id, amount: n, unit, loggedAt: '' }, food);
  return servings === null ? null : scaleNutrition(food.nutritionFacts, servings);
}

function renderFoodDetail(food: Food, detailId: string, amount: string, logUnit: Unit): HTMLElement {
  const perServing = food.nutritionFacts;
  const perServingPcts = macroPctOfCalories(perServing);
  const perServingLines = NUTRIENT_KEYS.map((key) =>
    renderDetailRow(`food-detail-per-serving-${key}`, key, perServing[key], perServingPcts[key]));

  const perServingCol = el('div', { class: 'food-detail-col' }, [
    el('div', { class: 'food-detail-col-header' }, [`Per serving (${food.servingSize} ${food.servingUnit})`]),
    ...perServingLines,
  ]);

  const cols: HTMLElement[] = [perServingCol];
  const servingValid = isPosFinite(food.servingSize);

  if (servingValid) {
    const live = parseLiveAmount(amount, logUnit, food);
    const livePcts = live === null ? {} : macroPctOfCalories(live);
    const headerAmount = live === null ? '—' : amount.trim();
    const thisEntryLines = NUTRIENT_KEYS.map((key) => {
      const testid = `food-detail-this-entry-${key}`;
      return live === null
        ? renderDashRow(testid, key)
        : renderDetailRow(testid, key, live[key], livePcts[key]);
    });
    cols.push(el('div', { class: 'food-detail-col' }, [
      el('div', { class: 'food-detail-col-header' }, [`This entry (${headerAmount} ${logUnit})`]),
      ...thisEntryLines,
    ]));
  }

  return el('li', {
    id: detailId,
    'data-testid': 'food-detail',
    'data-food-id': food.id,
    class: servingValid ? 'food-detail' : 'food-detail food-detail-single',
    role: 'region',
    'aria-label': `Nutrition details for ${food.name}`,
  }, cols);
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

function renderDateNav(m: Mount, vm: ViewModel): void {
  setInputValue(m.dateInput, vm.selectedDate);
  m.jumpToday.hidden = vm.selectedDate === vm.today;
}

function renderChipRow(m: Mount, vm: ViewModel, handlers: ViewHandlers): void {
  m.chipRow.hidden = vm.selectedFoodId === null;
  if (m.chipRow.hidden) {
    return;
  }

  m.chipRow.setAttribute('aria-label', `Quick amounts in ${unitPlural(vm.logUnit)}`);
  if (m.chipState.lastUnit === vm.logUnit) {
    return;
  }

  m.chipState.lastUnit = vm.logUnit;
  const buttons = getChipsForUnit(vm.logUnit).map((value) => {
    const label = String(value);
    const btn = el('button', {
      'data-testid': `chip-button-${label}`,
      type: 'button',
      class: 'chip',
      'aria-label': amountUnitLabel(value, vm.logUnit),
    }, [label]);
    btn.addEventListener('click', () => {
      handlers.onAmountChange(label);
      m.logBtn.focus();
    });
    return btn;
  });
  m.chipRow.replaceChildren(...buttons);
}

function renderError(parent: HTMLElement, testid: string, message: string | null, before: HTMLElement | null = null): void {
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

  const errorEl = el('p', { 'data-testid': testid, class: 'error', role: 'alert' }, [message]);
  if (before !== null && before.parentNode === parent) {
    parent.insertBefore(errorEl, before);
  } else {
    parent.append(errorEl);
  }
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
    renderDateNav(m, vm);
    setInputValue(m.search, vm.query);
    renderPicker(m, vm, handlers);
    setInputValue(m.amountInput, vm.amount);

    const selectedFood = vm.state.foods.find((f) => f.id === vm.selectedFoodId);
    const allowedUnits = selectedFood ? compatibleUnits(selectedFood) : UNITS;
    m.unitSelect.replaceChildren(...allowedUnits.map((u) => el('option', { value: u }, [u])));
    if (allowedUnits.includes(vm.logUnit)) {
      m.unitSelect.value = vm.logUnit;
    }

    m.logBtn.onclick = () => handlers.onLog(vm.selectedFoodId ?? '', vm.amount, vm.logUnit);

    renderChipRow(m, vm, handlers);

    renderError(m.formSection, 'error-message', vm.error, m.chipRow);
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
