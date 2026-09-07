import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { MACRO_KEYS, NUTRIENTS } from '../../src/domain/types.js';
import { baseVm, makeContainer, noopHandlers, seedTestState, stateWithEntries as stateWithLogs, TODAY as today } from '../_helpers.js';

function chart(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-testid="day-summary"]') as HTMLElement;
}

function slices(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll('[data-testid^="macro-slice-"]')) as unknown as SVGPathElement[];
}

function legendRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid^="macro-legend-"]')) as HTMLElement[];
}

describe('macro chart rendering', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('the card is mounted when at least one entry contributes calories', () => {
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

  it('prints the day\'s calories in the middle of the ring', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    const total = container.querySelector('.macro-svg [data-testid="macro-total-calories"]');
    expect(total, 'the ring must carry a centre label').to.exist;
    expect(total!.textContent).to.contain('107');
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

  it('the card closes the day, below the entry list', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    const entryList = container.querySelector('[data-testid="entry-list"]')!;
    const c = chart(container);
    expect(entryList.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING, 'card comes after entry-list').to.not.equal(0);
  });

  it('reads zero on a date with no contributing entries even if other dates have logs', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state, selectedDate: '2026-05-22' }, noopHandlers);
    expect(container.querySelector('[data-testid="macro-total-calories"]')!.textContent).to.equal('0');
    expect(!!container.querySelector('[data-testid="macro-track"]'), 'an empty day draws a bare ring').to.equal(true);
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

  it('updates the card when the selected date changes between renders', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    expect(container.querySelector('[data-testid="macro-total-calories"]')!.textContent).to.equal('107');
    render(container, { ...baseVm, state, selectedDate: '2026-05-22' }, noopHandlers);
    expect(container.querySelector('[data-testid="macro-total-calories"]')!.textContent).to.equal('0');
    const svg = chart(container).querySelector('svg')!;
    expect(svg.getAttribute('aria-label'), 'a stale split must not be announced').to.not.contain('%');
  });

  it('renders a full ring when only one macro is non-zero (olive oil = fat only)', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-olive-oil', amount: 10, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    const fatSlice = container.querySelector('[data-testid="macro-slice-fat"]')!;
    expect(fatSlice.getAttribute('d'), 'fat slice must have a non-empty path').to.not.equal('');
    const legend = container.querySelector('[data-testid="macro-legend-fat"]')!;
    expect(legend.textContent).to.match(/100\s*%/);
  });

  it('every MACRO_KEY has a slice and legend testid even when only one macro is non-zero', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-olive-oil', amount: 10, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    for (const key of MACRO_KEYS) {
      expect(container.querySelector(`[data-testid="macro-slice-${key}"]`), `missing slice testid for ${key}`).to.exist;
      expect(container.querySelector(`[data-testid="macro-legend-${key}"]`), `missing legend testid for ${key}`).to.exist;
    }
  });

  it('renders a testid for every MACRO_KEY even when one macro is zero (chicken = 0 carbs)', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-chicken', amount: 100, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    for (const key of MACRO_KEYS) {
      expect(container.querySelector(`[data-testid="macro-slice-${key}"]`), `missing slice testid for ${key}`).to.exist;
      expect(container.querySelector(`[data-testid="macro-legend-${key}"]`), `missing legend testid for ${key}`).to.exist;
    }
    const carbsLegend = container.querySelector('[data-testid="macro-legend-carbs"]')!;
    expect(carbsLegend.textContent).to.match(/0\s*%/);
  });

  it('legend is aria-hidden so screen readers use the single svg aria-label', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    const legend = container.querySelector('.macro-legend')!;
    expect(legend.getAttribute('aria-hidden')).to.equal('true');
  });

  // Broccoli's exact shares are 26.17 / 65.42 / 8.41, which plain rounding
  // would print as 99%.
  it('legend integers sum to exactly 100, and each row states its share once', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-broccoli', amount: 100, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    const pcts = legendRows(container).map((row) => Number(row.textContent!.match(/(\d+)\s*%/)![1]));
    expect(pcts.reduce((a, b) => a + b, 0), 'legend shares must sum to exactly 100').to.equal(100);
    for (const row of legendRows(container)) {
      expect(row.textContent!.match(/%/g)!.length, 'a row states its share once').to.equal(1);
    }
  });
  it("the ring's hole prints the day's calories over a cal unit", () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    expect(container.querySelector('[data-testid="macro-total-calories"]')!.textContent).to.equal('107');
    expect(container.querySelector('[data-testid="macro-total-unit"]')!.textContent).to.equal('cal');
  });

  it('each legend row carries the macro grams beside its share', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    const carbs = container.querySelector('[data-testid="macro-legend-carbs"]')!.textContent!;
    expect(carbs).to.contain('Carbs');
    expect(carbs).to.contain('27 g');
    expect(carbs).to.match(/\d+\s*%/);
  });

  it('the ring, the shares and the grams are one card', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(container, { ...baseVm, state }, noopHandlers);
    expect(container.querySelector('[data-testid="totals-row"]') === null, 'the separate totals block is gone').to.equal(true);
    const summary = chart(container);
    expect(!!summary.querySelector('[data-testid="macro-total-calories"]'), 'ring total is in the card').to.equal(true);
    expect(!!summary.querySelector('[data-testid="macro-legend-carbs"]'), 'legend is in the card').to.equal(true);
  });

  it('stays mounted on a day with nothing logged', () => {
    render(container, { ...baseVm, state: seedTestState() }, noopHandlers);
    expect(chart(container).hidden).to.equal(false);
    expect(container.querySelector('[data-testid="macro-total-calories"]')!.textContent).to.equal('0');
    const protein = container.querySelector('[data-testid="macro-legend-protein"]')!.textContent!;
    expect(protein).to.contain('0 g');
    expect(protein).to.not.match(/%/);
  });
});
