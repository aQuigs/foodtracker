const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function localDate(iso: string, offsetDays = 0): Date {
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, mo - 1, d + offsetDays);
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

  return localDate(date, deltaDays).toLocaleDateString('sv-SE');
}

// The `count` consecutive dates from `start`, oldest first.
export function dateSpan(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftDate(start, i));
}
