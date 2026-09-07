import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { baseVm, loadStyles, noopHandlers, stateWithEntries as stateWithLogs, TODAY as today } from '../_helpers.js';

describe('macro legend layout', () => {
  let main: HTMLElement;

  before(loadStyles);

  beforeEach(() => {
    main = document.createElement('main');
    document.body.appendChild(main);
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(main, { ...baseVm, state }, noopHandlers);
  });

  afterEach(() => main.remove());

  // The label's own box can be stretched wide while its text stays left, so
  // the gap that matters is the one after the last glyph.
  function textRight(node: HTMLElement): number {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().right;
  }

  it('starts the share column just past the longest label, not at the far edge of the row', () => {
    const rows = Array.from(main.querySelectorAll('.macro-legend-row'));
    expect(rows.length).to.be.greaterThan(0);

    const labelEnds = rows.map((row) => textRight(row.querySelector('.macro-legend-label') as HTMLElement));
    const valueStarts = rows.map((row) => (row.querySelector('.macro-legend-value') as HTMLElement).getBoundingClientRect().left);

    expect(Math.min(...valueStarts) - Math.max(...labelEnds), 'shares are stranded from their labels').to.be.lessThan(16);
    expect(Math.max(...valueStarts) - Math.min(...valueStarts), 'shares must line up in one column').to.be.lessThan(1);
  });
});
