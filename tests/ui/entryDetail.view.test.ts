import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { NUTRIENT_KEYS } from '../../src/domain/types.js';
import type { Entry, State } from '../../src/domain/types.js';
import { baseVm, entryDetail, makeContainer, noopHandlers, seedTestFoods, withMealsFromEntries } from '../_helpers.js';

const TODAY = baseVm.selectedDate;

function stateWithEntry(entry: Entry, foods = seedTestFoods()): State {
  return withMealsFromEntries({ version: 2, foods, meals: [], entries: [entry] });
}

describe('entry detail card rendering', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  const bananaEntry: Entry = {
    id: 'e1', date: TODAY, foodId: 'seed-banana',
    amount: 100, unit: 'g', mealId: '', loggedAt: `${TODAY}T10:00:00Z`,
  };
  const oatsEntry: Entry = {
    id: 'e2', date: TODAY, foodId: 'seed-oats',
    amount: 50, unit: 'g', mealId: '', loggedAt: `${TODAY}T11:00:00Z`,
  };

  it('does not render any detail when expandedEntryId is null', () => {
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: null }, noopHandlers);
    expect(entryDetail(container)).to.equal(null);
  });

  it('renders the detail below the matching row when expandedEntryId matches', () => {
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e1' } }, noopHandlers);
    const card = entryDetail(container, 'e1');
    expect(card).to.exist;
  });

  it('renders one line per NUTRIENT_KEYS entry', () => {
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e1' } }, noopHandlers);
    for (const key of NUTRIENT_KEYS) {
      expect(container.querySelector(`[data-testid="entry-detail-${key}"]`), `missing detail row for ${key}`).to.exist;
    }
  });

  it('labels each line with the nutrient label and the correct unit', () => {
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e1' } }, noopHandlers);
    const cal = container.querySelector('[data-testid="entry-detail-calories"]')!.textContent!;
    expect(cal).to.match(/Calories/);
    expect(cal).to.match(/cal/);
    expect(cal).to.not.match(/ g\b/);
    const protein = container.querySelector('[data-testid="entry-detail-protein"]')!.textContent!;
    expect(protein).to.match(/Protein/);
    expect(protein).to.match(/ g\b/);
  });

  it('shows resolved values for the entry (banana 100g)', () => {
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e1' } }, noopHandlers);
    expect(container.querySelector('[data-testid="entry-detail-calories"]')!.textContent).to.contain('89');
    expect(container.querySelector('[data-testid="entry-detail-protein"]')!.textContent).to.contain('1.1');
    expect(container.querySelector('[data-testid="entry-detail-carbs"]')!.textContent).to.contain('22.8');
    expect(container.querySelector('[data-testid="entry-detail-fat"]')!.textContent).to.contain('0.3');
  });

  it('shows each macro percentage of the entry\'s calories', () => {
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e1' } }, noopHandlers);
    expect(container.querySelector('[data-testid="entry-detail-protein"]')!.textContent).to.match(/5\s*%/);
    expect(container.querySelector('[data-testid="entry-detail-carbs"]')!.textContent).to.match(/102\s*%/);
    expect(container.querySelector('[data-testid="entry-detail-fat"]')!.textContent).to.match(/3\s*%/);
    expect(
      container.querySelector('[data-testid="entry-detail-calories"]')!.textContent,
      'calories line should not have a percentage',
    ).to.not.match(/%/);
  });

  it('omits macro percentages when the entry has zero calories', () => {
    const zeroFood = seedTestFoods().map((f) =>
      f.id === 'seed-banana' ? { ...f, nutritionFacts: { calories: 0, protein: 0, carbs: 0, fat: 0 } } : f);
    const state: State = { version: 2, meals: [], foods: zeroFood, entries: [bananaEntry] };
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e1' } }, noopHandlers);
    expect(container.querySelector('[data-testid="entry-detail-protein"]')!.textContent).to.not.match(/%/);
  });

  it('only one detail card is mounted when expandedEntryId points to a single id', () => {
    const state: State = {
      version: 2, meals: [], foods: seedTestFoods(),
      entries: [bananaEntry, oatsEntry],
    };
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e2' } }, noopHandlers);
    const cards = container.querySelectorAll('[data-testid="entry-detail"]');
    expect(cards.length).to.equal(1);
    expect((cards[0] as HTMLElement).getAttribute('data-entry-id')).to.equal('e2');
  });

  it('detail card appears immediately after its row in document order', () => {
    const state: State = {
      version: 2, meals: [], foods: seedTestFoods(),
      entries: [bananaEntry, oatsEntry],
    };
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e1' } }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    const bananaRow = Array.from(rows).find((r) => r.textContent!.includes('Banana'))! as HTMLElement;
    const card = entryDetail(container, 'e1')!;
    expect(bananaRow.nextElementSibling).to.equal(card);
  });

  it('row sets aria-expanded=false when not expanded, true when expanded', () => {
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: null }, noopHandlers);
    let row = container.querySelector('[data-testid="entry-row"]') as HTMLElement;
    expect(row.getAttribute('aria-expanded')).to.equal('false');

    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e1' } }, noopHandlers);
    row = container.querySelector('[data-testid="entry-row"]') as HTMLElement;
    expect(row.getAttribute('aria-expanded')).to.equal('true');
  });

  it('clicking the row calls onToggleEntry with the entry id', () => {
    let captured = '';
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, {
      ...noopHandlers,
      onToggleEntry: (id) => { captured = id; },
    });
    (container.querySelector('[data-testid="entry-row"]') as HTMLElement).click();
    expect(captured).to.equal('e1');
  });

  it('clicking the delete button does NOT call onToggleEntry', () => {
    let toggled = false;
    let deleted = '';
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, {
      ...noopHandlers,
      onToggleEntry: () => { toggled = true; },
      onDelete: (id) => { deleted = id; },
    });
    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    expect(deleted).to.equal('e1');
    expect(toggled).to.equal(false);
  });

  it('Enter keydown on the delete button does NOT bubble up to toggle the row', () => {
    let toggled = false;
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, {
      ...noopHandlers,
      onToggleEntry: () => { toggled = true; },
    });
    const del = container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement;
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    del.dispatchEvent(ev);
    expect(toggled, 'row toggle should NOT fire from a keydown that originated on the delete button').to.equal(false);
    expect(ev.defaultPrevented, 'row keydown handler should not preventDefault on a delete-button event').to.equal(false);
  });
  it('does not expand a row whose entry has invalid units', () => {
    const foods = seedTestFoods().map((f) =>
      f.id === 'seed-banana' ? { ...f, servingUnit: 'count' as const, servingSize: 1 } : f);
    const state: State = { version: 2, meals: [], foods, entries: [bananaEntry] };
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e1' } }, noopHandlers);
    expect(entryDetail(container)).to.equal(null);
    const row = container.querySelector('[data-testid="entry-row"]') as HTMLElement;
    expect(row.getAttribute('aria-expanded')).to.equal(null);
  });

  it('clicking an invalid row does NOT call onToggleEntry', () => {
    let toggled = false;
    const foods = seedTestFoods().map((f) =>
      f.id === 'seed-banana' ? { ...f, servingUnit: 'count' as const, servingSize: 1 } : f);
    const state: State = { version: 2, meals: [], foods, entries: [bananaEntry] };
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, {
      ...noopHandlers,
      onToggleEntry: () => { toggled = true; },
    });
    const row = container.querySelector('[data-testid="entry-row"]') as HTMLElement;
    row.click();
    expect(toggled).to.equal(false);
    expect(row.hasAttribute('role'), 'invalid row should not advertise role=button').to.equal(false);
  });

  it('renders the card for soft-deleted foods using stored nutrition', () => {
    const foods = seedTestFoods().map((f) =>
      f.id === 'seed-banana' ? { ...f, deletedAt: `${TODAY}T08:00:00Z` } : f);
    const state: State = { version: 2, meals: [], foods, entries: [bananaEntry] };
    render(container, { ...baseVm, state: withMealsFromEntries(state), expandedDetail: { kind: 'entry', id: 'e1' } }, noopHandlers);
    expect(entryDetail(container, 'e1')).to.exist;
    expect(container.querySelector('[data-testid="entry-detail-calories"]')!.textContent).to.contain('89');
  });

  it('keyboard Enter on the row calls onToggleEntry', () => {
    let captured = '';
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, {
      ...noopHandlers,
      onToggleEntry: (id) => { captured = id; },
    });
    const row = container.querySelector('[data-testid="entry-row"]') as HTMLElement;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(captured).to.equal('e1');
  });

  it('keyboard Space on the row calls onToggleEntry', () => {
    let captured = '';
    const state = stateWithEntry(bananaEntry);
    render(container, { ...baseVm, state: withMealsFromEntries(state) }, {
      ...noopHandlers,
      onToggleEntry: (id) => { captured = id; },
    });
    const row = container.querySelector('[data-testid="entry-row"]') as HTMLElement;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(captured).to.equal('e1');
  });
});
