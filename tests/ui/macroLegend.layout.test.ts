import { expect } from '@esm-bundle/chai';
import { legendList, legendRow } from '../../src/ui/legend.js';
import { render } from '../../src/ui/view.js';
import { baseVm, loadStyles, noopHandlers, stateWithEntries as stateWithLogs, TODAY as today } from '../_helpers.js';

describe('macro legend layout', () => {
  let main: HTMLElement;

  before(loadStyles);

  beforeEach(() => {
    main = document.createElement('main');
    document.body.appendChild(main);
  });

  afterEach(() => main.remove());

  // The label's own box can be stretched wide while its text stays left, so
  // the gap that matters is the one after the last glyph.
  function textRight(node: HTMLElement): number {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().right;
  }

  it('starts the figures just past the longest label, not at the far edge of the row', () => {
    const state = stateWithLogs([
      { id: 'e1', date: today, foodId: 'seed-banana', amount: 120, unit: 'g', mealId: 'placeholder', loggedAt: `${today}T10:00:00Z` },
    ]);
    render(main, { ...baseVm, state }, noopHandlers);

    const rows = Array.from(main.querySelectorAll('.macro-legend-row'));
    expect(rows.length).to.be.greaterThan(0);

    const labelEnds = rows.map((row) => textRight(row.querySelector('.macro-legend-label') as HTMLElement));
    const cells = rows.map((row) => Array.from(row.querySelectorAll('.macro-legend-value')) as HTMLElement[]);
    const starts = cells.map(([amount]) => amount!.getBoundingClientRect().left);

    expect(Math.min(...starts) - Math.max(...labelEnds), 'figures are stranded from their labels').to.be.lessThan(16);

    // Figures are right-aligned, so it is the trailing edge of each column
    // that has to agree, one column at a time.
    for (let col = 0; col < cells[0]!.length; col++) {
      const rights = cells.map((row) => row[col]!.getBoundingClientRect().right);
      expect(Math.max(...rights) - Math.min(...rights), `column ${col} must line up`).to.be.lessThan(1);
    }
  });

  it('keeps every swatch in the first column when a row carries no value', () => {
    main.appendChild(legendList('column', {}, [
      legendRow('legend-protein', 'protein', ['40%']),
      legendRow('legend-carbs', 'carbs'),
      legendRow('legend-fat', 'fat', ['27%']),
    ]));

    const swatches = Array.from(main.querySelectorAll('.macro-legend-swatch')) as HTMLElement[];
    const lefts = swatches.map((s) => Math.round(s.getBoundingClientRect().left));

    expect(new Set(lefts).size, 'a valueless row must not shift the rows after it').to.equal(1);
  });
});
