export type Range = readonly [start: number, endExclusive: number];

export function mergeRanges(ranges: ReadonlyArray<Range>, max: number): Range[] {
  const clean: Range[] = [];
  for (const [s, e] of ranges) {
    const start = Math.max(0, Math.min(s, max));
    const end = Math.max(start, Math.min(e, max));
    if (start < end) {
      clean.push([start, end]);
    }
  }

  if (clean.length === 0) {
    return [];
  }

  clean.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: Range[] = [clean[0]!];
  for (let i = 1; i < clean.length; i++) {
    const [start, end] = clean[i]!;
    const last = out[out.length - 1]!;
    if (start <= last[1]) {
      if (end > last[1]) {
        out[out.length - 1] = [last[0], end];
      }
    } else {
      out.push([start, end]);
    }
  }

  return out;
}
