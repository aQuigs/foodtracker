import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { shiftDate } from '../src/domain/date.js';
import { clickLog, clickLogTab, clickTrendsTab, fixedClock, makeContainer, pickFood, readoutHeading as heading, seededRepo, setAmount, TODAY } from './_helpers.js';

function activeValue(container: HTMLElement, group: string): string | null {
  return container.querySelector(`[data-testid="${group}"] [data-active="true"]`)?.getAttribute('data-value') ?? null;
}

function pick(container: HTMLElement, group: string, value: string): void {
  (container.querySelector(`[data-testid="${group}"] [data-value="${value}"]`) as HTMLButtonElement).click();
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

  it('opens on Calories over 30 days with today\'s log as the newest bar', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logBananaToday(container);
    clickTrendsTab(container);

    expect(activeValue(container, 'trend-metric-group')).to.equal('calories');
    expect(activeValue(container, 'trend-range-group')).to.equal('month');
    expect(container.querySelectorAll(`[data-testid="trend-bar"][data-start="${TODAY}"]`).length).to.equal(1);
    expect(heading(container)).to.equal('Sat, May 23');
  });

  it('range and metric toggles repaint the chart', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logBananaToday(container);
    clickTrendsTab(container);

    pick(container, 'trend-range-group', 'week');
    expect(activeValue(container, 'trend-range-group')).to.equal('week');
    expect(container.querySelectorAll('[data-testid="trend-hit"]').length).to.equal(7);

    pick(container, 'trend-metric-group', 'macros');
    expect(activeValue(container, 'trend-metric-group')).to.equal('macros');
    expect(container.querySelectorAll(`[data-testid="trend-bar"][data-start="${TODAY}"]`).length).to.equal(3);
  });

  it('selecting a column drives the readout; a metric or range change resets the selection', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logBananaToday(container);
    clickTrendsTab(container);
    pick(container, 'trend-range-group', 'week');

    const yesterday = shiftDate(TODAY, -1);
    selectBucket(container, yesterday);
    expect(heading(container)).to.equal('Fri, May 22');

    pick(container, 'trend-metric-group', 'macros');
    expect(heading(container)).to.equal('Sat, May 23');

    selectBucket(container, yesterday);
    pick(container, 'trend-range-group', 'month');
    expect(heading(container)).to.equal('Sat, May 23');
  });

  it('a tab round-trip restores the defaults', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    logBananaToday(container);
    clickTrendsTab(container);
    pick(container, 'trend-range-group', 'year');
    pick(container, 'trend-metric-group', 'macros');

    clickLogTab(container);
    clickTrendsTab(container);
    expect(activeValue(container, 'trend-range-group')).to.equal('month');
    expect(activeValue(container, 'trend-metric-group')).to.equal('calories');
  });

  it('shows the empty state when nothing is logged', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickTrendsTab(container);
    const empty = container.querySelector('[data-testid="trend-empty"]') as HTMLElement;
    expect(empty.hidden).to.equal(false);
    expect(empty.textContent).to.contain('Nothing logged between');
  });
});
