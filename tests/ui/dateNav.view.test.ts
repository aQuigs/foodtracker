import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';
import { baseVm, makeContainer, noopHandlers, TODAY as today } from '../_helpers.js';

describe('date navigation in view', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders prev/next buttons and a date input', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, noopHandlers);
    expect(container.querySelector('[data-testid="prev-date"]')).to.exist;
    expect(container.querySelector('[data-testid="next-date"]')).to.exist;
    expect(container.querySelector('[data-testid="date-input"]')).to.exist;
  });

  it('date input value reflects selectedDate', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: '2026-05-20' }, noopHandlers);
    const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    expect(input.value).to.equal('2026-05-20');
  });

  it('hides "Today" shortcut when selectedDate equals today', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, noopHandlers);
    expect((container.querySelector('[data-testid="jump-today"]') as HTMLButtonElement).hidden).to.equal(true);
  });

  it('shows "Today" shortcut when selectedDate ≠ today', () => {
    render(container, { ...baseVm, state: freshState(), today, selectedDate: '2026-05-20' }, noopHandlers);
    expect((container.querySelector('[data-testid="jump-today"]') as HTMLButtonElement).hidden).to.equal(false);
  });

  it('entry list filters by selectedDate, not today', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'today',     date: today,         foodId: 'seed-banana', amount: 100, unit: 'g', loggedAt: `${today}T10:00:00Z` },
        { id: 'yesterday', date: '2026-05-22',  foodId: 'seed-oats', amount: 50, unit: 'g',   loggedAt: '2026-05-22T10:00:00Z' },
      ],
    };
    render(container, { ...baseVm, state, today, selectedDate: '2026-05-22' }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Oats');
  });

  it('totals reflect selectedDate, not today', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'today',     date: today,        foodId: 'seed-banana', amount: 100, unit: 'g', loggedAt: `${today}T10:00:00Z` },
        { id: 'yesterday', date: '2026-05-22', foodId: 'seed-oats', amount: 100, unit: 'g',   loggedAt: '2026-05-22T10:00:00Z' },
      ],
    };
    render(container, { ...baseVm, state, today, selectedDate: '2026-05-22' }, noopHandlers);
    const totals = container.querySelector('[data-testid="totals-row"]')!.textContent!;
    expect(totals).to.contain('379');
  });

  it('fires onPrevDate when prev button clicked', () => {
    let fired = false;
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, {
      ...noopHandlers,
      onPrevDate: () => { fired = true; },
    });
    (container.querySelector('[data-testid="prev-date"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onNextDate when next button clicked', () => {
    let fired = false;
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, {
      ...noopHandlers,
      onNextDate: () => { fired = true; },
    });
    (container.querySelector('[data-testid="next-date"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });

  it('fires onDateChange with new value when date input changes', () => {
    let val = '';
    render(container, { ...baseVm, state: freshState(), today, selectedDate: today }, {
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
    render(container, { ...baseVm, state: freshState(), today, selectedDate: '2026-05-20' }, {
      ...noopHandlers,
      onJumpToday: () => { fired = true; },
    });
    (container.querySelector('[data-testid="jump-today"]') as HTMLButtonElement).click();
    expect(fired).to.equal(true);
  });
});
