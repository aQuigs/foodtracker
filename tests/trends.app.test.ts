import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { shiftDate } from '../src/domain/date.js';
import { MACRO_KEYS } from '../src/domain/types.js';
import { clickLog, clickLogTab, clickTrendsTab, fixedClock, makeContainer, pickFood, readoutHeading as heading, seededRepo, setAmount, TODAY } from './_helpers.js';

function activeRange(container: HTMLElement): string | null {
  return container.querySelector('[data-testid="trend-range-group"] [data-active="true"]')?.getAttribute('data-value') ?? null;
}

function pickRange(container: HTMLElement, value: string): void {
  (container.querySelector(`[data-testid="trend-range-group"] [data-value="${value}"]`) as HTMLButtonElement).click();
}

function selectBucket(container: HTMLElement, start: string): void {
  (container.querySelector(`[data-testid="trend-hit"][data-start="${start}"]`) as SVGRectElement).dispatchEvent(new MouseEvent('click'));
}

function logBananaToday(container: HTMLElement): void {
  pickFood(container, 'Banana');
  setAmount(container, '120');
  clickLog(container);
}

describe('trends — through the composition root', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('opens on 30 days with today\'s log as the newest stack', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logBananaToday(container);
    clickTrendsTab(container);

    expect(activeRange(container)).to.equal('month');
    expect(container.querySelectorAll(`[data-testid="trend-bar"][data-start="${TODAY}"]`).length).to.equal(MACRO_KEYS.length);
    expect(heading(container)).to.equal('Sat, May 23');
  });

  it('the range toggle repaints the chart', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logBananaToday(container);
    clickTrendsTab(container);

    pickRange(container, 'week');
    expect(activeRange(container)).to.equal('week');
    expect(container.querySelectorAll('[data-testid="trend-hit"]').length).to.equal(7);
  });

  it('selecting a column drives the readout; a range change resets the selection', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logBananaToday(container);
    clickTrendsTab(container);
    pickRange(container, 'week');

    selectBucket(container, shiftDate(TODAY, -1));
    expect(heading(container)).to.equal('Fri, May 22');

    pickRange(container, 'month');
    expect(heading(container)).to.equal('Sat, May 23');
  });

  it('a tab round-trip restores the default range', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logBananaToday(container);
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
