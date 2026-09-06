const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(date: string): [number, number, number] {
  return date.split('-').map(Number) as [number, number, number];
}

export function isValidIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (m === null) {
    return false;
  }

  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return dt.getFullYear() === Number(y)
    && dt.getMonth() === Number(mo) - 1
    && dt.getDate() === Number(d);
}

export function shiftDate(date: string, deltaDays: number): string {
  if (!isValidIsoDate(date)) {
    return date;
  }

  const [y, mo, d] = parts(date);
  return new Date(y, mo - 1, d + deltaDays).toLocaleDateString('sv-SE');
}

// The `count` consecutive dates from `start`, oldest first.
export function dateSpan(start: string, count: number): string[] {
  const [y, mo, d] = parts(start);
  return Array.from({ length: count }, (_, i) => new Date(y, mo - 1, d + i).toLocaleDateString('sv-SE'));
}

export function formatIsoDate(date: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, mo, d] = parts(date);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', opts);
}
