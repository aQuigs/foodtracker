import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { baseVm, makeContainer, noopHandlers, seedTestState, TODAY as today } from '../_helpers.js';

describe('view — log/foods toggle', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders a view toggle with Log and Foods buttons', () => {
    render(container, baseVm, noopHandlers);
    expect(container.querySelector('[data-testid="view-toggle-log"]')).to.exist;
    expect(container.querySelector('[data-testid="view-toggle-foods"]')).to.exist;
  });

  it('marks current view as active', () => {
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    expect(container.querySelector('[data-testid="view-toggle-foods"][data-active="true"]')).to.exist;
    expect(container.querySelector('[data-testid="view-toggle-log"][data-active="true"]')).to.equal(null);
  });

  it('fires onViewChange when a toggle button is clicked', () => {
    let last = '';
    render(container, baseVm, { ...noopHandlers, onViewChange: (v) => { last = v; } });
    (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();
    expect(last).to.equal('foods');
  });

  it('hides log view elements when view is foods', () => {
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    expect(container.querySelector('[data-testid="log-button"]')).to.equal(null);
    expect(container.querySelector('[data-testid="entry-list"]')).to.equal(null);
  });

  it('hides foods view elements when view is log', () => {
    render(container, baseVm, noopHandlers);
    expect(container.querySelector('[data-testid="food-form"]')).to.equal(null);
    expect(container.querySelector('[data-testid="food-row"]')).to.equal(null);
  });
});

