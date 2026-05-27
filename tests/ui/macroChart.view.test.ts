import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import { MACRO_KEYS, NUTRIENTS } from '../../src/domain/types.js';
import type { Entry, State } from '../../src/domain/types.js';
import { baseVm, makeContainer, noopHandlers, TODAY as today, withMealsFromEntries } from '../_helpers.js';

function chart(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-testid="macro-chart"]') as HTMLElement;
}

function slices(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll('[data-testid^="macro-slice-"]')) as unknown as SVGPathElement[];
}

function legendRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid^="macro-legend-"]')) as HTMLElement[];
}

function stateWithLogs(entries: Entry[]): State {
  const base = freshState();
  return withMealsFromEntries({ ...base, entries });
}

describe('macro chart rendering', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('chart container is hidden when day totals are zero', () => {
    render(container, { ...baseVm, state: freshState() }, noopHandlers);
    expect(chart(container).hidden).to.equal(true);
  });

  it('chart container is visible when at least one entry contributes calories', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    expect(chart(container).hidden).to.equal(false);
  });

  it('renders one slice per MACRO_KEY', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    expect(slices(container).length).to.equal(MACRO_KEYS.length);
    for (const key of MACRO_KEYS) {
      expect(container.querySelector(`[data-testid="macro-slice-${key}"]`), `missing slice for ${key}`).to.exist;
    }
  });

  it('renders one legend row per MACRO_KEY with the integer percentage', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    expect(legendRows(container).length).to.equal(MACRO_KEYS.length);
    for (const key of MACRO_KEYS) {
      const row = container.querySelector(`[data-testid="macro-legend-${key}"]`)!;
      expect(row.textContent).to.contain(NUTRIENTS[key].label);
      expect(row.textContent).to.match(/\d+\s*%/);
    }
  });

  it('chart appears between the entry list and the day total row', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    const entryList = container.querySelector('[data-testid="entry-list"]')!;
    const totals = container.querySelector('[data-testid="totals-row"]')!;
    const c = chart(container);
    expect(entryList.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING, 'chart comes after entry-list').to.not.equal(0);
    expect(c.compareDocumentPosition(totals) & Node.DOCUMENT_POSITION_FOLLOWING, 'totals comes after chart').to.not.equal(0);
  });

  it('hides chart on a date with no contributing entries even if other dates have logs', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state, selectedDate: '2026-05-22' }, noopHandlers);
    expect(chart(container).hidden).to.equal(true);
  });

  it('svg has role=img and an aria-label summarising the split', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    const svg = chart(container).querySelector('svg')!;
    expect(svg.getAttribute('role')).to.equal('img');
    const label = svg.getAttribute('aria-label') ?? '';
    expect(label).to.match(/macro/i);
    for (const key of MACRO_KEYS) {
      expect(label).to.contain(NUTRIENTS[key].label);
    }
  });

  it('updates the chart when the selected date changes between renders', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    expect(chart(container).hidden).to.equal(false);
    render(container, { ...baseVm, state, selectedDate: '2026-05-22' }, noopHandlers);
    expect(chart(container).hidden).to.equal(true);
  });
});
