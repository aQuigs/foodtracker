import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { Entry, Meal, State } from '../../src/domain/types.js';
import { baseVm, makeContainer, noopHandlers, TODAY } from '../_helpers.js';

function mealHeaders(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="meal-header"]')) as HTMLElement[];
}

function mealHeaderLabel(header: HTMLElement): string {
  const labelEl = header.querySelector('[data-testid="meal-header-label"]');
  return labelEl ? labelEl.textContent!.trim() : '';
}

function mealHeaderTotal(header: HTMLElement): string {
  const totalEl = header.querySelector('[data-testid="meal-header-total"]');
  return totalEl ? totalEl.textContent!.trim() : '';
}

function newMealBtn(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-testid="new-meal-button"]') as HTMLButtonElement;
}

const bananaEntry = (overrides: Partial<Entry> = {}): Entry => ({
  id: 'e1', date: TODAY, foodId: 'seed-banana',
  amount: 100, unit: 'g', mealId: 'm1', loggedAt: `${TODAY}T10:00:00Z`,
  ...overrides,
});

const meal = (id: string, position: number, date = TODAY): Meal => ({ id, date, position });

describe('meals rendering — log view', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders a placeholder "Meal 1" header on a fresh day with no meals or entries', () => {
    render(container, baseVm, noopHandlers);
    const headers = mealHeaders(container);
    expect(headers).to.have.lengthOf(1);
    expect(mealHeaderLabel(headers[0]!)).to.equal('Meal 1');
  });

  it('renders the New meal button below the entry list, always enabled', () => {
    render(container, baseVm, noopHandlers);
    const btn = newMealBtn(container);
    expect(btn).to.exist;
    expect(btn.disabled).to.equal(false);
  });

  it('renders meal headers in reverse-position order (latest first)', () => {
    const meals = [meal('m1', 0), meal('m2', 1), meal('m3', 2)];
    const entries = [
      bananaEntry({ id: 'e1', mealId: 'm1' }),
      bananaEntry({ id: 'e2', mealId: 'm2' }),
      bananaEntry({ id: 'e3', mealId: 'm3' }),
    ];
    const state: State = { ...freshState(), meals, entries };
    render(container, { ...baseVm, state }, noopHandlers);
    const labels = mealHeaders(container).map(mealHeaderLabel);
    expect(labels).to.deep.equal(['Meal 3', 'Meal 2', 'Meal 1']);
  });

  it('renders entries grouped under their meals in reverse-position order, with the New meal button on top', () => {
    const meals = [meal('m1', 0), meal('m2', 1)];
    const entries = [
      bananaEntry({ id: 'eA', mealId: 'm1' }),
      bananaEntry({ id: 'eB', mealId: 'm2', foodId: 'seed-oats' }),
      bananaEntry({ id: 'eC', mealId: 'm1', foodId: 'seed-egg', unit: 'count', amount: 2 }),
    ];
    const state: State = { ...freshState(), meals, entries };
    render(container, { ...baseVm, state }, noopHandlers);

    const list = container.querySelector('[data-testid="entry-list"]') as HTMLElement;
    const children = Array.from(list.children) as HTMLElement[];
    const labels = children.map((c) => c.getAttribute('data-testid'));
    const expectedOrder = ['new-meal-button-row', 'meal-header', 'entry-row', 'meal-header', 'entry-row', 'entry-row'];
    expect(labels).to.deep.equal(expectedOrder);
  });

  it('per-meal header shows calories + protein + carbs + fat for entries in that meal', () => {
    const meals = [meal('m1', 0)];
    const entries = [bananaEntry({ mealId: 'm1', amount: 100 })];
    const state: State = { ...freshState(), meals, entries };
    render(container, { ...baseVm, state }, noopHandlers);

    const total = mealHeaderTotal(mealHeaders(container)[0]!);
    expect(total).to.contain('89');
    expect(total).to.match(/1\.1/);
    expect(total).to.match(/22\.8|22\.\d/);
    expect(total).to.match(/0\.3/);
  });

  it('hides non-latest empty meal headers, keeps the latest empty meal header visible (latest first)', () => {
    const meals = [meal('m1', 0), meal('m2', 1)];
    const entries = [bananaEntry({ id: 'e1', mealId: 'm1' })];
    const state: State = { ...freshState(), meals, entries };
    render(container, { ...baseVm, state }, noopHandlers);
    const labels = mealHeaders(container).map(mealHeaderLabel);
    expect(labels).to.deep.equal(['Meal 2', 'Meal 1']);
  });

  it('omits meals from other dates', () => {
    const meals = [meal('m1', 0, TODAY), meal('mX', 0, '2026-05-22')];
    const entries = [bananaEntry({ id: 'e1', mealId: 'm1' })];
    const state: State = { ...freshState(), meals, entries };
    render(container, { ...baseVm, state }, noopHandlers);
    const headers = mealHeaders(container);
    expect(headers).to.have.lengthOf(1);
    expect(mealHeaderLabel(headers[0]!)).to.equal('Meal 1');
  });

  it('clicking New meal calls onNewMeal with the selected date', () => {
    let captured = '';
    render(container, baseVm, { ...noopHandlers, onNewMeal: (d) => { captured = d; } });
    newMealBtn(container).click();
    expect(captured).to.equal(TODAY);
  });

  it('shows the day total row at the bottom of the form area (after the entry list)', () => {
    render(container, baseVm, noopHandlers);
    const totalsRow = container.querySelector('[data-testid="totals-row"]');
    expect(totalsRow).to.exist;
  });
});
