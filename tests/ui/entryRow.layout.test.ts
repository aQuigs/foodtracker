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

// body's 2rem padding leaves main this wide on the narrowest phone we support.
const PHONE_MAIN_WIDTH = '256px';

// The browser's largest text setting, which is what forces the name column to
// wrap on a phone.
const ZOOMED_TEXT = '32px';

// The gap between an entry row's columns, from .entries li[data-testid="entry-row"].
const ROW_GAP = 8;

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

    const cal = Array.from(main.querySelectorAll('[data-testid="entry-row-cal"]'))
      .map((c) => c.getBoundingClientRect());
    expect(cal.length, 'one calorie cell per entry row').to.equal(2);

    const [banana, chicken] = cal;
    expect(chicken!.right, `calorie columns are ${Math.round(banana!.right - chicken!.right)}px apart`)
      .to.be.closeTo(banana!.right, 0.5);
  });

  // The name is free to wrap, but an amount that breaks leaves its unit
  // stranded on the next line with the calorie column sitting between the
  // unit and the figure it belongs to.
  it('keeps an amount whole when the name column has to wrap', () => {
    main.style.width = PHONE_MAIN_WIDTH;
    main.style.fontSize = ZOOMED_TEXT;
    render(main, { ...baseVm, state, today, selectedDate: today }, noopHandlers);

    const amounts = Array.from(main.querySelectorAll('[data-testid="entry-row-amount"]'));
    expect(amounts.length, 'one amount per entry row').to.equal(2);

    for (const amount of amounts) {
      expect(amount.getClientRects().length, `"${amount.textContent}" broke across lines`).to.equal(1);
    }
  });

  // The message is a sentence, not a number, so it needs the row's full width
  // whatever the food is called — there is no column for it to line up with.
  it('gives a mismatched-unit row its whole width instead of a calorie column', () => {
    main.style.width = PHONE_MAIN_WIDTH;
    render(main, { ...baseVm, state: withMismatchedUnit, today, selectedDate: today }, noopHandlers);

    const row = main.querySelectorAll('[data-testid="entry-row"]')[1]!;
    expect(row.querySelectorAll('[data-testid="entry-row-cal"]').length, 'no calorie column on an unusable row')
      .to.equal(0);

    const text = row.querySelector('[data-testid="entry-row-name"]')!.getBoundingClientRect();
    const del = row.querySelector('[data-testid="delete-button"]')!.getBoundingClientRect();
    expect(del.left - text.right, 'the message runs on up to the delete button').to.be.closeTo(ROW_GAP, 1);
  });

  it('paints every part of a mismatched-unit row in the error colour', () => {
    render(main, { ...baseVm, state: withMismatchedUnit, today, selectedDate: today }, noopHandlers);

    const row = main.querySelectorAll('[data-testid="entry-row"]')[1]!;
    const amount = row.querySelector('[data-testid="entry-row-amount"]')!;
    expect(getComputedStyle(amount).color, 'the amount reads as part of the error, not muted')
      .to.equal(getComputedStyle(row).color);
  });
});
