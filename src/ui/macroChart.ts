import { macroDistribution } from '../domain/calc.js';
import type { Totals } from '../domain/types.js';
import { el } from './dom.js';

export function renderMacroChart(totals: Totals): HTMLElement | null {
  if (totals.kcal === 0) {
    return null;
  }

  const macroCal = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
  if (macroCal === 0) {
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
    const label = `${macro.charAt(0).toUpperCase()}${macro.slice(1)} ${percent.toFixed(1)}% · ${Math.round(calories)} cal`;
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
