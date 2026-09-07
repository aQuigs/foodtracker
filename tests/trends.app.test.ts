import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { shiftDate } from '../src/domain/date.js';
import { MACRO_KEYS } from '../src/domain/types.js';
import { activeValue, clickLogTab, clickTrendsTab, fixedClock, logFood, makeContainer, pickValue, readoutHeading as heading, seededRepo, selectBucket, TODAY } from './_helpers.js';

const RANGE = 'trend-range-group';

function activeRange(container: HTMLElement): string | null {
  return activeValue(container, RANGE);
}

function pickRange(container: HTMLElement, value: string): void {
  pickValue(container, RANGE, value);
}

describe('trends — through the composition root', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('opens on 30 days with today\'s log as the newest stack', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logFood(container);
    clickTrendsTab(container);

    expect(activeRange(container)).to.equal('month');
    expect(container.querySelectorAll(`[data-testid="trend-bar"][data-start="${TODAY}"]`).length).to.equal(MACRO_KEYS.length);
    expect(heading(container)).to.equal('Sat, May 23');
  });

  it('the range toggle repaints the chart', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logFood(container);
    clickTrendsTab(container);

    pickRange(container, 'week');
    expect(activeRange(container)).to.equal('week');
    expect(container.querySelectorAll('[data-testid="trend-hit"]').length).to.equal(7);
  });

  it('selecting a column drives the readout; a range change resets the selection', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logFood(container);
    clickTrendsTab(container);
    pickRange(container, 'week');

    selectBucket(container, shiftDate(TODAY, -1));
    expect(heading(container)).to.equal('Fri, May 22');

    pickRange(container, 'month');
    expect(heading(container)).to.equal('Sat, May 23');
  });

  it('a tab round-trip restores the default range', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logFood(container);
    clickTrendsTab(container);
    pickRange(container, 'year');

    clickLogTab(container);
    clickTrendsTab(container);
    expect(activeRange(container)).to.equal('month');
  });

  it('shows the empty state when nothing is logged', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickTrendsTab(container);
    const empty = container.querySelector('[data-testid="trend-empty"]') as HTMLElement;
    expect(empty.hidden).to.equal(false);
    expect(empty.textContent).to.contain('Nothing logged between');
  });
});
