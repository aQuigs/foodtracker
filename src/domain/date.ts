const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

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

  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const next = new Date(y, mo - 1, d + deltaDays);
  return next.toLocaleDateString('sv-SE');
}
