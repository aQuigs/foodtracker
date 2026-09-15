import { el } from './dom.js';

// The one shape of a list's hint line — a results panel's "nothing matched",
// the picker's "loading brands" — so the two surfaces never drift apart.
export function hintRow(testid: string, text: string, attrs: Record<string, string> = {}): HTMLLIElement {
  return el('li', { 'data-testid': testid, class: 'catalog-hint', ...attrs }, [text]);
}
