import { dailyTotals, entryCalories, entryNutrition, indexFoodsById, scaleNutrition, sumNutrition, zeroNutrition } from '../domain/calc.js';
import { isPosFinite } from '../domain/validate.js';
import { MACRO_KEYS, NUTRIENT_KEYS, NUTRIENTS, macroPctOfCalories, macroShares } from '../domain/types.js';
import type { Entry, Food, NutritionFacts, SourcedFood, State, Unit } from '../domain/types.js';
import { UNITS, compatibleUnits, entryServings, isUnit, servingsFor } from '../domain/units.js';
import { mealsForDate } from '../domain/meals.js';
import { CATALOG_TIERS, searchText, sourceBrand, sourceLabel, sourceTier } from '../domain/foodSources.js';
import { searchLiveFoods, type FoodMatch } from './search.js';
import { renderHighlighted } from './highlight.js';
import type { Range } from './ranges.js';
import type { FoodFormFields } from './foodIntents.js';
import { compareForLog } from './recent.js';
import { amountUnitLabel, getChipsForUnit, unitPlural } from './chips.js';
import { DONUT_VIEWBOX, donutSlices } from './donut.js';
import { el, searchInput, setInputValue, withFocusPreserved } from './dom.js';
import { disclosureButton } from './disclosure.js';
import { createSourcePicker, type SourcePicker } from './sourcePicker.js';
import { createToggleGroup, setActive, type ToggleGroup } from './toggleGroup.js';
import { createTrendChart, type TrendChart } from './trendChart.js';
import { svg } from './svg.js';
import { legendRow } from './legend.js';
import { detailRow } from './detailRow.js';
import { formatNutrient, roundedCalories } from './format.js';
import { TREND_METRICS, TREND_METRIC_KEYS, TREND_RANGES, TREND_RANGE_KEYS, trendData } from '../domain/trends.js';
import type { TrendMetricKey, TrendRangeKey } from '../domain/trends.js';

export type FoodFormState = FoodFormFields & {
  mode: 'add' | 'edit';
  foodId: string | null;
};

export type FoodFormField = keyof FoodFormFields;

export type ViewName = 'log' | 'foods' | 'catalog' | 'trends';

export type ExpandedDetail =
  | { kind: 'entry'; id: string }
  | { kind: 'food'; id: string };

export type SourceHydration =
  | { kind: 'fetching'; loaded: number }
  | { kind: 'failed'; cachedVersion: string | null; message: string };

export type HydrationVm = { sources: Record<string, SourceHydration> };

// One source's slice of a catalog result set. `alreadyAdded` counts matches
// hidden because a live user food has the same id or name; they still decide
// the fold and the "already in your foods" hint.
export type CatalogGroup = {
  source: string;
  shown: ReadonlyArray<FoodMatch<SourcedFood>>;
  alreadyAdded: number;
};

// One catalog result set: one group per enabled wired source, in wired
// order, even when a group has no hits. `query` is the search key the rows
// answer — the input may already hold newer text, and two spellings with one
// key share a result set.
export type CatalogHits = {
  query: string;
  groups: CatalogGroup[];
};

