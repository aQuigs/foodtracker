import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { ViewModel, ViewHandlers, FoodFormState } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { Unit } from '../../src/domain/types.js';

const today = '2026-05-23';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

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

describe('chip-row rendering', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('chip-row is absent when no food is selected', () => {
    render(container, vm({ selectedFoodId: null }), noopHandlers);
    expect(container.querySelector('[data-testid="chip-row"]')).to.equal(null);
  });

  it('chip-row is present when a food is selected', () => {
    render(container, vm({ selectedFoodId: 'seed-banana' }), noopHandlers);
    expect(container.querySelector('[data-testid="chip-row"]')).to.not.equal(null);
  });

  it('chip values match the g unit defaults', () => {
    render(container, vm({ selectedFoodId: 'seed-banana', logUnit: 'g' }), noopHandlers);
    const row = container.querySelector('[data-testid="chip-row"]')!;
    const chips = Array.from(row.querySelectorAll('button'));
    const values = chips.map((b) => b.textContent!.trim());
    expect(values).to.deep.equal(['50', '100', '150', '200']);
  });

  it('chip values match the oz unit defaults', () => {
    render(container, vm({ selectedFoodId: 'seed-banana', logUnit: 'oz' }), noopHandlers);
    const row = container.querySelector('[data-testid="chip-row"]')!;
    const chips = Array.from(row.querySelectorAll('button'));
    const values = chips.map((b) => b.textContent!.trim());
    expect(values).to.deep.equal(['1', '2', '4', '8']);
  });

  it('chip values match the lb unit defaults', () => {
    render(container, vm({ selectedFoodId: 'seed-banana', logUnit: 'lb' }), noopHandlers);
    const row = container.querySelector('[data-testid="chip-row"]')!;
    const chips = Array.from(row.querySelectorAll('button'));
    const values = chips.map((b) => b.textContent!.trim());
    expect(values).to.deep.equal(['0.25', '0.5', '0.75', '1']);
  });

  it('chip values match the count unit defaults', () => {
    render(container, vm({ selectedFoodId: 'seed-egg', logUnit: 'count' }), noopHandlers);
    const row = container.querySelector('[data-testid="chip-row"]')!;
    const chips = Array.from(row.querySelectorAll('button'));
    const values = chips.map((b) => b.textContent!.trim());
    expect(values).to.deep.equal(['1', '2', '3', '4']);
  });

  it('chips re-render with new values when logUnit changes', () => {
    render(container, vm({ selectedFoodId: 'seed-banana', logUnit: 'g' }), noopHandlers);
    let row = container.querySelector('[data-testid="chip-row"]')!;
    expect(row.querySelector('[data-testid="chip-50"]')).to.not.equal(null);
    expect(row.querySelector('[data-testid="chip-1"]')).to.equal(null);

    render(container, vm({ selectedFoodId: 'seed-banana', logUnit: 'oz' }), noopHandlers);
    row = container.querySelector('[data-testid="chip-row"]')!;
    expect(row.querySelector('[data-testid="chip-1"]')).to.not.equal(null);
    expect(row.querySelector('[data-testid="chip-50"]')).to.equal(null);
  });

  it('each chip has the correct data-testid (chip-{value})', () => {
    render(container, vm({ selectedFoodId: 'seed-banana', logUnit: 'lb' }), noopHandlers);
    const row = container.querySelector('[data-testid="chip-row"]')!;
    expect(row.querySelector('[data-testid="chip-0.25"]')).to.not.equal(null);
    expect(row.querySelector('[data-testid="chip-0.5"]')).to.not.equal(null);
    expect(row.querySelector('[data-testid="chip-0.75"]')).to.not.equal(null);
    expect(row.querySelector('[data-testid="chip-1"]')).to.not.equal(null);
  });

  it('clicking a chip calls onAmountChange with the chip value as a string', () => {
    let received: string | null = null;
    render(container, vm({ selectedFoodId: 'seed-banana', logUnit: 'g' }), {
      ...noopHandlers,
      onAmountChange: (a) => { received = a; },
    });
    const chip = container.querySelector('[data-testid="chip-100"]') as HTMLButtonElement;
    chip.click();
    expect(received).to.equal('100');
  });

  it('clicking a fractional chip calls onAmountChange with the fractional value as a string', () => {
    let received: string | null = null;
    render(container, vm({ selectedFoodId: 'seed-banana', logUnit: 'lb' }), {
      ...noopHandlers,
      onAmountChange: (a) => { received = a; },
    });
    const chip = container.querySelector('[data-testid="chip-0.25"]') as HTMLButtonElement;
    chip.click();
    expect(received).to.equal('0.25');
  });
});
