import { CALORIE_KEYS, MACRO_KEYS, NUTRIENTS, macroPctOfCalories, nutrientCalories } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';
import type { TrendBucket, TrendSeries } from '../domain/trends.js';
import { el } from './dom.js';
import { svg } from './svg.js';
import { legendList, legendRow } from './legend.js';
import { formatIsoDate, formatNutrient, roundedCalories, roundedPct } from './format.js';

export type TrendChartProps = {
  series: TrendSeries;
  // A bucket start; null selects the newest bucket with data.
  selected: string | null;
  onSelect: (start: string) => void;
};

export type TrendChart = { node: HTMLElement; render(props: TrendChartProps): void };

// Geometry in CSS pixels at a 16px root font. HEIGHT is also the plot slot's
// CSS height (12.5rem), so the measured height over it is the root font scale.
const HEIGHT = 200;
const PAD = { top: 10, right: 20, bottom: 22, left: 44 };
const BAR_GAP = 2;
const SEGMENT_GAP = 2;
const MAX_X_LABELS = 6;
const X_LABEL_SPACE = 56;
const MAX_TICK_INTERVALS = 4;
const TICK_MANTISSAS = [1, 2, 2.5, 5];
const MIN_TICK_STEP = 50;
const FALLBACK_WIDTH = 320;

const READOUT_COLS = ['grams', 'cal', 'pct'] as const;
type ReadoutCells = Record<(typeof READOUT_COLS)[number], string>;
const DASHES: ReadoutCells = { grams: '—', cal: '—', pct: '—' };

