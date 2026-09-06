import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { ViewModel } from '../../src/ui/view.js';
import { MACRO_KEYS } from '../../src/domain/types.js';
import { shiftDate } from '../../src/domain/date.js';
import { baseVm, entryOn as entry, makeContainer, noopHandlers, readoutHeading as heading, stateWithEntries as stateWith, TODAY } from '../_helpers.js';

function trendsVm(over: Partial<ViewModel>): ViewModel {
  return { ...baseVm, view: 'trends', ...over };
}

function bars(container: HTMLElement, start?: string): SVGRectElement[] {
  const sel = start === undefined ? '[data-testid="trend-bar"]' : `[data-testid="trend-bar"][data-start="${start}"]`;
  return Array.from(container.querySelectorAll<SVGRectElement>(sel));
}

function num(el: Element, attr: string): number {
  return Number(el.getAttribute(attr));
}

function readoutValue(container: HTMLElement, key: string): string {
  return container.querySelector(`[data-testid="trend-readout-${key}"] .detail-value`)!.textContent!;
}

const TWO_DAYS_AGO = shiftDate(TODAY, -2);

describe('trends view', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('has a Trends tab that is active on the trends view', () => {
    render(container, trendsVm({}), noopHandlers);
    expect(container.querySelector('[data-testid="view-toggle-trends"]')!.getAttribute('data-active')).to.equal('true');
    expect(container.querySelectorAll('[data-view="trends"]').length).to.equal(1);
    expect(container.querySelectorAll('[data-view="log"]').length).to.equal(0);
  });

  it('renders both toggles with every option and the vm selection active', () => {
    render(container, trendsVm({ trendMetric: 'macros', trendRange: 'year' }), noopHandlers);
    const metric = container.querySelector('[data-testid="trend-metric-group"]')!;
    expect(Array.from(metric.querySelectorAll('button')).map((b) => b.getAttribute('data-value'))).to.deep.equal(['calories', 'macros']);
    expect(metric.querySelector('[data-active="true"]')!.getAttribute('data-value')).to.equal('macros');

    const range = container.querySelector('[data-testid="trend-range-group"]')!;
    expect(Array.from(range.querySelectorAll('button')).map((b) => b.textContent)).to.deep.equal(['7d', '30d', '90d', '1y']);
    expect(range.querySelector('[data-active="true"]')!.getAttribute('data-value')).to.equal('year');
  });

  it('toggle clicks call the handlers with the option value', () => {
    const picked: string[] = [];
    render(container, trendsVm({}), {
      ...noopHandlers,
      onTrendMetricChange: (m) => picked.push(m),
      onTrendRangeChange: (r) => picked.push(r),
    });
    (container.querySelector('[data-testid="trend-metric-group"] [data-value="macros"]') as HTMLButtonElement).click();
    (container.querySelector('[data-testid="trend-range-group"] [data-value="week"]') as HTMLButtonElement).click();
    expect(picked).to.deep.equal(['macros', 'week']);
  });

  it('calories mode draws one bar per logged day and none for a gap', () => {
    const state = stateWith([entry('a', TODAY, 100), entry('b', TWO_DAYS_AGO, 200)]);
    render(container, trendsVm({ state, trendRange: 'week' }), noopHandlers);
    const rects = bars(container);
    expect(rects.map((r) => r.getAttribute('data-start'))).to.deep.equal([TWO_DAYS_AGO, TODAY]);
    expect(rects.every((r) => r.getAttribute('data-key') === 'calories')).to.equal(true);
    expect((container.querySelector('[data-testid="trend-empty"]') as HTMLElement).hidden).to.equal(true);
  });

  it('bar heights are proportional to calories per day', () => {
    const state = stateWith([entry('a', TODAY, 100), entry('b', TWO_DAYS_AGO, 200)]);
    render(container, trendsVm({ state, trendRange: 'week' }), noopHandlers);
    expect(num(bars(container, TWO_DAYS_AGO)[0]!, 'height') / num(bars(container, TODAY)[0]!, 'height')).to.be.closeTo(2, 0.01);
  });

  it('draws the trailing-average line for day ranges only', () => {
    const state = stateWith([entry('a', TODAY)]);
    for (const [range, expected] of [['week', 1], ['month', 1], ['quarter', 0], ['year', 0]] as const) {
      render(container, trendsVm({ state, trendRange: range }), noopHandlers);
      expect(container.querySelectorAll('[data-testid="trend-avg-line"]').length, range).to.equal(expected);
    }
  });

  it('macros mode stacks one segment per macro in calories, bottom to top, with a legend', () => {
    const state = stateWith([entry('a', TODAY, 100, 'seed-chicken')]);
    render(container, trendsVm({ state, trendRange: 'week', trendMetric: 'macros' }), noopHandlers);

    const segments = bars(container, TODAY);
    expect(segments.map((s) => s.getAttribute('data-key'))).to.deep.equal(MACRO_KEYS);
    const [protein, carbs, fat] = segments as [SVGRectElement, SVGRectElement, SVGRectElement];
    expect(num(carbs, 'height')).to.equal(0);
    expect(num(fat, 'y')).to.be.below(num(protein, 'y'));
    expect(num(protein, 'height') / (num(fat, 'height') + 2)).to.be.closeTo((31 * 4) / (3.6 * 9), 0.05);

    const legend = container.querySelector('[data-testid="trend-legend"]') as HTMLElement;
    expect(legend.getAttribute('data-shown')).to.equal('true');
    expect(legend.querySelectorAll('[data-testid^="trend-legend-"]').length).to.equal(MACRO_KEYS.length);
  });

  it('calories mode hides the legend without removing it, so the card is one box in both metrics', () => {
    const state = stateWith([entry('a', TODAY)]);
    for (const [metric, shown] of [['calories', 'false'], ['macros', 'true']] as const) {
      render(container, trendsVm({ state, trendRange: 'week', trendMetric: metric }), noopHandlers);
      const legend = container.querySelector('[data-testid="trend-legend"]') as HTMLElement;
      expect(legend.getAttribute('data-shown'), metric).to.equal(shown);
      expect(legend.hidden, metric).to.equal(false);
      expect(legend.querySelectorAll('[data-testid^="trend-legend-"]').length, metric).to.equal(MACRO_KEYS.length);
    }
  });

  it('the readout defaults to the newest logged day: weekday, calories, grams with calories, trailing average', () => {
    const state = stateWith([entry('a', TODAY, 100, 'seed-chicken')]);
    render(container, trendsVm({ state, trendRange: 'week' }), noopHandlers);
    expect(heading(container)).to.equal('Sat, May 23');
    expect(readoutValue(container, 'calories')).to.equal('165 cal');
    expect(readoutValue(container, 'protein')).to.equal('31 g (124 cal)');
    expect(readoutValue(container, 'carbs')).to.equal('0 g (0 cal)');
    expect(readoutValue(container, 'fat')).to.equal('3.6 g (32 cal)');
    expect(readoutValue(container, 'average')).to.equal('165 cal');
  });

  it('a week readout names the range and the logged-day count, with no average row', () => {
    const state = stateWith([entry('a', TODAY), entry('b', shiftDate(TODAY, -1))]);
    render(container, trendsVm({ state, trendRange: 'quarter' }), noopHandlers);
    expect(heading(container)).to.equal('May 17 – May 23 · 2 of 7 days logged');
    expect(container.querySelectorAll('[data-testid="trend-readout-average"]').length).to.equal(0);
  });

  it('clicking a hit column reports that bucket', () => {
    const picked: string[] = [];
    const state = stateWith([entry('a', TODAY)]);
    render(container, trendsVm({ state, trendRange: 'week' }), { ...noopHandlers, onTrendSelect: (s) => picked.push(s) });
    const target = shiftDate(TODAY, -3);
    (container.querySelector(`[data-testid="trend-hit"][data-start="${target}"]`) as SVGRectElement).dispatchEvent(new MouseEvent('click'));
    expect(picked).to.deep.equal([target]);
  });

  it('a selected bucket is marked and drives the readout', () => {
    const state = stateWith([entry('a', TODAY, 100), entry('b', TWO_DAYS_AGO, 200)]);
    render(container, trendsVm({ state, trendRange: 'week', trendSelected: TWO_DAYS_AGO }), noopHandlers);
    expect(bars(container, TWO_DAYS_AGO)[0]!.getAttribute('data-selected')).to.equal('true');
    expect(bars(container, TODAY)[0]!.hasAttribute('data-selected')).to.equal(false);
    expect(heading(container)).to.equal('Thu, May 21');
    expect(readoutValue(container, 'calories')).to.equal('178 cal');
  });

  it('a selected gap shows its date with dashes', () => {
    const state = stateWith([entry('a', TODAY)]);
    render(container, trendsVm({ state, trendRange: 'week', trendSelected: TWO_DAYS_AGO }), noopHandlers);
    expect(heading(container)).to.equal('Thu, May 21');
    expect(readoutValue(container, 'calories')).to.equal('—');
    expect(readoutValue(container, 'average')).to.equal('—');
  });

  it('an empty range shows the message naming both dates, hides the plot, and dashes the readout', () => {
    render(container, trendsVm({ state: stateWith([]), trendRange: 'week' }), noopHandlers);
    const empty = container.querySelector('[data-testid="trend-empty"]') as HTMLElement;
    expect(empty.hidden).to.equal(false);
    expect(empty.textContent).to.equal('Nothing logged between May 17 and May 23.');
    expect(container.querySelector('[data-testid="trend-svg"]')!.hasAttribute('hidden')).to.equal(true);
    expect(bars(container).length).to.equal(0);
    expect(heading(container)).to.equal('—');
    expect(readoutValue(container, 'calories')).to.equal('—');
  });

  it('x labels number at most six and end on the last bucket; y ticks start at zero and clear the tallest bar', () => {
    const state = stateWith([entry('a', TODAY, 200)]);
    render(container, trendsVm({ state, trendRange: 'month' }), noopHandlers);
    const xLabels = Array.from(container.querySelectorAll('[data-testid="trend-x-label"]')).map((t) => t.textContent);
    expect(xLabels.length).to.be.at.most(6);
    expect(xLabels[xLabels.length - 1]).to.equal('May 23');

    const yTicks = Array.from(container.querySelectorAll('[data-testid="trend-y-label"]')).map((t) => Number(t.textContent));
    expect(yTicks[0]).to.equal(0);
    expect(yTicks[yTicks.length - 1]).to.be.at.least(178);
    expect(yTicks.length).to.be.at.most(5);
  });

  it('labels the plot for assistive tech', () => {
    render(container, trendsVm({ state: stateWith([entry('a', TODAY)]), trendRange: 'week' }), noopHandlers);
    const label = container.querySelector('[data-testid="trend-svg"]')!.getAttribute('aria-label')!;
    expect(label).to.contain('Calories per day');
    expect(label).to.contain('1 logged day, average 89 cal');
  });

  it('redraws at the new width when the card resizes, without another render', async () => {
    container.style.width = '600px';
    render(container, trendsVm({ state: stateWith([entry('a', TODAY)]), trendRange: 'week' }), noopHandlers);
    const plot = container.querySelector('[data-testid="trend-svg"]')!;
    const before = Number(plot.getAttribute('viewBox')!.split(' ')[2]);

    container.style.width = '300px';
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = Number(plot.getAttribute('viewBox')!.split(' ')[2]);
    expect(after).to.be.below(before);
    expect(after).to.equal(plot.clientWidth);
  });
});
