import type { MacroShare, NutritionFacts } from '../domain/types.js';

export type DonutSlice = { key: keyof NutritionFacts; d: string };

export const DONUT_VIEWBOX = '0 0 100 100';

const CX = 50;
const CY = 50;
const R_OUTER = 46;
const R_INNER = 26;
const TAU = Math.PI * 2;

function arcPath(startAngle: number, endAngle: number): string {
  const polar = (r: number, a: number): [number, number] => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  const [x1, y1] = polar(R_OUTER, startAngle);
  const [x2, y2] = polar(R_OUTER, endAngle);
  const [x3, y3] = polar(R_INNER, endAngle);
  const [x4, y4] = polar(R_INNER, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${x1.toFixed(3)} ${y1.toFixed(3)}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
    `L ${x3.toFixed(3)} ${y3.toFixed(3)}`,
    `A ${R_INNER} ${R_INNER} 0 ${largeArc} 0 ${x4.toFixed(3)} ${y4.toFixed(3)}`,
    'Z',
  ].join(' ');
}

// One slice per macro, clockwise from the top; a macro with no share gets an
// empty path so callers can still bind one element per macro, and a day with
// nothing logged gets no slices at all. A lone macro is drawn as two half
// rings because a single arc cannot close on itself.
export function donutSlices(shares: MacroShare[]): DonutSlice[] {
  const total = shares.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return [];
  }

  if (shares.filter((s) => s.value > 0).length === 1) {
    const ring = `${arcPath(-Math.PI / 2, Math.PI / 2)} ${arcPath(Math.PI / 2, (3 * Math.PI) / 2)}`;
    return shares.map(({ key, value }) => ({ key, d: value > 0 ? ring : '' }));
  }

  let start = -Math.PI / 2;
  return shares.map(({ key, value }) => {
    if (value <= 0) {
      return { key, d: '' };
    }

    const end = start + (value / total) * TAU;
    const d = arcPath(start, end);
    start = end;
    return { key, d };
  });
}
