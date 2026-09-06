import { el } from './dom.js';

// A label on the left and a value on the right, placed by the parent's
// two-column grid; the entry detail card and the trend readout share it.
export function detailRow(testid: string, label: string, value: string): HTMLElement {
  return el('div', { 'data-testid': testid, class: 'detail-row' }, [
    el('span', { class: 'detail-label' }, [label]),
    el('span', { class: 'detail-value' }, [value]),
  ]);
}
