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

// From the plot's baseline (the bottom of the hit column) to the top of the stack.
function stackHeight(container: HTMLElement, start: string): number {
  const hit = container.querySelector(`[data-testid="trend-hit"][data-start="${start}"]`)!;
  return num(hit, 'y') + num(hit, 'height') - Math.min(...bars(container, start).map((r) => num(r, 'y')));
}

function cell(container: HTMLElement, key: string, col: 'grams' | 'cal' | 'pct'): string {
  return container.querySelector(`[data-testid="trend-readout-${key}"] [data-col="${col}"]`)!.textContent!;
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

  it('renders the range toggle with every option and the vm selection active', () => {
    render(container, trendsVm({ trendRange: 'year' }), noopHandlers);
    const range = container.querySelector('[data-testid="trend-range-group"]')!;
    expect(Array.from(range.querySelectorAll('button')).map((b) => b.textContent)).to.deep.equal(['7d', '30d', '90d', '1y']);
    expect(range.querySelector('[data-active="true"]')!.getAttribute('data-value')).to.equal('year');
  });

  it('a range click calls the handler with the option value', () => {
    const picked: string[] = [];
    render(container, trendsVm({}), { ...noopHandlers, onTrendRangeChange: (r) => picked.push(r) });
    (container.querySelector('[data-testid="trend-range-group"] [data-value="week"]') as HTMLButtonElement).click();
    expect(picked).to.deep.equal(['week']);
  });

  it('draws one stacked bar per logged day with a segment per macro in calories, and none for a gap', () => {
    const state = stateWith([entry('a', TODAY, 100, 'seed-chicken'), entry('b', TWO_DAYS_AGO, 100, 'seed-chicken')]);
    render(container, trendsVm({ state, trendRange: 'week' }), noopHandlers);
    expect([...new Set(bars(container).map((r) => r.getAttribute('data-start')))]).to.deep.equal([TWO_DAYS_AGO, TODAY]);

    const segments = bars(container, TODAY);
    expect(segments.map((s) => s.getAttribute('data-key'))).to.deep.equal(MACRO_KEYS);
    const [protein, carbs, fat] = segments as [SVGRectElement, SVGRectElement, SVGRectElement];
    expect(num(carbs, 'height')).to.equal(0);
    expect(num(fat, 'y')).to.be.below(num(protein, 'y'));
    expect(num(protein, 'height') / (num(fat, 'height') + 2)).to.be.closeTo((31 * 4) / (3.6 * 9), 0.05);
    expect((container.querySelector('[data-testid="trend-empty"]') as HTMLElement).hidden).to.equal(true);
  });

  it('stack heights are proportional to macro calories per day', () => {
    const state = stateWith([entry('a', TODAY, 100, 'seed-chicken'), entry('b', TWO_DAYS_AGO, 200, 'seed-chicken')]);
    render(container, trendsVm({ state, trendRange: 'week' }), noopHandlers);
    expect(stackHeight(container, TWO_DAYS_AGO) / stackHeight(container, TODAY)).to.be.closeTo(2, 0.02);
  });

  it('says what the chart shows and names the segments in a legend', () => {
    render(container, trendsVm({ state: stateWith([entry('a', TODAY)]), trendRange: 'week' }), noopHandlers);
    expect(container.querySelector('[data-testid="trend-caption"]')!.textContent).to.equal('Calories per day from protein, carbs and fat');
    const legend = container.querySelector('[data-testid="trend-legend"]') as HTMLElement;
    expect(legend.getAttribute('data-shown')).to.equal('true');
    expect(legend.querySelectorAll('[data-testid^="trend-legend-"]').length).to.equal(MACRO_KEYS.length);
  });

  it('the readout defaults to the newest logged day: weekday, then grams, calories and share per macro, and the day total', () => {
    const state = stateWith([entry('a', TODAY, 100, 'seed-chicken')]);
    render(container, trendsVm({ state, trendRange: 'week' }), noopHandlers);
    expect(heading(container)).to.equal('Sat, May 23');
    expect(cell(container, 'protein', 'grams')).to.equal('31 g');
    expect(cell(container, 'protein', 'cal')).to.equal('124 cal');
    expect(cell(container, 'protein', 'pct')).to.equal('75%');
    expect(cell(container, 'carbs', 'cal')).to.equal('0 cal');
    expect(cell(container, 'fat', 'grams')).to.equal('3.6 g');
    expect(cell(container, 'fat', 'cal')).to.equal('32 cal');
    expect(cell(container, 'fat', 'pct')).to.equal('20%');
    expect(cell(container, 'calories', 'cal')).to.equal('165 cal');
    expect(cell(container, 'calories', 'grams')).to.equal('');
  });

  it('a week readout names the range and the logged-day count', () => {
    const state = stateWith([entry('a', TODAY), entry('b', shiftDate(TODAY, -1))]);
    render(container, trendsVm({ state, trendRange: 'quarter' }), noopHandlers);
    expect(heading(container)).to.equal('May 17 – May 23 · 2 of 7 days logged');
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
    expect(bars(container, TWO_DAYS_AGO).every((r) => r.getAttribute('data-selected') === 'true')).to.equal(true);
    expect(bars(container, TODAY).some((r) => r.hasAttribute('data-selected'))).to.equal(false);
    expect(heading(container)).to.equal('Thu, May 21');
    expect(cell(container, 'calories', 'cal')).to.equal('178 cal');
  });

  it('a selected gap shows its date with dashes', () => {
    const state = stateWith([entry('a', TODAY)]);
    render(container, trendsVm({ state, trendRange: 'week', trendSelected: TWO_DAYS_AGO }), noopHandlers);
    expect(heading(container)).to.equal('Thu, May 21');
    expect(cell(container, 'calories', 'cal')).to.equal('—');
    expect(cell(container, 'protein', 'grams')).to.equal('—');
    expect(cell(container, 'protein', 'pct')).to.equal('—');
  });

  it('an empty range shows the message naming both dates, hides the plot but not the legend strip, and dashes the readout', () => {
    render(container, trendsVm({ state: stateWith([]), trendRange: 'week' }), noopHandlers);
    const empty = container.querySelector('[data-testid="trend-empty"]') as HTMLElement;
    expect(empty.hidden).to.equal(false);
    expect(empty.textContent).to.equal('Nothing logged between May 17 and May 23.');
    expect(container.querySelector('[data-testid="trend-svg"]')!.hasAttribute('hidden')).to.equal(true);
    expect(bars(container).length).to.equal(0);

    const legend = container.querySelector('[data-testid="trend-legend"]') as HTMLElement;
    expect(legend.hidden).to.equal(false);
    expect(legend.getAttribute('data-shown')).to.equal('false');
    expect(heading(container)).to.equal('—');
    expect(cell(container, 'calories', 'cal')).to.equal('—');
  });

  it('x labels number at most six and end on the last bucket; y ticks start at zero and clear the tallest stack', () => {
    const state = stateWith([entry('a', TODAY, 200, 'seed-chicken')]);
    render(container, trendsVm({ state, trendRange: 'month' }), noopHandlers);
    const xLabels = Array.from(container.querySelectorAll('[data-testid="trend-x-label"]')).map((t) => t.textContent);
    expect(xLabels.length).to.be.at.most(6);
    expect(xLabels[xLabels.length - 1]).to.equal('May 23');

    const yTicks = Array.from(container.querySelectorAll('[data-testid="trend-y-label"]')).map((t) => Number(t.textContent));
    expect(yTicks[0]).to.equal(0);
    expect(yTicks[yTicks.length - 1]).to.be.at.least(62 * 4 + 7.2 * 9);
    expect(yTicks.length).to.be.at.most(5);
  });

  it('labels the plot for assistive tech', () => {
    render(container, trendsVm({ state: stateWith([entry('a', TODAY)]), trendRange: 'week' }), noopHandlers);
    const label = container.querySelector('[data-testid="trend-svg"]')!.getAttribute('aria-label')!;
    expect(label).to.contain('Calories per day from protein, carbs and fat');
    expect(label).to.contain('1 logged day');
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