function listOf(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const CAPTION = `Calories per day from ${listOf(MACRO_KEYS.map((k) => NUTRIENTS[k].label.toLowerCase()))}`;

function shortDate(iso: string): string {
  return formatIsoDate(iso, { month: 'short', day: 'numeric' });
}

function weekdayDate(iso: string): string {
  return formatIsoDate(iso, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Ticks from zero in a round step, at most four intervals, reaching the
// tallest value. The step is a 1 / 2 / 2.5 / 5 multiple of whatever decade
// the peak needs, so one mistyped amount cannot flood the axis.
export function niceTicks(max: number): number[] {
  const peak = Number.isFinite(max) && max > 0 ? max : 0;
  const raw = Math.max(MIN_TICK_STEP, peak / MAX_TICK_INTERVALS);
  const decade = 10 ** Math.floor(Math.log10(raw));
  const step = TICK_MANTISSAS.map((m) => m * decade).find((s) => s >= raw) ?? decade * 10;
  const top = Math.max(step, Math.ceil(peak / step) * step);
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) {
    out.push(v);
  }

  return out;
}

export type ChartLayout = {
  scale: number;
  pad: typeof PAD;
  plotW: number;
  plotH: number;
  slot: number;
  labelEvery: number;
};

// The axis chrome scales with the text but may never claim more than half
// the width: past that the plot would invert and the series draw backwards.
// So on a narrow box with large text the chrome, and the axis text in it,
// shrink below the user's text size; the plot keeps its width and the
// labels pay for it.
export function chartLayout(width: number, height: number, buckets: number): ChartLayout {
  const scale = Math.min(height / HEIGHT, width / (2 * (PAD.left + PAD.right)));
  const pad = { top: PAD.top * scale, right: PAD.right * scale, bottom: PAD.bottom * scale, left: PAD.left * scale };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const labelSlots = Math.min(MAX_X_LABELS, Math.max(1, Math.floor(plotW / (X_LABEL_SPACE * scale))));

  return { scale, pad, plotW, plotH, slot: plotW / buckets, labelEvery: Math.ceil(buckets / labelSlots) };
}

function px(v: number): string {
  return v.toFixed(2);
}

function selectedIndex(buckets: TrendBucket[], selected: string | null): number {
  const i = buckets.findIndex((b) => b.start === selected);
  return i >= 0 ? i : buckets.map((b) => b.perDay !== null).lastIndexOf(true);
}

function macroCells(k: keyof NutritionFacts, perDay: NutritionFacts, pcts: Partial<Record<keyof NutritionFacts, number>>): ReadoutCells {
  const share = pcts[k];
  return {
    grams: formatNutrient(k, perDay[k]),
    cal: roundedCalories(nutrientCalories(k, perDay)),
    pct: share === undefined ? '—' : roundedPct(share),
  };
}

function readoutRow(testid: string, cls: string, label: string, cells: ReadoutCells): HTMLElement {
  return el('tr', { 'data-testid': testid, class: cls }, [
    el('th', { scope: 'row' }, [label]),
    ...READOUT_COLS.map((col) => el('td', { 'data-col': col }, [cells[col]])),
  ]);
}

export function createTrendChart(): TrendChart {
  const caption = el('p', { 'data-testid': 'trend-caption', class: 'trend-caption' }, [CAPTION]);
  // Sized by attributes as well as CSS, so the measured box follows the
  // container wherever the stylesheet is absent.
  const plot = svg('svg', { 'data-testid': 'trend-svg', class: 'trend-svg', role: 'img', width: '100%', height: String(HEIGHT) });
  const empty = el('p', { 'data-testid': 'trend-empty', class: 'trend-empty' });
  // The plot and the message share one fixed-height slot, so the card is
  // the same box whether the range is empty or not.
  const slot = el('div', { class: 'trend-plot' }, [plot, empty]);
  const legend = legendList('row', { 'data-testid': 'trend-legend', 'aria-hidden': 'true' },
    MACRO_KEYS.map((k) => legendRow(`trend-legend-${k}`, k)));
  const card = el('div', { 'data-testid': 'trend-chart', class: 'trend-chart' }, [caption, slot, legend]);

  const heading = el('div', { 'data-testid': 'trend-readout-heading', class: 'trend-readout-heading' });
  const body = el('tbody');
  const readout = el('div', { 'data-testid': 'trend-readout', class: 'trend-readout' }, [
    heading, el('table', { class: 'trend-readout-table' }, [body]),
  ]);
  const node = el('div', { class: 'trend-panel' }, [card, readout]);

  let last: TrendChartProps | null = null;
  let drawn = { width: 0, height: 0 };

  // One listener for every column, bound once; the hit rects themselves are
  // rebuilt on each draw.
  plot.addEventListener('click', (e) => {
    const hit = (e.target as Element).closest('.trend-hit');
    if (hit === null || last === null) {
      return;
    }

    last.onSelect(hit.getAttribute('data-start')!);
  });

  function draw(props: TrendChartProps): void {
    const { buckets } = props.series;
    const first = buckets[0]!;
    const final = buckets[buckets.length - 1]!;
    const hasData = buckets.some((b) => b.perDay !== null);
    plot.toggleAttribute('hidden', !hasData);
    empty.hidden = hasData;

    if (!hasData) {
      empty.textContent = `Nothing logged between ${shortDate(first.start)} and ${shortDate(final.end)}.`;
      plot.replaceChildren();
      plot.removeAttribute('aria-label');
      return;
    }

    const selected = selectedIndex(buckets, props.selected);
    const height = plot.clientHeight || HEIGHT;
    const width = plot.clientWidth || FALLBACK_WIDTH * (height / HEIGHT);
    const n = buckets.length;
    const { scale: s, pad, plotW, plotH, slot: column, labelEvery } = chartLayout(width, height, n);
    drawn = { width, height };

    const stacks = buckets.map((b) => {
      const perDay = b.perDay;
      return perDay === null ? [] : MACRO_KEYS.map((k) => nutrientCalories(k, perDay));
    });
    const ticks = niceTicks(Math.max(...stacks.map((values) => values.reduce((sum, v) => sum + v, 0))));
    const top = ticks[ticks.length - 1]!;
    const y = (v: number): number => pad.top + plotH - (v / top) * plotH;
    const centerX = (i: number): number => pad.left + (i + 0.5) * column;
    const axisLabel = (x: number, yPos: number, anchor: string, testid: string, text: string): SVGElement =>
      svg('text', { x: px(x), y: px(yPos), 'text-anchor': anchor, class: 'trend-axis-label', 'data-testid': testid }, text);

    const grid: SVGElement[] = [];
    for (const t of ticks) {
      grid.push(svg('line', { x1: px(pad.left), x2: px(width - pad.right), y1: px(y(t)), y2: px(y(t)), class: 'trend-grid' }));
      grid.push(axisLabel(pad.left - 6 * s, y(t) + 4 * s, 'end', 'trend-y-label', String(t)));
    }

    const bars: SVGElement[] = [];
    const hits: SVGElement[] = [];
    const labels: SVGElement[] = [];
    buckets.forEach((b, i) => {
      const x = pad.left + i * column;
      let stacked = 0;
      stacks[i]!.forEach((v, j) => {
        const k = MACRO_KEYS[j]!;
        // The gap between stacked segments is carved out of the upper one's
        // bottom edge, so the stack's total height still reads true on the axis.
        const gap = stacked > 0 ? SEGMENT_GAP * s : 0;
        const attrs: Record<string, string> = {
          'data-testid': 'trend-bar', 'data-start': b.start, 'data-key': k, class: 'trend-bar',
          x: px(x + (BAR_GAP * s) / 2), y: px(y(stacked + v)), width: px(Math.max(1, column - BAR_GAP * s)),
          height: px(Math.max(0, y(stacked) - y(stacked + v) - gap)), fill: NUTRIENTS[k].sliceColor,
        };
        if (i === selected) {
          attrs['data-selected'] = 'true';
        }

        bars.push(svg('rect', attrs));
        stacked += v;
      });

      hits.push(svg('rect', {
        'data-testid': 'trend-hit', 'data-start': b.start, class: 'trend-hit',
        x: px(x), y: px(pad.top), width: px(column), height: px(plotH),
      }));

      if ((n - 1 - i) % labelEvery === 0) {
        labels.push(axisLabel(centerX(i), height - 6 * s, 'middle', 'trend-x-label', shortDate(b.start)));
      }
    });

    const loggedDays = buckets.reduce((sum, b) => sum + b.loggedDays, 0);
    plot.setAttribute('aria-label',
      `${CAPTION}, ${shortDate(first.start)} to ${shortDate(final.end)}: ${loggedDays} logged ${loggedDays === 1 ? 'day' : 'days'}`);
    plot.setAttribute('viewBox', `0 0 ${width} ${height}`);
    plot.style.setProperty('--trend-scale', String(s));
    plot.replaceChildren(...grid, ...bars, ...hits, ...labels);
  }

  function renderReadout(props: TrendChartProps): void {
    const { bucketDays, buckets } = props.series;
    const b = buckets[selectedIndex(buckets, props.selected)] ?? null;

    if (b === null) {
      heading.textContent = '—';
    } else if (bucketDays === 1) {
      heading.textContent = weekdayDate(b.start);
    } else {
      heading.textContent = `${shortDate(b.start)} – ${shortDate(b.end)} · ${b.loggedDays} of ${bucketDays} days logged`;
    }

    const perDay = b?.perDay ?? null;
    const pcts = perDay === null ? {} : macroPctOfCalories(perDay);
    // The total row is the day's listed calories, the figure the Log tab
    // totals, not the sum of the stack.
    body.replaceChildren(
      ...MACRO_KEYS.map((k) => readoutRow(`trend-readout-${k}`, 'trend-readout-macro', NUTRIENTS[k].label,
        perDay === null ? DASHES : macroCells(k, perDay, pcts))),
      ...CALORIE_KEYS.map((k) => readoutRow(`trend-readout-${k}`, 'trend-readout-total', NUTRIENTS[k].label,
        { grams: '', cal: perDay === null ? '—' : formatNutrient(k, perDay[k]), pct: '' })),
    );
  }

  // A viewport or text-size change redraws from the last props: the box is
  // measured, not scaled, so bars, gaps and text stay in whole pixels. The
  // observer also fires when the tab is attached or removed, which changes
  // nothing worth drawing.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (last !== null && card.isConnected && (plot.clientWidth !== drawn.width || plot.clientHeight !== drawn.height)) {
        draw(last);
      }
    }).observe(card);
  }

  return {
    node,
    render(props) {
      last = props;
      draw(props);
      renderReadout(props);
    },
  };
}
