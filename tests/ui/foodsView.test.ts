import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { ViewModel, ViewHandlers, FoodFormState } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { Entry, State, Unit } from '../../src/domain/types.js';

const today = '2026-05-23';

const noopHandlers: ViewHandlers = {
  onLog: () => {},
  onDelete: () => {},
  onQueryChange: () => {},
  onFoodSelect: () => {},
  onAmountChange: () => {},
  onLogUnitChange: () => {},
  onDateChange: () => {},
  onPrevDate: () => {},
  onNextDate: () => {},
  onJumpToday: () => {},
  onViewChange: () => {},
  onFoodFormChange: () => {},
  onFoodFormUnitChange: () => {},
  onFoodFormSubmit: () => {},
  onEditFood: () => {},
  onSoftDeleteFood: () => {},
  onCancelEdit: () => {},
  onExport: () => {},
  onImport: () => {},
  onImportTextChange: () => {},
  onFoodsQueryChange: () => {},
};

const emptyFoodForm: FoodFormState = {
  mode: 'add', foodId: null,
  name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '',
  primaryUnit: 'g', weightPerUnitRaw: '',
};

const editFoodForm: FoodFormState = {
  mode: 'edit', foodId: 'seed-banana',
  name: 'Banana', kcalRaw: '89', proteinRaw: '1.1', carbsRaw: '22.8', fatRaw: '0.3',
  primaryUnit: 'g', weightPerUnitRaw: '',
};

function vm(overrides: Partial<ViewModel> = {}): ViewModel {
  return {
    state: freshState(),
    today,
    now: new Date(today + 'T12:00:00Z'),
    selectedDate: today,
    query: '',
    selectedFoodId: null,
    amountRaw: '',
    logUnit: 'g',
    error: null,
    view: 'log',
    foodForm: emptyFoodForm,
    foodFormError: null,
    importText: '',
    importError: null,
    exportText: '',
    foodsQuery: '',
    ...overrides,
  };
}

const e = (id: string, foodId: string, grams: number, date = today): Entry => ({
  id, date, foodId, amount: grams, unit: 'g' as Unit, grams, loggedAt: `${date}T10:00:00Z`,
});

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('view — log/foods toggle', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders a view toggle with Log and Foods buttons', () => {
    render(container, vm(), noopHandlers);
    expect(container.querySelector('[data-testid="view-toggle-log"]')).to.exist;
    expect(container.querySelector('[data-testid="view-toggle-foods"]')).to.exist;
  });

  it('marks current view as active', () => {
    render(container, vm({ view: 'foods' }), noopHandlers);
    expect(container.querySelector('[data-testid="view-toggle-foods"][data-active="true"]')).to.exist;
    expect(container.querySelector('[data-testid="view-toggle-log"][data-active="true"]')).to.equal(null);
  });

  it('fires onViewChange when a toggle button is clicked', () => {
    let last = '';
    render(container, vm(), { ...noopHandlers, onViewChange: (v) => { last = v; } });
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();
    expect(last).to.equal('foods');
  });

  it('hides log view elements when view is foods', () => {
    render(container, vm({ view: 'foods' }), noopHandlers);
    expect(container.querySelector('[data-testid="log-button"]')).to.equal(null);
    expect(container.querySelector('[data-testid="entry-list"]')).to.equal(null);
  });

  it('hides foods view elements when view is log', () => {
    render(container, vm(), noopHandlers);
    expect(container.querySelector('[data-testid="food-form"]')).to.equal(null);
    expect(container.querySelector('[data-testid="food-row"]')).to.equal(null);
  });
});

