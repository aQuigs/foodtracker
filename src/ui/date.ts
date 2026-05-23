const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function shiftDate(date: string, deltaDays: number): string {
  const m = ISO_DATE.exec(date);
  if (!m) return date;
  const next = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + deltaDays);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
