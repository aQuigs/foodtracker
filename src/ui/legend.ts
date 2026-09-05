import { NUTRIENTS } from '../domain/types.js';
import type { NutritionFacts } from '../domain/types.js';
import { el } from './dom.js';

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
