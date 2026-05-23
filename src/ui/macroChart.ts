import { macroDistribution } from '../domain/calc.js';
import type { Totals } from '../domain/types.js';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

export function renderMacroChart(totals: Totals): HTMLElement | null {
  if (totals.kcal === 0) {
    return null;
  }

  const dist = macroDistribution(totals);

  const segments: Array<{ macro: string; color: string; percent: number; calories: number }> = [
    { macro: 'protein', color: '#4f8ce6', percent: dist.protein.percent, calories: dist.protein.calories },
    { macro: 'carbs',   color: '#e6a44f', percent: dist.carbs.percent,   calories: dist.carbs.calories   },
    { macro: 'fat',     color: '#9b6ce6', percent: dist.fat.percent,     calories: dist.fat.calories     },
  ];

  const bar = el('div', { class: 'macro-chart-bar' });

  for (const { macro, color, percent, calories } of segments) {
    const label = `${macro.charAt(0).toUpperCase()}${macro.slice(1)} ${percent}% · ${Math.round(calories)} cal`;
    const seg = el('div', {
      class: 'macro-chart-segment',
      'data-macro': macro,
      style: `flex-basis: ${percent}%; background: ${color};`,
      title: label,
    }, [label]);
    bar.append(seg);
  }

  return el('div', { class: 'macro-chart', 'data-testid': 'macro-chart' }, [bar]);
}
