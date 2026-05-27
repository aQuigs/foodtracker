import { mergeRanges } from './ranges.js';
import type { Range } from './ranges.js';

export function renderHighlighted(
  name: string,
  indices: ReadonlyArray<Range>,
): (string | HTMLElement)[] {
  const merged = mergeRanges(indices, name.length);
  if (merged.length === 0) {
    return [name];
  }

  const out: (string | HTMLElement)[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      out.push(name.slice(cursor, start));
    }

    const mark = document.createElement('mark');
    mark.textContent = name.slice(start, end);
    out.push(mark);
    cursor = end;
  }

  if (cursor < name.length) {
    out.push(name.slice(cursor));
  }

  return out;
}
