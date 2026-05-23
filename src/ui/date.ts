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

  const m = ISO_DATE.exec(date)!;
  const next = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + deltaDays);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
