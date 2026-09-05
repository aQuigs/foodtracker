import { NUTRIENT_KEYS, NUTRIENTS, nutrientCalories } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';
import { TRAILING_DAYS, TREND_METRICS } from '../domain/trends.js';
import type { TrendBucket, TrendMetricKey } from '../domain/trends.js';
import { el } from './dom.js';
import { svg } from './svg.js';
import { legendRow } from './legend.js';

export type TrendChartProps = {
  buckets: TrendBucket[];
  bucketDays: number;
  // Trailing mean per bucket; empty when the range draws no line.
  average: (number | null)[];
  metric: TrendMetricKey;
  // A bucket start; null selects the newest bucket with data.
  selected: string | null;
  onSelect: (start: string) => void;
};

export type TrendChart = { node: HTMLElement; render(props: TrendChartProps): void };

// Geometry in CSS pixels at a 16px root font; draw() scales it by the
// actual root font size so the chart grows with the user's text setting.
const BASE_FONT_PX = 16;
const HEIGHT = 200;
const PAD = { top: 10, right: 20, bottom: 22, left: 44 };
const BAR_GAP = 2;
const SEGMENT_GAP = 2;
const MAX_X_LABELS = 6;
const X_LABEL_SPACE = 56;
const MAX_TICK_INTERVALS = 4;
const FALLBACK_WIDTH = 320;
const TICK_STEPS = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateParts(iso: string): [number, number, number] {
  return iso.split('-').map(Number) as [number, number, number];
}

export function shortDate(iso: string): string {
  const [, m, d] = dateParts(iso);
  return `${MONTHS[m - 1]} ${d}`;
}