// A one-letter query can match most of a non-curated source; rendering
// thousands of rows on expand would stall the page for a list nobody scrolls
// to the end of.
const MORE_ROWS_CAP = 200;

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
  view: ViewName;
  foodForm: FoodFormState;
  foodFormError: string | null;
  importText: string;
  importError: string | null;
  exportText: string;
  foodsQuery: string;
  expandedDetail: ExpandedDetail | null;
  hydration: HydrationVm;
  hasCatalog: boolean;
  // Wired order — registry order filtered to what main.ts actually wired up.
  catalogSources: string[];
  // Wired order, filtered to state.enabledSources — computed once so the
  // picker and the results section never disagree on which sources count.
  enabledSources: string[];
  catalogQuery: string;
  catalogError: string | null;
  // Open/closed per non-curated source with hits in the current result set.
  catalogFolds: Record<string, boolean>;
  sourcesExpanded: boolean;
  sourcesFilter: string;
  // Undefined until the first non-empty catalog query runs.
  catalogHits: CatalogHits | undefined;
  trendMetric: TrendMetricKey;
  trendRange: TrendRangeKey;
  // A bucket start; null means the newest bucket with data.
  trendSelected: string | null;
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
  onViewChange: (view: ViewName) => void;
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
  onNewMeal: (date: string) => void;
  onCatalogQueryChange: (q: string) => void;
  onToggleCatalogFold: (source: string) => void;
  onImportFood: (sourcedId: string) => void;
  onToggleSource: (source: string, enabled: boolean) => void;
  onToggleSourcePicker: () => void;
  onSourcesFilterChange: (q: string) => void;
  onTrendMetricChange: (metric: TrendMetricKey) => void;
  onTrendRangeChange: (range: TrendRangeKey) => void;
  onTrendSelect: (start: string) => void;
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

