import { el } from './dom.js';

// The one shape of a list's hint line — a results panel's "nothing matched",
// the picker's "loading brands" — so the two surfaces never drift apart.
export function hintRow(testid: string, text: string, attrs: Record<string, string> = {}): HTMLLIElement {
  return el('li', { 'data-testid': testid, class: 'catalog-hint', ...attrs }, [text]);
}

// The line under a list cut short at `shown` of `total` matches; `noun`
// names what is listed where the rows alone don't say.
export function cappedListHint(testid: string, shown: number, total: number, noun?: string): HTMLLIElement {
  const counted = noun === undefined ? total.toLocaleString() : `${total.toLocaleString()} ${noun}`;
  return hintRow(testid, `Showing ${shown} of ${counted}. Keep typing to narrow the list.`);
}
