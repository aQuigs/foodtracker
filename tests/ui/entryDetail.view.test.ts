import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { ViewModel, ViewHandlers, FoodFormState } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { Entry, State, Unit } from '../../src/domain/types.js';

const today = '2026-05-23';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

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
    expandedEntryId: null,
    ...overrides,
  };
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
  onToggleEntry: () => {},
  onEditEntry: () => {},
};

const e = (id: string, foodId: string, amount: number, unit: Unit, grams: number, date = today): Entry => ({
  id, date, foodId, amount, unit, grams, loggedAt: `${date}T10:00:00Z`,
});

describe('entry detail card — view', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('clicking an entry row calls onToggleEntry with the entry id', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-banana', 120, 'g', 120)],
    };
    let toggledId: string | null = null;
    render(container, vm({ state }), {
      ...noopHandlers,
      onToggleEntry: (id) => { toggledId = id; },
    });
    (container.querySelector('[data-testid="entry-row"]') as HTMLElement).click();
    expect(toggledId).to.equal('e1');
  });

  it('clicking the delete button (×) does NOT call onToggleEntry', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-banana', 120, 'g', 120)],
    };
    let toggled = false;
    render(container, vm({ state }), {
      ...noopHandlers,
      onToggleEntry: () => { toggled = true; },
    });
    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    expect(toggled).to.equal(false);
  });

  it('renders no entry-detail element when expandedEntryId is null', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-banana', 120, 'g', 120)],
    };
    render(container, vm({ state, expandedEntryId: null }), noopHandlers);
    expect(container.querySelector('[data-testid="entry-detail"]')).to.equal(null);
  });

  it('renders entry-detail when expandedEntryId matches the entry', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-banana', 120, 'g', 120)],
    };
    render(container, vm({ state, expandedEntryId: 'e1' }), noopHandlers);
    expect(container.querySelector('[data-testid="entry-detail"]')).to.exist;
  });

  it('does not render entry-detail when expandedEntryId is a different entry id', () => {
    const state: State = {
      ...freshState(),
      entries: [
        e('e1', 'seed-banana', 120, 'g', 120),
        e('e2', 'seed-oats', 50, 'g', 50),
      ],
    };
    render(container, vm({ state, expandedEntryId: 'e2' }), noopHandlers);
    const details = container.querySelectorAll('[data-testid="entry-detail"]');
    expect(details.length).to.equal(1);

    const rows = Array.from(container.querySelectorAll('[data-testid="entry-row"], [data-testid="entry-detail"]'));
    const detailIndex = rows.findIndex((el) => el.getAttribute('data-testid') === 'entry-detail');
    const rowBefore = rows[detailIndex - 1];
    expect(rowBefore?.getAttribute('data-testid')).to.equal('entry-row');
  });

  it('entry-detail-per-100g shows food per-100g kcal, protein, carbs, fat', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-banana', 120, 'g', 120)],
    };
    render(container, vm({ state, expandedEntryId: 'e1' }), noopHandlers);
    const per100 = container.querySelector('[data-testid="entry-detail-per-100g"]')!;
    expect(per100).to.exist;
    expect(per100.textContent).to.contain('89');
  });

  it('entry-detail-scaled shows values scaled to entry grams', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-banana', 120, 'g', 120)],
    };
    render(container, vm({ state, expandedEntryId: 'e1' }), noopHandlers);
    const scaled = container.querySelector('[data-testid="entry-detail-scaled"]')!;
    expect(scaled).to.exist;
    expect(scaled.textContent).to.contain('107');
  });

  it('entry-detail-delete button calls onDelete with the entry id', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-banana', 120, 'g', 120)],
    };
    let deletedId: string | null = null;
    render(container, vm({ state, expandedEntryId: 'e1' }), {
      ...noopHandlers,
      onDelete: (id) => { deletedId = id; },
    });
    (container.querySelector('[data-testid="entry-detail-delete"]') as HTMLButtonElement).click();
    expect(deletedId).to.equal('e1');
  });

  it('entry-detail-edit button calls onEditEntry with the entry id', () => {
    const state: State = {
      ...freshState(),
      entries: [e('e1', 'seed-banana', 120, 'g', 120)],
    };
    let editedId: string | null = null;
    render(container, vm({ state, expandedEntryId: 'e1' }), {
      ...noopHandlers,
      onEditEntry: (id) => { editedId = id; },
    });
    (container.querySelector('[data-testid="entry-detail-edit"]') as HTMLButtonElement).click();
    expect(editedId).to.equal('e1');
  });
});
