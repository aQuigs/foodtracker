import { NUTRIENTS } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';
import { el } from './dom.js';

export type LegendLayout = 'column' | 'row';

// The list owns both of its layouts: the donut's column beside the ring and
// the trend chart's wrapped row under the plot.
export function legendList(layout: LegendLayout, attrs: Record<string, string> = {}, rows: HTMLElement[] = []): HTMLUListElement {
  return el('ul', { ...attrs, class: 'macro-legend', 'data-layout': layout }, rows);
}

// One legend row per nutrient series, shared by the donut and the trend
// chart so a swatch means the same colour everywhere.
export function legendRow(testid: string, key: keyof NutritionFacts, value?: string): HTMLElement {
  const children: HTMLElement[] = [
    el('span', { class: 'macro-legend-swatch', style: `background:${NUTRIENTS[key].sliceColor}` }),
    el('span', { class: 'macro-legend-label' }, [NUTRIENTS[key].label]),
  ];

  if (value !== undefined) {
    children.push(el('span', { class: 'macro-legend-value' }, [value]));
  }

  return el('li', { 'data-testid': testid, class: 'macro-legend-row' }, children);
}
