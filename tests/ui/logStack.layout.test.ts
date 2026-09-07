import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { State } from '../../src/domain/types.js';
import { baseVm, loadStyles, makeContainer, noopHandlers, seedTestState, TODAY as today, withMealsFromEntries } from '../_helpers.js';

const stateWithBanana: State = {
  ...seedTestState(),
  entries: [
    { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', loggedAt: `${today}T10:00:00Z` },
  ],
};

function gapBelow(above: Element, below: Element): number {
  return below.getBoundingClientRect().top - above.getBoundingClientRect().bottom;
}

describe('log view stack spacing', () => {
  before(loadStyles);

  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('separates the day summary from the entry list', () => {
    render(container, { ...baseVm, state: withMealsFromEntries(stateWithBanana), today, selectedDate: today }, noopHandlers);
    const summary = container.querySelector('[data-testid="day-summary"]')!;
    const entryList = container.querySelector('[data-testid="entry-list"]')!;

    expect(gapBelow(summary, entryList)).to.be.greaterThan(8);
  });
});