describe('view — foods list', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('lists live foods alphabetically', () => {
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="food-row"]');
    const names = Array.from(rows).map((r) => r.querySelector('[data-testid="food-row-name"]')!.textContent!.trim());
    expect(names).to.deep.equal([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('hides soft-deleted foods', () => {
    const s = seedTestState();
    s.foods = s.foods.map((f, i) => i === 0 ? { ...f, deletedAt: '2026-05-22T00:00:00Z' } : f);
    render(container, { ...baseVm, view: 'foods', state: s }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="food-row"]');
    expect(rows.length).to.equal(s.foods.length - 1);
  });

  it('shows edit and delete buttons per row', () => {
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    const firstRow = container.querySelector('[data-testid="food-row"]')!;
    expect(firstRow.querySelector('[data-testid="food-edit"]')).to.exist;
    expect(firstRow.querySelector('[data-testid="food-delete"]')).to.exist;
  });

  it('fires onEditFood when edit clicked', () => {
    let id = '';
    render(container, { ...baseVm, view: 'foods' }, { ...noopHandlers, onEditFood: (foodId) => { id = foodId; } });
    (container.querySelector('[data-testid="food-edit"]') as HTMLButtonElement).click();
    expect(id).to.match(/^seed-/);
  });

  it('fires onSoftDeleteFood when delete clicked', () => {
    let id = '';
    render(container, { ...baseVm, view: 'foods' }, { ...noopHandlers, onSoftDeleteFood: (foodId) => { id = foodId; } });
    (container.querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    expect(id).to.match(/^seed-/);
  });
});

describe('view — foods search', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders a foods-search input', () => {
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    expect(container.querySelector('[data-testid="foods-search"]')).to.exist;
  });

  it('filters foods list by foodsQuery (case-insensitive substring)', () => {
    render(container, { ...baseVm, view: 'foods', foodsQuery: 'ban' }, noopHandlers);
    const names = Array.from(container.querySelectorAll('[data-testid="food-row-name"]')).map((n) => n.textContent!.trim());
    expect(names).to.deep.equal(['Banana']);
  });

  it('fires onFoodsQueryChange on input', () => {
    let last = '';
    render(container, { ...baseVm, view: 'foods' }, { ...noopHandlers, onFoodsQueryChange: (q) => { last = q; } });
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
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    expect(container.querySelector('[data-testid="food-form"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-name"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-calories"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-protein"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-carbs"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-fat"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-submit"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-cancel"]')).to.equal(null);
  });

  it('renders an edit form (with cancel) when foodForm.mode is edit', () => {
    const vm = { ...baseVm, view: 'foods' as const, foodForm: { mode: 'edit' as const, foodId: 'seed-banana', name: 'Banana', calories: '89', protein: '1.1', carbs: '22.8', fat: '0.3', servingSize: '100', servingUnit: 'g' } };
    render(container, vm, noopHandlers);
    expect(container.querySelector('[data-testid="food-form-cancel"]')).to.exist;
    expect((container.querySelector('[data-testid="food-form-name"]') as HTMLInputElement).value).to.equal('Banana');
  });

  it('shows food form error when set', () => {
    render(container, { ...baseVm, view: 'foods', foodFormError: 'A food with this name already exists.' }, noopHandlers);
    const err = container.querySelector('[data-testid="food-form-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('already exists');
  });

  it('fires onFoodFormChange when name input changes', () => {
    let captured: { field: string; value: string } | null = null;
    render(container, { ...baseVm, view: 'foods' }, {
      ...noopHandlers,
      onFoodFormChange: (field, value) => { captured = { field, value }; },
    });
    const input = container.querySelector('[data-testid="food-form-name"]') as HTMLInputElement;
    input.value = 'Cheese';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.deep.equal({ field: 'name', value: 'Cheese' });
  });

  it('fires onFoodFormSubmit when submit clicked', () => {
    let fired = false;
    render(container, { ...baseVm, view: 'foods' }, { ...noopHandlers, onFoodFormSubmit: () => { fired = true; } });
    (container.querySelector('[data-testid="food-form-submit"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onCancelEdit when cancel clicked', () => {
    let fired = false;
    const vm = { ...baseVm, view: 'foods' as const, foodForm: { mode: 'edit' as const, foodId: 'seed-banana', name: 'Banana', calories: '89', protein: '1.1', carbs: '22.8', fat: '0.3', servingSize: '100', servingUnit: 'g' } };
    render(container, vm, { ...noopHandlers, onCancelEdit: () => { fired = true; } });
    (container.querySelector('[data-testid="food-form-cancel"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('renders both serving size and serving unit inputs', () => {
    const gForm = { ...baseVm, view: 'foods' as const, foodForm: { ...baseVm.foodForm, servingUnit: 'g', servingSize: '100' } };
    render(container, gForm, noopHandlers);
    expect(container.querySelector('[data-testid="food-form-servingSize"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-servingUnit"]')).to.exist;

    const countForm = { ...baseVm, view: 'foods' as const, foodForm: { ...baseVm.foodForm, servingUnit: 'count', servingSize: '1' } };
    render(container, countForm, noopHandlers);
    const size = container.querySelector('[data-testid="food-form-servingSize"]') as HTMLInputElement;
    expect(size.value).to.equal('1');
  });

  it('edit form prefills servingUnit + servingSize', () => {
    const vm = { ...baseVm, view: 'foods' as const, foodForm: { mode: 'edit' as const, foodId: 'seed-egg', name: 'Egg', calories: '78', protein: '6.5', carbs: '0.6', fat: '5.5', servingSize: '1', servingUnit: 'count' } };
    render(container, vm, noopHandlers);
    const unit = container.querySelector('[data-testid="food-form-servingUnit"]') as HTMLSelectElement;
    expect(unit.value).to.equal('count');
    const size = container.querySelector('[data-testid="food-form-servingSize"]') as HTMLInputElement;
    expect(size.value).to.equal('1');
  });
});

describe('view — import/export', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders export button and import textarea', () => {
    render(container, { ...baseVm, view: 'foods' }, noopHandlers);
    expect(container.querySelector('[data-testid="export-button"]')).to.exist;
    expect(container.querySelector('[data-testid="import-textarea"]')).to.exist;
    expect(container.querySelector('[data-testid="import-button"]')).to.exist;
  });

  it('fires onExport when export clicked', () => {
    let fired = false;
    render(container, { ...baseVm, view: 'foods' }, { ...noopHandlers, onExport: () => { fired = true; } });
    (container.querySelector('[data-testid="export-button"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onImport when import clicked', () => {
    let fired = false;
    render(container, { ...baseVm, view: 'foods' }, { ...noopHandlers, onImport: () => { fired = true; } });
    (container.querySelector('[data-testid="import-button"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onImportTextChange when textarea changes', () => {
    let val = '';
    render(container, { ...baseVm, view: 'foods' }, { ...noopHandlers, onImportTextChange: (v) => { val = v; } });
    const ta = container.querySelector('[data-testid="import-textarea"]') as HTMLTextAreaElement;
    ta.value = '{"version":1}';
    ta.dispatchEvent(new Event('input'));
    expect(val).to.equal('{"version":1}');
  });

  it('shows import error when set', () => {
    render(container, { ...baseVm, view: 'foods', importError: 'Invalid JSON', exportText: '', foodsQuery: '' }, noopHandlers);
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
    const s = seedTestState();
    s.entries = [
      { id: 'e1', date: '2026-05-22', foodId: 'seed-broccoli', amount: 100, unit: 'g', loggedAt: '2026-05-22T10:00:00Z' },
    ];
    render(container, { ...baseVm, state: s }, noopHandlers);
    const opts = container.querySelectorAll('[data-testid="food-option"]');
    expect(opts[0]!.textContent).to.contain('Broccoli');
  });
});
