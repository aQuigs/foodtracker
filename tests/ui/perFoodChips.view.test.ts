import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { ViewModel, ViewHandlers, FoodFormState } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { Food, State } from '../../src/domain/types.js';

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
  onFoodFormChipsReset: () => {},
  onFoodFormChipChange: () => {},
};

const emptyFoodForm: FoodFormState = {
  mode: 'add', foodId: null,
  name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '',
  primaryUnit: 'g', weightPerUnitRaw: '',
  chipsRaw: ['', '', '', ''],
};

function stateWithCustomChips(foodId: string, chips: number[]): State {
  const s = freshState();
  s.foods = s.foods.map((f) => f.id === foodId ? { ...f, chips } : f);
  return s;
}

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

describe('log view — custom chips for food', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('shows custom chips when food has chips and logUnit matches primaryUnit', () => {
    const state = stateWithCustomChips('seed-banana', [80, 160, 240, 320]);
    render(container, vm({ state, selectedFoodId: 'seed-banana', logUnit: 'g' }), noopHandlers);
    const row = container.querySelector('[data-testid="chip-row"]')!;
    const chips = Array.from(row.querySelectorAll('button')).map((b) => b.textContent!.trim());
    expect(chips).to.deep.equal(['80', '160', '240', '320']);
  });

  it('falls back to unit defaults when food has chips but logUnit differs from primaryUnit', () => {
    const state = stateWithCustomChips('seed-banana', [80, 160, 240, 320]);
    render(container, vm({ state, selectedFoodId: 'seed-banana', logUnit: 'oz' }), noopHandlers);
    const row = container.querySelector('[data-testid="chip-row"]')!;
    const chips = Array.from(row.querySelectorAll('button')).map((b) => b.textContent!.trim());
    expect(chips).to.deep.equal(['1', '2', '4', '8']);
  });
});

describe('foods view — food form chip editor', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders 4 chip inputs in the food form', () => {
    render(container, vm({ view: 'foods' }), noopHandlers);
    expect(container.querySelector('[data-testid="food-form-chip-0"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-chip-1"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-chip-2"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form-chip-3"]')).to.exist;
  });

  it('renders a reset-to-defaults button in the food form', () => {
    render(container, vm({ view: 'foods' }), noopHandlers);
    expect(container.querySelector('[data-testid="food-form-chips-reset"]')).to.exist;
  });

  it('pre-fills chip inputs from foodForm.chipsRaw when editing a food with overrides', () => {
    const editFoodForm: FoodFormState = {
      mode: 'edit', foodId: 'seed-banana',
      name: 'Banana', kcalRaw: '89', proteinRaw: '1.1', carbsRaw: '22.8', fatRaw: '0.3',
      primaryUnit: 'g', weightPerUnitRaw: '',
      chipsRaw: ['80', '160', '240', '320'],
    };
    render(container, vm({ view: 'foods', foodForm: editFoodForm }), noopHandlers);
    const chip0 = container.querySelector('[data-testid="food-form-chip-0"]') as HTMLInputElement;
    const chip3 = container.querySelector('[data-testid="food-form-chip-3"]') as HTMLInputElement;
    expect(chip0.value).to.equal('80');
    expect(chip3.value).to.equal('320');
  });

  it('fires onFoodFormChipChange when a chip input changes', () => {
    let captured: { index: number; value: string } | null = null;
    render(container, vm({ view: 'foods' }), {
      ...noopHandlers,
      onFoodFormChipChange: (index, value) => { captured = { index, value }; },
    });
    const input = container.querySelector('[data-testid="food-form-chip-1"]') as HTMLInputElement;
    input.value = '150';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.deep.equal({ index: 1, value: '150' });
  });

  it('fires onFoodFormChipsReset when reset button is clicked', () => {
    let fired = false;
    render(container, vm({ view: 'foods' }), {
      ...noopHandlers,
      onFoodFormChipsReset: () => { fired = true; },
    });
    (container.querySelector('[data-testid="food-form-chips-reset"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });
});
