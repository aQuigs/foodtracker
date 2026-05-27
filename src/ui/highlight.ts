export function renderHighlighted(
  name: string,
  indices: ReadonlyArray<readonly [number, number]>,
): (string | HTMLElement)[] {
  if (indices.length === 0) {
    return [name];
  }

  const sorted = [...indices].sort((a, b) => a[0] - b[0]);
  const out: (string | HTMLElement)[] = [];
  let cursor = 0;

  for (const [start, end] of sorted) {
    if (start > cursor) {
      out.push(name.slice(cursor, start));
    }

    const mark = document.createElement('mark');
    mark.textContent = name.slice(start, end + 1);
    out.push(mark);
    cursor = end + 1;
  }

  if (cursor < name.length) {
    out.push(name.slice(cursor));
  }

  return out;
}