function weekdayDate(iso: string): string {
  const [y, m, d] = dateParts(iso);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${shortDate(iso)}`;
}

// Ticks from zero in a round step, at most four intervals, reaching past
// the tallest value so no bar touches the top edge.
export function niceTicks(max: number): number[] {
  const step = TICK_STEPS.find((s) => max / s <= MAX_TICK_INTERVALS) ?? TICK_STEPS[TICK_STEPS.length - 1]!;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) {
    out.push(v);
  }

  return out;
}

function remScale(): number {
  const size = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size / BASE_FONT_PX : 1;
}

function px(v: number): string {
  return v.toFixed(2);
}

function cal(v: number): string {
  return `${Math.round(v)} cal`;
}

function stackCalories(keys: readonly (keyof NutritionFacts)[], perDay: NutritionFacts): number {
  return keys.reduce((sum, k) => sum + nutrientCalories(k, perDay), 0);
}

function selectedIndex(props: TrendChartProps): number {
  if (props.selected !== null) {
    const i = props.buckets.findIndex((b) => b.start === props.selected);
    if (i >= 0) {
      return i;
    }
  }

  for (let i = props.buckets.length - 1; i >= 0; i--) {
    if (props.buckets[i]!.perDay !== null) {
      return i;
    }
  }

  return -1;
}

function readoutRow(testid: string, label: string, value: string): HTMLElement {
  return el('div', { 'data-testid': testid, class: 'trend-readout-row' }, [
    el('span', { class: 'trend-readout-label' }, [label]),
    el('span', { class: 'trend-readout-value' }, [value]),
  ]);
}

export function createTrendChart(): TrendChart {
  // Sized by attributes as well as CSS, so the measured box follows the
  // container wherever the stylesheet is absent.
  const plot = svg('svg', { 'data-testid': 'trend-svg', class: 'trend-svg', role: 'img', width: '100%', height: String(HEIGHT) });
  const legend = el('ul', { 'data-testid': 'trend-legend', class: 'macro-legend trend-legend', 'aria-hidden': 'true' });
  const empty = el('p', { 'data-testid': 'trend-empty', class: 'trend-empty' });
  const card = el('div', { 'data-testid': 'trend-chart', class: 'trend-chart' }, [plot, legend, empty]);

  const heading = el('div', { 'data-testid': 'trend-readout-heading', class: 'trend-readout-heading' });
  const rows = el('div', { class: 'trend-readout-rows' });
  const readout = el('div', { 'data-testid': 'trend-readout', class: 'trend-readout' }, [heading, rows]);
  const node = el('div', { class: 'trend-panel' }, [card, readout]);

  let last: TrendChartProps | null = null;

  function draw(props: TrendChartProps): void {
    const { buckets, average, metric } = props;
    const keys = TREND_METRICS[metric].keys;
    const first = buckets[0];
    const final = buckets[buckets.length - 1];
    const hasData = buckets.some((b) => b.perDay !== null);

    empty.textContent = first && final
      ? `Nothing logged between ${shortDate(first.start)} and ${shortDate(final.end)}.`
      : 'Nothing logged.';
    empty.hidden = hasData;
    plot.toggleAttribute('hidden', !hasData);
    legend.hidden = !hasData || keys.length < 2;
    legend.replaceChildren(...keys.map((k) => legendRow(`trend-legend-${k}`, k)));

    if (!hasData || !first || !final) {
      plot.replaceChildren();
      plot.removeAttribute('aria-label');
      return;
    }

    const s = remScale();
    const width = plot.clientWidth || FALLBACK_WIDTH * s;
    const height = plot.clientHeight || HEIGHT * s;
    const pad = { top: PAD.top * s, right: PAD.right * s, bottom: PAD.bottom * s, left: PAD.left * s };
    const n = buckets.length;
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const slot = plotW / n;
    const totals = buckets.map((b) => (b.perDay === null ? 0 : stackCalories(keys, b.perDay)));
    const ticks = niceTicks(Math.max(...totals, ...average.map((a) => a ?? 0)));
    const top = ticks[ticks.length - 1]!;
    const y = (v: number): number => pad.top + plotH - (v / top) * plotH;
    const centerX = (i: number): number => pad.left + (i + 0.5) * slot;
    const selected = selectedIndex(props);
    const children: SVGElement[] = [];

    for (const t of ticks) {
      children.push(svg('line', { x1: px(pad.left), x2: px(width - pad.right), y1: px(y(t)), y2: px(y(t)), class: 'trend-grid' }));
      children.push(svg('text', {
        x: px(pad.left - 6 * s), y: px(y(t) + 4 * s), 'text-anchor': 'end', class: 'trend-axis-label', 'data-testid': 'trend-y-label',
      }, String(t)));
    }

    buckets.forEach((b, i) => {
      if (b.perDay === null) {
        return;
      }

      const perDay = b.perDay;
      const values = keys.map((k) => nutrientCalories(k, perDay));
      const x = pad.left + i * slot + (BAR_GAP * s) / 2;
      const w = Math.max(1, slot - BAR_GAP * s);
      let stacked = 0;
      keys.forEach((k, j) => {
        const v = values[j]!;
        // The gap between stacked segments is carved out of the upper one's
        // bottom edge, so the stack's total height still reads true on the axis.
        const below = values.slice(0, j).some((u) => u > 0);
        const yTop = y(stacked + v);
        const h = Math.max(0, y(stacked) - yTop - (below ? SEGMENT_GAP * s : 0));
        const attrs: Record<string, string> = {
          'data-testid': 'trend-bar', 'data-start': b.start, 'data-key': k, class: 'trend-bar',
          x: px(x), y: px(yTop), width: px(w), height: px(h), fill: NUTRIENTS[k].sliceColor,
        };
        if (i === selected) {
          attrs['data-selected'] = 'true';
        }

        children.push(svg('rect', attrs));
        stacked += v;
      });
    });

    if (average.length > 0) {
      let d = '';
      let pen = false;
      average.forEach((a, i) => {
        if (a === null) {
          pen = false;
          return;
        }

        d += `${pen ? 'L' : 'M'}${px(centerX(i))} ${px(y(a))} `;
        pen = true;
      });
      children.push(svg('path', { 'data-testid': 'trend-avg-line', class: 'trend-avg-line', d: d.trim() }));
    }

    buckets.forEach((b, i) => {
      const hit = svg('rect', {
        'data-testid': 'trend-hit', 'data-start': b.start, class: 'trend-hit',
        x: px(pad.left + i * slot), y: px(pad.top), width: px(slot), height: px(plotH),
      });
      hit.addEventListener('click', () => props.onSelect(b.start));
      children.push(hit);
    });

    // As many labels as the plot can space out, never more than six, so a
    // phone shows four that read and a desktop shows six.
    const labelSlots = Math.min(MAX_X_LABELS, Math.max(2, Math.floor(plotW / (X_LABEL_SPACE * s))));
    const every = Math.ceil(n / labelSlots);
    buckets.forEach((b, i) => {
      if ((n - 1 - i) % every === 0) {
        children.push(svg('text', {
          x: px(centerX(i)), y: px(height - 6 * s), 'text-anchor': 'middle', class: 'trend-axis-label', 'data-testid': 'trend-x-label',
        }, shortDate(b.start)));
      }
    });

    const loggedDays = buckets.reduce((sum, b) => sum + b.loggedDays, 0);
    const loggedCal = buckets.reduce((sum, b) => sum + (b.perDay === null ? 0 : b.perDay.calories * b.loggedDays), 0);
    plot.setAttribute('aria-label',
      `${TREND_METRICS[metric].label} per day, ${shortDate(first.start)} to ${shortDate(final.end)}: `
      + `${loggedDays} logged days, average ${Math.round(loggedCal / loggedDays)} cal`);
    plot.setAttribute('viewBox', `0 0 ${width} ${height}`);
    plot.replaceChildren(...children);
  }

  function renderReadout(props: TrendChartProps): void {
    const i = selectedIndex(props);
    const b = i >= 0 ? props.buckets[i]! : null;

    if (b === null) {
      heading.textContent = '—';
    } else if (props.bucketDays === 1) {
      heading.textContent = weekdayDate(b.start);
    } else {
      heading.textContent = `${shortDate(b.start)} – ${shortDate(b.end)} · ${b.loggedDays} of ${props.bucketDays} days logged`;
    }

    const perDay = b?.perDay ?? null;
    const items = NUTRIENT_KEYS.map((k) => {
      const meta = NUTRIENTS[k];
      let value = '—';
      if (perDay !== null) {
        value = meta.unit === 'cal'
          ? cal(perDay[k])
          : `${Math.round(perDay[k])} g (${cal(nutrientCalories(k, perDay))})`;
      }

      return readoutRow(`trend-readout-${k}`, meta.label, value);
    });

    if (props.average.length > 0) {
      const a = i >= 0 ? props.average[i] ?? null : null;
      items.push(readoutRow('trend-readout-average', `${TRAILING_DAYS}-day avg`, a === null ? '—' : cal(a)));
    }

    rows.replaceChildren(...items);
  }

  // A viewport or text-size change redraws from the last props: the box is
  // measured, not scaled, so bars, gaps and text stay in whole pixels.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (last !== null) {
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
