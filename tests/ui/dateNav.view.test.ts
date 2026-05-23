import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';

const today = '2026-05-23';

const noopHandlers = {
  onLog: () => {},
  onDelete: () => {},
  onQueryChange: () => {},
  onFoodSelect: () => {},
  onGramsChange: () => {},
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

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const baseVm = {
  state: freshState(),
  today, now: new Date(today + 'T12:00:00Z'), selectedDate: today,
  query: '',
  selectedFoodId: null as string | null,
  gramsRaw: '',
  error: null as string | null,
  view: 'log' as 'log' | 'foods',
  foodForm: { mode: 'add' as 'add' | 'edit', foodId: null as string | null, name: '', kcalRaw: '', proteinRaw: '', carbsRaw: '', fatRaw: '' },
  foodFormError: null as string | null,
  importText: '',
  importError: null as string | null,
  exportText: '',
  foodsQuery: '',
};

describe('date navigation in view', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders prev/next buttons and a date input', () => {
    render(container, { ...baseVm }, noopHandlers);
    expect(container.querySelector('[data-testid="prev-date"]')).to.exist;
    expect(container.querySelector('[data-testid="next-date"]')).to.exist;
    expect(container.querySelector('[data-testid="date-input"]')).to.exist;
  });

  it('date input value reflects selectedDate', () => {
    render(container, { ...baseVm, selectedDate: '2026-05-20' }, noopHandlers);
    const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    expect(input.value).to.equal('2026-05-20');
  });

  it('hides "Today" shortcut when selectedDate equals today', () => {
    render(container, { ...baseVm }, noopHandlers);
    expect(container.querySelector('[data-testid="jump-today"]')).to.equal(null);
  });

  it('shows "Today" shortcut when selectedDate ≠ today', () => {
    render(container, { ...baseVm, selectedDate: '2026-05-20' }, noopHandlers);
    expect(container.querySelector('[data-testid="jump-today"]')).to.exist;
  });

  it('entry list filters by selectedDate, not today', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'today',     date: today,         foodId: 'seed-banana', grams: 100, loggedAt: `${today}T10:00:00Z` },
        { id: 'yesterday', date: '2026-05-22',  foodId: 'seed-oats',   grams: 50,  loggedAt: '2026-05-22T10:00:00Z' },
      ],
    };
    render(container, { ...baseVm, state, selectedDate: '2026-05-22' }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Oats');
  });

  it('totals reflect selectedDate, not today', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'today',     date: today,        foodId: 'seed-banana', grams: 100, loggedAt: `${today}T10:00:00Z` },
        { id: 'yesterday', date: '2026-05-22', foodId: 'seed-oats',   grams: 100, loggedAt: '2026-05-22T10:00:00Z' },
      ],
    };
    render(container, { ...baseVm, state, selectedDate: '2026-05-22' }, noopHandlers);
    const totals = container.querySelector('[data-testid="totals-row"]')!.textContent!;
    expect(totals).to.contain('379');
  });

  it('fires onPrevDate when prev button clicked', () => {
    let fired = false;
    render(container, { ...baseVm }, {
      ...noopHandlers,
      onPrevDate: () => { fired = true; },
    });
    (container.querySelector('[data-testid="prev-date"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onNextDate when next button clicked', () => {
    let fired = false;
    render(container, { ...baseVm }, {
      ...noopHandlers,
      onNextDate: () => { fired = true; },
    });
    (container.querySelector('[data-testid="next-date"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onDateChange with new value when date input changes', () => {
    let val = '';
    render(container, { ...baseVm }, {
      ...noopHandlers,
      onDateChange: (d) => { val = d; },
    });
    const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    input.value = '2026-05-15';
    input.dispatchEvent(new Event('change'));
    expect(val).to.equal('2026-05-15');
  });

  it('fires onJumpToday when today shortcut clicked', () => {
    let fired = false;
    render(container, { ...baseVm, selectedDate: '2026-05-20' }, {
      ...noopHandlers,
      onJumpToday: () => { fired = true; },
    });
    (container.querySelector('[data-testid="jump-today"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });
});