describe('view — foods list', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('lists live foods alphabetically', () => {
    render(container, vm({ view: 'foods' }), noopHandlers);
    const rows = container.querySelectorAll('[data-testid="food-row"]');
    const names = Array.from(rows).map((r) => r.querySelector('[data-testid="food-row-name"]')!.textContent!.trim());
    expect(names).to.deep.equal([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('hides soft-deleted foods', () => {
    const s = freshState();
    s.foods = s.foods.map((f, i) => i === 0 ? { ...f, deletedAt: '2026-05-22T00:00:00Z' } : f);
    render(container, vm({ view: 'foods', state: s }), noopHandlers);
    expect(container.querySelectorAll('[data-testid="food-row"]').length).to.equal(s.foods.length - 1);
  });

  it('shows edit and delete buttons per row', () => {
    render(container, vm({ view: 'foods' }), noopHandlers);
    const firstRow = container.querySelector('[data-testid="food-row"]')!;
    expect(firstRow.querySelector('[data-testid="food-edit"]')).to.exist;
    expect(firstRow.querySelector('[data-testid="food-delete"]')).to.exist;
  });

  it('fires onEditFood when edit clicked', () => {
    let id = '';
    render(container, vm({ view: 'foods' }), { ...noopHandlers, onEditFood: (foodId) => { id = foodId; } });
    (container.querySelector('[data-testid="food-edit"]') as HTMLButtonElement).click();
    expect(id).to.match(/^seed-/);
  });

  it('fires onSoftDeleteFood when delete clicked', () => {
    let id = '';
    render(container, vm({ view: 'foods' }), { ...noopHandlers, onSoftDeleteFood: (foodId) => { id = foodId; } });
    (container.querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    expect(id).to.match(/^seed-/);
  });
});

describe('view — foods search', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders a foods-search input', () => {
    render(container, vm({ view: 'foods' }), noopHandlers);
    expect(container.querySelector('[data-testid="foods-search"]')).to.exist;
  });

  it('filters foods list by foodsQuery (case-insensitive substring)', () => {
    render(container, vm({ view: 'foods', foodsQuery: 'ban' }), noopHandlers);
    const names = Array.from(container.querySelectorAll('[data-testid="food-row-name"]')).map((n) => n.textContent!.trim());
    expect(names).to.deep.equal(['Banana']);
  });

  it('fires onFoodsQueryChange on input', () => {
    let last = '';
    render(container, vm({ view: 'foods' }), { ...noopHandlers, onFoodsQueryChange: (q) => { last = q; } });
    const input = container.querySelector('[data-testid="foods-search"]') as HTMLInputElement;
    input.value = 'oats';
    input.dispatchEvent(new Event('input'));
    expect(last).to.equal('oats');
  });
});

describe('view — food form', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders an add form when foodForm.mode is add', () => {
    render(container, vm({ view: 'foods' }), noopHandlers);
    expect(container.querySelector('[data-testid="food-form"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-name"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-kcal"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-protein"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-carbs"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-fat"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-primary-unit"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-submit"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-cancel"]')).to.equal(null);
  });

  it('does not show weight-per-unit input when primaryUnit is not "count"', () => {
    render(container, vm({ view: 'foods' }), noopHandlers);
    expect(container.querySelector('[data-testid="food-form-weight-per-unit"]')).to.equal(null);
  });

  it('shows weight-per-unit input when primaryUnit is "count"', () => {
    const countForm: FoodFormState = { ...emptyFoodForm, primaryUnit: 'count', weightPerUnitRaw: '50' };
    render(container, vm({ view: 'foods', foodForm: countForm }), noopHandlers);
    const wpu = container.querySelector('[data-testid="food-form-weight-per-unit"]') as HTMLInputElement;
    expect(wpu).to.exist;
    expect(wpu.value).to.equal('50');
  });

  it('renders an edit form (with cancel) when foodForm.mode is edit', () => {
    render(container, vm({ view: 'foods', foodForm: editFoodForm }), noopHandlers);
    expect(container.querySelector('[data-testid="food-form-cancel"]')).to.exist;
    expect((container.querySelector('[data-testid="food-form-name"]') as HTMLInputElement).value).to.equal('Banana');
  });

  it('edit form prefills primaryUnit and weightPerUnit for a count food', () => {
    const countEditForm: FoodFormState = {
      mode: 'edit', foodId: 'seed-egg',
      name: 'Egg', kcalRaw: '155', proteinRaw: '13', carbsRaw: '1.1', fatRaw: '11',
      primaryUnit: 'count', weightPerUnitRaw: '50',
    };
    render(container, vm({ view: 'foods', foodForm: countEditForm }), noopHandlers);
    const unitSelect = container.querySelector('[data-testid="food-form-primary-unit"]') as HTMLSelectElement;
    const wpu = container.querySelector('[data-testid="food-form-weight-per-unit"]') as HTMLInputElement;
    expect(unitSelect.value).to.equal('count');
    expect(wpu.value).to.equal('50');
  });

  it('shows food form error when set', () => {
    render(container, vm({ view: 'foods', foodFormError: 'A food with this name already exists.' }), noopHandlers);
    const err = container.querySelector('[data-testid="food-form-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('already exists');
  });

  it('fires onFoodFormChange when name input changes', () => {
    let captured: { field: string; value: string } | null = null;
    render(container, vm({ view: 'foods' }), {
      ...noopHandlers,
      onFoodFormChange: (field, value) => { captured = { field, value }; },
    });
    const input = container.querySelector('[data-testid="food-form-name"]') as HTMLInputElement;
    input.value = 'Cheese';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.deep.equal({ field: 'name', value: 'Cheese' });
  });

  it('fires onFoodFormUnitChange when unit dropdown changes', () => {
    let last: Unit | null = null;
    render(container, vm({ view: 'foods' }), { ...noopHandlers, onFoodFormUnitChange: (u) => { last = u; } });
    const select = container.querySelector('[data-testid="food-form-primary-unit"]') as HTMLSelectElement;
    select.value = 'count';
    select.dispatchEvent(new Event('change'));
    expect(last).to.equal('count');
  });

  it('fires onFoodFormSubmit when submit clicked', () => {
    let fired = false;
    render(container, vm({ view: 'foods' }), { ...noopHandlers, onFoodFormSubmit: () => { fired = true; } });
    (container.querySelector('[data-testid="food-form-submit"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onCancelEdit when cancel clicked', () => {
    let fired = false;
    render(container, vm({ view: 'foods', foodForm: editFoodForm }), { ...noopHandlers, onCancelEdit: () => { fired = true; } });
    (container.querySelector('[data-testid="food-form-cancel"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });
});

describe('view — import/export', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders export button and import textarea', () => {
    render(container, vm({ view: 'foods' }), noopHandlers);
    expect(container.querySelector('[data-testid="export-button"]')).to.exist;
    expect(container.querySelector('[data-testid="import-textarea"]')).to.exist;
    expect(container.querySelector('[data-testid="import-button"]')).to.exist;
  });

  it('fires onExport when export clicked', () => {
    let fired = false;
    render(container, vm({ view: 'foods' }), { ...noopHandlers, onExport: () => { fired = true; } });
    (container.querySelector('[data-testid="export-button"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onImport when import clicked', () => {
    let fired = false;
    render(container, vm({ view: 'foods' }), { ...noopHandlers, onImport: () => { fired = true; } });
    (container.querySelector('[data-testid="import-button"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onImportTextChange when textarea changes', () => {
    let val = '';
    render(container, vm({ view: 'foods' }), { ...noopHandlers, onImportTextChange: (v) => { val = v; } });
    const ta = container.querySelector('[data-testid="import-textarea"]') as HTMLTextAreaElement;
    ta.value = '{"version":2}';
    ta.dispatchEvent(new Event('input'));
    expect(val).to.equal('{"version":2}');
  });

  it('shows import error when set', () => {
    render(container, vm({ view: 'foods', importError: 'Invalid JSON' }), noopHandlers);
    const err = container.querySelector('[data-testid="import-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('Invalid JSON');
  });
});

describe('view — log view uses sortFoodsForLog when query is empty', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('orders foods by recent-usage when query is empty', () => {
    const s = freshState();
    s.entries = [e('e1', 'seed-broccoli', 100, '2026-05-22')];
    render(container, vm({ state: s }), noopHandlers);
    const opts = container.querySelectorAll('[data-testid="food-option"]');
    expect(opts[0]!.textContent).to.contain('Broccoli');
  });
});
