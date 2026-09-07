import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { State } from '../../src/domain/types.js';
import { baseVm, loadStyles, noopHandlers, seedTestState, TODAY as today, withMealsFromEntries } from '../_helpers.js';

const state: State = withMealsFromEntries({
  ...seedTestState(),
  entries: [
    { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', loggedAt: `${today}T10:00:00Z` },
    { id: 'e2', date: today, foodId: 'seed-chicken', amount: 50, unit: 'g', loggedAt: `${today}T11:00:00Z` },
  ],
});

// seed-egg is a count food, so logging it in grams is the mismatch that puts
// a sentence where the calorie number goes.
const withMismatchedUnit: State = withMealsFromEntries({
  ...seedTestState(),
  entries: [
    { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', loggedAt: `${today}T10:00:00Z` },
    { id: 'e2', date: today, foodId: 'seed-egg', amount: 50, unit: 'g', loggedAt: `${today}T11:00:00Z` },
  ],
});

function nameCells(main: HTMLElement): DOMRect[] {
  return Array.from(main.querySelectorAll('[data-testid="entry-row-name"]'))
    .map((c) => c.getBoundingClientRect());
}

// The page shell from index.html: the stylesheet caps main's width, so the
// rows are as wide here as they are on the live site.
function mountMain(): HTMLElement {
  const main = document.createElement('main');
  document.body.appendChild(main);
  return main;
}

describe('entry row — layout', () => {
  before(loadStyles);

  let main: HTMLElement;

  beforeEach(() => { main = mountMain(); });

  afterEach(() => main.remove());

  it('right-aligns the calorie column across rows with names of different lengths', () => {
    render(main, { ...baseVm, state, today, selectedDate: today }, noopHandlers);

    const cells = Array.from(main.querySelectorAll('[data-testid="entry-row-cal"]'));
    expect(cells.length, 'one calorie cell per entry row').to.equal(2);

    const [banana, chicken] = cells.map((c) => c.getBoundingClientRect());
    expect(chicken!.right, `calorie columns are ${Math.round(banana!.right - chicken!.right)}px apart`)
      .to.be.closeTo(banana!.right, 0.5);
  });

  it('keeps a short name on one line at a phone width when the row carries a mismatched-unit message', () => {
    main.style.width = '320px';
    render(main, { ...baseVm, state: withMismatchedUnit, today, selectedDate: today }, noopHandlers);

    const [banana, egg] = nameCells(main);
    expect(egg!.height, `"Egg 50 g" wraps to ${Math.round(egg!.height / banana!.height)} lines`)
      .to.be.closeTo(banana!.height, 1);
  });
});