// Mount references: kept across renders so scrollable containers and live inputs
// don't get torn down on every state change.
type Mount = {
  sections: Record<ViewName, HTMLElement>;
  hydrationSlot: HTMLDivElement;
  // log view
  logToggle: HTMLButtonElement;
  foodsToggle: HTMLButtonElement;
  catalogToggle: HTMLButtonElement;
  trendsToggle: HTMLButtonElement;
  dateInput: HTMLInputElement;
  jumpToday: HTMLButtonElement;
  search: HTMLInputElement;
  picker: HTMLUListElement;
  amountInput: HTMLInputElement;
  unitPicker: ToggleGroup<Unit>;
  logBtn: HTMLButtonElement;
  chipRow: HTMLDivElement;
  chipState: { lastUnit: Unit | null };
  formSection: HTMLElement;
  entryList: HTMLUListElement;
  newMealRow: HTMLLIElement;
  newMealBtn: HTMLButtonElement;
  macroChart: HTMLDivElement;
  macroSvg: SVGSVGElement;
  macroLegend: HTMLUListElement;
  totals: HTMLUListElement;
  // foods view
  foodsSearch: HTMLInputElement;
  foodForm: HTMLElement;
  foodFormInputs: Record<Exclude<FoodFormField, 'servingUnit'>, HTMLInputElement>;
  foodFormUnitPicker: ToggleGroup<Unit>;
  foodFormHeading: HTMLElement;
  foodFormSubmit: HTMLButtonElement;
  foodFormButtons: HTMLElement;
  foodsList: HTMLUListElement;
  exportTextarea: HTMLTextAreaElement;
  importTextarea: HTMLTextAreaElement;
  sourcePicker: SourcePicker;
  catalogSearchInput: HTMLInputElement;
  catalogResultsList: HTMLUListElement;
  catalogRenderedQuery: string;
  // trends view
  trendMetricGroup: ToggleGroup<TrendMetricKey>;
  trendRangeGroup: ToggleGroup<TrendRangeKey>;
  trendChart: TrendChart;
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
  const catalogToggle = el('button', { 'data-testid': 'view-toggle-catalog', type: 'button' }, ['Catalog']);
  catalogToggle.addEventListener('click', () => handlers.onViewChange('catalog'));
  const trendsToggle = el('button', { 'data-testid': 'view-toggle-trends', type: 'button' }, ['Trends']);
  trendsToggle.addEventListener('click', () => handlers.onViewChange('trends'));
  const header = el('header', { class: 'app-header' }, [
    el('h1', {}, ['Food Tracker']),
    el('nav', { class: 'view-toggle' }, [logToggle, foodsToggle, catalogToggle, trendsToggle]),
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

  const search = searchInput('search-input', 'Search your foods', handlers.onQueryChange);

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

  const unitPicker = unitToggleGroup('log-unit-group', 'Unit');
  const unitLabel = el('label', { class: 'log-field' }, [
    el('span', { class: 'log-field-label' }, ['Unit']),
    unitPicker.node,
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
  const newMealBtn = el('button', {
    'data-testid': 'new-meal-button',
    type: 'button', class: 'new-meal',
  }, ['+ New meal']);
  const newMealRow = el('li', {
    'data-testid': 'new-meal-button-row',
    class: 'new-meal-row',
  }, [newMealBtn]);

  const macroSvg = svg('svg', { viewBox: DONUT_VIEWBOX, class: 'macro-svg', role: 'img' });
  const macroLegend = el('ul', { class: 'macro-legend' });
  const macroChart = el('div', { 'data-testid': 'macro-chart', class: 'macro-chart' }, [macroSvg, macroLegend]);

  const totals = el('ul', { 'data-testid': 'totals-row', class: 'totals' });

  const logSection = el('section', { 'data-view': 'log' }, [dateNav, formSection, entryList, macroChart, totals]);

  // Foods view
  const foodsSearch = searchInput('foods-search', 'Search your foods', handlers.onFoodsQueryChange);

  const foodFormName = makeFormInput('name', 'Name', 'text', handlers);
  const foodFormNutrients = NUTRIENT_KEYS.map((k) => makeFormInput(k, FOOD_FORM_LABEL[k], 'number', handlers));
  const foodFormSize = makeFormInput('servingSize', 'Serving size', 'number', handlers);
  const foodFormUnitPicker = unitToggleGroup('food-form-servingUnit', 'Serving unit');

  const unitRow = el('div', { class: 'food-form-unit-row' }, [
    foodFormSize.label,
    wrapFormField('Serving unit', foodFormUnitPicker.node),
  ]);

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

  const foodFormInputs: Record<Exclude<FoodFormField, 'servingUnit'>, HTMLInputElement> = {
    name: foodFormName.input,
    calories: foodFormNutrients[0]!.input,
    protein: foodFormNutrients[1]!.input,
    carbs: foodFormNutrients[2]!.input,
    fat: foodFormNutrients[3]!.input,
    servingSize: foodFormSize.input,
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

  const sourcePicker = createSourcePicker({
    onToggle: handlers.onToggleSourcePicker,
    onFilterChange: handlers.onSourcesFilterChange,
    onSourceChange: handlers.onToggleSource,
  });
  const catalogSearchInput = searchInput('catalog-search-input', 'Search the catalog', handlers.onCatalogQueryChange);
  const catalogResultsList = el('ul', { class: 'scroll-list catalog-results' });
  const catalogSection = el('section', {
    'data-view': 'catalog',
    'data-testid': 'catalog-search',
    class: 'catalog-search',
  }, [
    sourcePicker.node,
    catalogSearchInput,
    catalogResultsList,
  ]);

  const foodsSection = el('section', { 'data-view': 'foods' }, [foodsSearch, foodForm, foodsList, ioSection]);

  // Trends view
  const trendMetricGroup = createToggleGroup<TrendMetricKey>({
    testid: 'trend-metric-group', ariaLabel: 'Metric',
    options: TREND_METRIC_KEYS.map((k) => ({ value: k, label: TREND_METRICS[k].label })),
  });
  const trendRangeGroup = createToggleGroup<TrendRangeKey>({
    testid: 'trend-range-group', ariaLabel: 'Range',
    options: TREND_RANGE_KEYS.map((k) => ({ value: k, label: TREND_RANGES[k].label })),
  });
  const trendChart = createTrendChart();
  const trendsSection = el('section', { 'data-view': 'trends', class: 'trends' }, [
    el('div', { class: 'trend-controls' }, [trendMetricGroup.node, trendRangeGroup.node]),
    trendChart.node,
  ]);

  const hydrationSlot = el('div', { class: 'hydration-slot' });

  container.replaceChildren(header, hydrationSlot);

  const m: Mount = {
    sections: { log: logSection, foods: foodsSection, catalog: catalogSection, trends: trendsSection },
    hydrationSlot,
    logToggle, foodsToggle, catalogToggle, trendsToggle,
    dateInput, jumpToday,
    search, picker, amountInput, unitPicker, logBtn, chipRow,
    chipState: { lastUnit: null },
    formSection, entryList, newMealRow, newMealBtn,
    macroChart, macroSvg, macroLegend, totals,
    foodsSearch,
    foodForm, foodFormInputs, foodFormUnitPicker,
    foodFormHeading, foodFormSubmit, foodFormButtons,
    foodsList, exportTextarea, importTextarea,
    sourcePicker, catalogSearchInput, catalogResultsList,
    catalogRenderedQuery: '',
    trendMetricGroup, trendRangeGroup, trendChart,
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

function unitToggleGroup(testid: string, ariaLabel: string): ToggleGroup<Unit> {
  return createToggleGroup<Unit>({
    testid, ariaLabel,
    options: UNITS.map((u) => ({ value: u, label: u })),
  });
}

function renderHydration(slot: HTMLDivElement, vm: ViewModel): void {
  const children = Object.entries(vm.hydration.sources).map(([source, status]) => {
    const label = sourceLabel(source);

    if (status.kind === 'fetching') {
      // Only bytes received: the response is transport-compressed, so a
      // Content-Length total would be in different units from the body.
      const text = status.loaded > 0
        ? `${label}: downloading… ${Math.round(status.loaded / 1024)} KB`
        : `${label}: downloading…`;
      return el('div', { 'data-testid': 'hydration-banner', 'data-source': source, role: 'status' }, [text]);
    }

    const cached = status.cachedVersion !== null;
    const text = cached
      ? `${label}: couldn't update. Using the cached copy (${status.cachedVersion}).`
      : `${label}: couldn't load. Reload to retry.`;
    return el('div', {
      'data-testid': 'hydration-error',
      'data-source': source,
      'data-state': cached ? 'cached' : 'first-launch',
      role: 'alert',
      title: status.message,
    }, [text]);
  });

  slot.replaceChildren(...children);
}

// The accessible name for a food — the same text foodTitle renders, so two
// same-named packs' Delete/Edit/Add buttons and detail regions still read
// apart from each other and from assistive tech.
function foodLabel(food: { name: string; source?: string }): string {
  return searchText(food.name, food.source);
}

// The one place a food's name is turned into DOM: the highlighted name, plus
// a brand tag (also highlighted) when the food came from a store pack. Used
// everywhere a food name renders from a search match — catalog results, the
// Foods list, and the Log picker — so the three never drift apart.
function foodTitle(
  food: { name: string; source?: string },
  indices: ReadonlyArray<Range>,
  brandIndices: ReadonlyArray<Range>,
): (string | HTMLElement)[] {
  const out = renderHighlighted(food.name, indices);
  const brand = sourceBrand(food.source);

  if (brand !== null) {
    // A plain space text node, not just the tag's own padding, so the row
    // reads as "Almonds Costco" to assistive tech instead of "AlmondsCostco".
    out.push(' ', el('span', { class: 'source-tag', 'data-testid': 'source-tag' }, renderHighlighted(brand, brandIndices)));
  }

  return out;
}

function renderPicker(m: Mount, vm: ViewModel, handlers: ViewHandlers): void {
  const pickerItems = searchLiveFoods(vm.state.foods, vm.query, compareForLog(vm.state, vm.now));

  if (pickerItems.length === 0 && vm.query.trim() === '') {
    const where = vm.hasCatalog ? 'the Catalog tab' : 'the Foods tab';
    m.picker.replaceChildren(
      el('li', { 'data-testid': 'picker-empty', class: 'picker-empty' },
        [`No foods yet. Add some from ${where}.`]),
    );
    return;
  }

  const openFoodId = expandedFoodId(vm.expandedDetail);
  const nodes: HTMLElement[] = [];
  for (const { food, indices, brandIndices } of pickerItems) {
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

    const opt = el('li', attrs, foodTitle(food, indices, brandIndices));
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

    nodes.push(opt);
    if (isOpen) {
      nodes.push(renderFoodDetail(food, detailId, vm.amount, vm.logUnit));
    }
  }

  m.picker.replaceChildren(...nodes);
}

function buildEntryRow(
  entry: Entry, food: Food, openEntryId: string | null, handlers: ViewHandlers,
): HTMLElement[] {
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

  if (expanded) {
    return [row, renderEntryDetail(entry, food, detailId)];
  }

  return [row];
}

function formatMealHeaderTotal(totals: NutritionFacts): string {
  return NUTRIENT_KEYS.map((k) => {
    const meta = NUTRIENTS[k];
    if (meta.unit === 'cal') {
      return `${Math.round(totals[k])} cal`;
    }

    const rounded = Math.round(totals[k] * 10) / 10;
    return `${meta.shortLabel} ${rounded}g`;
  }).join(' · ');
}

function buildMealHeader(label: string, total: NutritionFacts): HTMLElement {
  return el('li', {
    'data-testid': 'meal-header',
    class: 'meal-header',
    role: 'heading',
    'aria-level': '3',
  }, [
    el('span', { 'data-testid': 'meal-header-label', class: 'meal-header-label' }, [label]),
    el('span', { 'data-testid': 'meal-header-total', class: 'meal-header-total' }, [
      formatMealHeaderTotal(total),
    ]),
  ]);
}

function renderEntries(m: Mount, vm: ViewModel, handlers: ViewHandlers): void {
  const list = m.entryList;

  withFocusPreserved(list, 'entry-row', 'data-entry-id', () => {
    const foodsById = indexFoodsById(vm.state);
    const openEntryId = expandedEntryId(vm.expandedDetail);
    const dayMeals = mealsForDate(vm.state, vm.selectedDate);
    const entriesByMeal = new Map<string, Entry[]>();
    for (const e of vm.state.entries) {
      if (e.date !== vm.selectedDate) {
        continue;
      }

      const bucket = entriesByMeal.get(e.mealId) ?? [];
      bucket.push(e);
      entriesByMeal.set(e.mealId, bucket);
    }

    const items: HTMLElement[] = [m.newMealRow];

    if (dayMeals.length === 0) {
      items.push(buildMealHeader('Meal 1', zeroNutrition()));
    } else {
      const latestId = dayMeals.at(-1)!.id;
      for (let i = dayMeals.length - 1; i >= 0; i--) {
        const meal = dayMeals[i]!;
        const mealEntries = entriesByMeal.get(meal.id) ?? [];
        if (mealEntries.length === 0 && meal.id !== latestId) {
          continue;
        }

        items.push(buildMealHeader(`Meal ${i + 1}`, sumNutrition(mealEntries, foodsById)));

        for (const entry of mealEntries) {
          const food = foodsById.get(entry.foodId);
          if (food === undefined) {
            continue;
          }

          items.push(...buildEntryRow(entry, food, openEntryId, handlers));
        }
      }
    }

    list.replaceChildren(...items);
  });
}

function renderDetailRow(testid: string, key: keyof NutritionFacts, value: number, pct: number | undefined): HTMLElement {
  const valueText = pct === undefined
    ? formatNutrient(key, value)
    : `${formatNutrient(key, value)} (${Math.round(pct)}%)`;
  return detailRow(testid, NUTRIENTS[key].label, valueText);
}

function renderDashRow(testid: string, key: keyof NutritionFacts): HTMLElement {
  return detailRow(testid, NUTRIENTS[key].label, '—');
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
    'aria-label': `Nutrition details for ${foodLabel(food)}`,
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

  const servings = servingsFor(n, unit, food);
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
    'aria-label': `Nutrition details for ${foodLabel(food)}`,
  }, cols);
}

function renderMacroChart(m: Mount, state: State, selectedDate: string): void {
  const shares = macroShares(dailyTotals(state, selectedDate));
  const slices = donutSlices(shares);

  if (slices.length === 0) {
    m.macroChart.hidden = true;
    m.macroSvg.replaceChildren();
    m.macroSvg.removeAttribute('aria-label');
    m.macroLegend.replaceChildren();
    return;
  }

  m.macroChart.hidden = false;
  m.macroSvg.replaceChildren(...slices.map(({ key, d }) =>
    svg('path', { 'data-testid': `macro-slice-${key}`, d, fill: NUTRIENTS[key].sliceColor }),
  ));

  const totalShare = shares.reduce((s, x) => s + x.value, 0);

  const legendItems: HTMLElement[] = [];
  const ariaParts: string[] = [];
  for (const { key, value } of shares) {
    const displayPct = Math.round((value / totalShare) * 100);
    ariaParts.push(`${NUTRIENTS[key].label} ${displayPct}%`);
    legendItems.push(legendRow(`macro-legend-${key}`, key, `${displayPct}%`));
  }

  m.macroLegend.replaceChildren(...legendItems);
  m.macroLegend.setAttribute('aria-hidden', 'true');
  m.macroSvg.setAttribute('aria-label', `Macro split: ${ariaParts.join(', ')}`);
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

  const foodsById = indexFoodsById(state);
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
  const matches = searchLiveFoods(vm.state.foods, vm.foodsQuery, (a, b) => a.name.localeCompare(b.name));
  list.replaceChildren(...matches.map(({ food, indices, brandIndices }) => {
    const deleteBtn = el('button', {
      'data-testid': 'food-delete', 'data-food-id': food.id, type: 'button', 'aria-label': `Delete ${foodLabel(food)}`,
    }, ['×']);
    deleteBtn.addEventListener('click', () => handlers.onSoftDeleteFood(food.id));

    // Always painted so every row has the same shape; catalog copies just
    // can't use it. The reason rides in the accessible name because a
    // disabled button can't be focused to reveal a tooltip.
    const sourced = food.source !== undefined;
    const editBtn = el('button', {
      'data-testid': 'food-edit', 'data-food-id': food.id, type: 'button',
      'aria-label': sourced ? `Edit ${foodLabel(food)} — added from the catalog, can't be edited` : `Edit ${foodLabel(food)}`,
    }, ['Edit']);
    editBtn.addEventListener('click', () => handlers.onEditFood(food.id));
    editBtn.disabled = sourced;
    if (sourced) {
      editBtn.title = 'Foods added from the catalog can\'t be edited.';
    }

    return el('li', { 'data-testid': 'food-row' }, [
      el('span', { 'data-testid': 'food-row-name', class: 'food-row-name' }, foodTitle(food, indices, brandIndices)),
      el('span', { class: 'food-row-cal' }, [servingCalLabel(food)]),
      el('div', { class: 'food-row-actions' }, [editBtn, deleteBtn]),
    ]);
  }));
}

function renderFoodForm(m: Mount, vm: ViewModel, handlers: ViewHandlers): void {
  for (const field of Object.keys(m.foodFormInputs) as Array<keyof typeof m.foodFormInputs>) {
    setInputValue(m.foodFormInputs[field], vm.foodForm[field]);
  }

  const formUnit = isUnit(vm.foodForm.servingUnit) ? vm.foodForm.servingUnit : null;
  m.foodFormUnitPicker.render({ selected: formUnit, onPick: (u) => handlers.onFoodFormChange('servingUnit', u) });

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

function servingCalLabel(food: Pick<Food, 'nutritionFacts' | 'servingSize' | 'servingUnit'>): string {
  const cal = roundedCalories(food.nutritionFacts.calories);

  if (food.servingUnit === 'count') {
    return food.servingSize === 1 ? `${cal} each` : `${cal} / ${food.servingSize} count`;
  }

  return `${cal} / ${food.servingSize} ${food.servingUnit}`;
}

function buildCatalogRow(r: FoodMatch<SourcedFood>, handlers: ViewHandlers): HTMLElement {
  const { food, indices, brandIndices } = r;
  const addBtn = el('button', {
    'data-testid': 'catalog-add-button',
    type: 'button',
    class: 'catalog-add',
    'aria-label': `Add ${foodLabel(food)}`,
  }, ['Add']);
  addBtn.addEventListener('click', () => handlers.onImportFood(food.id));

  return el('li', { 'data-testid': 'catalog-result-row', 'data-food-id': food.id, class: 'catalog-result' }, [
    el('span', { class: 'catalog-result-name' }, foodTitle(food, indices, brandIndices)),
    el('span', { class: 'catalog-result-cal' }, [servingCalLabel(food)]),
    addBtn,
  ]);
}

function cappedRows(rows: ReadonlyArray<FoodMatch<SourcedFood>>, handlers: ViewHandlers): HTMLElement[] {
  const out = rows.slice(0, MORE_ROWS_CAP).map((r) => buildCatalogRow(r, handlers));

  if (rows.length > MORE_ROWS_CAP) {
    out.push(catalogHint('catalog-more-cap', `Showing ${MORE_ROWS_CAP} of ${rows.length}. Keep typing to narrow the list.`));
  }

  return out;
}

function catalogHint(testid: string, text: string): HTMLElement {
  return el('li', { 'data-testid': testid, class: 'catalog-hint' }, [text]);
}

// Only called when nothing curated matched. Reads the situation top to
// bottom: folds still open below need no extra line, an everyday-only miss
// names itself, a global miss does too, and a bare "no matches" is last
// resort — never shown under a search error, which already says what happened.
function noCuratedHint(
  shownFolds: CatalogGroup[], curatedAdded: number, totalAdded: number, error: string | null,
): HTMLElement | null {
  if (shownFolds.length > 0 && curatedAdded === 0) {
    return null;
  }

  if (shownFolds.length > 0) {
    return catalogHint('catalog-all-added', 'All everyday matches are already in your foods.');
  }

  if (totalAdded > 0) {
    return catalogHint('catalog-all-added', 'All matches are already in your foods.');
  }

  if (error === null) {
    return catalogHint('catalog-empty', 'No matches for that search.');
  }

  return null;
}

function renderCatalogSection(m: Mount, vm: ViewModel, handlers: ViewHandlers): void {
  const hits = vm.catalogHits;

  // A new result set means a new list; a same-query refresh (an Add,
  // hydration finishing) keeps the user's place.
  const answered = hits?.query ?? '';
  if (m.catalogRenderedQuery !== answered) {
    m.catalogRenderedQuery = answered;
    m.catalogResultsList.scrollTop = 0;
  }

  if (vm.enabledSources.length === 0) {
    m.catalogResultsList.replaceChildren(catalogHint('catalog-no-sources', 'Turn on a source above to search the catalog.'));
    return;
  }

  if (hits === undefined) {
    m.catalogResultsList.replaceChildren(catalogHint('catalog-hint', 'Search the food database to add a food.'));
    return;
  }

  withFocusPreserved(m.catalogResultsList, 'catalog-fold-toggle', 'data-source', () => {
    const curatedGroups = hits.groups.filter((g) => sourceTier(g.source) === CATALOG_TIERS.CURATED);
    const foldedGroups = hits.groups.filter((g) => sourceTier(g.source) !== CATALOG_TIERS.CURATED);
    const shownFolds = foldedGroups.filter((g) => g.shown.length > 0);

    const curatedRows = curatedGroups.flatMap((g) => g.shown);
    const nodes = curatedRows.map((r) => buildCatalogRow(r, handlers));

    if (curatedRows.length === 0) {
      const curatedAdded = curatedGroups.reduce((n, g) => n + g.alreadyAdded, 0);
      const totalAdded = hits.groups.reduce((n, g) => n + g.alreadyAdded, 0);
      const hint = noCuratedHint(shownFolds, curatedAdded, totalAdded, vm.catalogError);
      if (hint) {
        nodes.push(hint);
      }
    }

    for (const group of shownFolds) {
      const expanded = !!vm.catalogFolds[group.source];
      const toggle = disclosureButton({
        testid: 'catalog-fold-toggle',
        label: `${sourceLabel(group.source)} (${group.shown.length})`,
        expanded,
        onToggle: () => handlers.onToggleCatalogFold(group.source),
        attrs: { 'data-source': group.source },
      });
      nodes.push(el('li', { class: 'catalog-fold-row' }, [toggle.node]));

      if (expanded) {
        nodes.push(...cappedRows(group.shown, handlers));
      }
    }

    m.catalogResultsList.replaceChildren(...nodes);
  });
}

function renderTrends(m: Mount, vm: ViewModel, handlers: ViewHandlers): void {
  m.trendMetricGroup.render({ selected: vm.trendMetric, onPick: handlers.onTrendMetricChange });
  m.trendRangeGroup.render({ selected: vm.trendRange, onPick: handlers.onTrendRangeChange });
  m.trendChart.render({
    series: trendData(vm.state, vm.today, vm.trendRange),
    metric: vm.trendMetric,
    selected: vm.trendSelected,
    onSelect: handlers.onTrendSelect,
  });
}

export function render(container: HTMLElement, vm: ViewModel, handlers: ViewHandlers): void {
  const m = mount(container, handlers);

  renderHydration(m.hydrationSlot, vm);

  // Active view
  setActive(m.logToggle, vm.view === 'log');
  setActive(m.foodsToggle, vm.view === 'foods');
  setActive(m.catalogToggle, vm.view === 'catalog');
  setActive(m.trendsToggle, vm.view === 'trends');
  m.catalogToggle.hidden = !vm.hasCatalog;

  for (const [name, section] of Object.entries(m.sections)) {
    if (name !== vm.view && section.parentElement) {
      section.remove();
    }
  }

  const want = m.sections[vm.view];
  if (!want.parentElement) {
    container.append(want);
  }

  if (vm.view === 'log') {
    renderDateNav(m, vm);
    setInputValue(m.search, vm.query);
    renderPicker(m, vm, handlers);
    setInputValue(m.amountInput, vm.amount);

    const selectedFood = vm.state.foods.find((f) => f.id === vm.selectedFoodId && f.deletedAt === null);
    const allowedUnits = selectedFood ? compatibleUnits(selectedFood) : UNITS;
    m.unitPicker.render({ enabled: allowedUnits, selected: vm.logUnit, onPick: handlers.onLogUnitChange });

    m.logBtn.onclick = () => handlers.onLog(vm.selectedFoodId ?? '', vm.amount, vm.logUnit);

    renderChipRow(m, vm, handlers);

    renderError(m.formSection, 'error-message', vm.error, m.chipRow);
    m.newMealBtn.onclick = () => handlers.onNewMeal(vm.selectedDate);
    renderEntries(m, vm, handlers);
    renderMacroChart(m, vm.state, vm.selectedDate);
    renderTotals(m.totals, vm.state, vm.selectedDate);
  } else if (vm.view === 'foods') {
    setInputValue(m.foodsSearch, vm.foodsQuery);
    renderFoodForm(m, vm, handlers);
    renderFoodsList(m.foodsList, vm, handlers);

    setInputValue(m.exportTextarea, vm.exportText);
    setInputValue(m.importTextarea, vm.importText);

    const ioSection = m.sections.foods.querySelector('.import-export') as HTMLElement;
    renderError(ioSection, 'import-error', vm.importError);
  } else if (vm.view === 'trends') {
    renderTrends(m, vm, handlers);
  } else {
    m.sourcePicker.render({
      sources: vm.catalogSources,
      enabled: vm.enabledSources,
      expanded: vm.sourcesExpanded,
      filter: vm.sourcesFilter,
    });
    setInputValue(m.catalogSearchInput, vm.catalogQuery);
    renderCatalogSection(m, vm, handlers);
    renderError(m.sections.catalog, 'catalog-error', vm.catalogError, m.catalogResultsList);
  }
}
