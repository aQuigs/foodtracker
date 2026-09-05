import { el } from './dom.js';
import { renderHighlighted } from './highlight.js';
import type { Range } from './ranges.js';

export type ListRowEdit = {
  label: string;
  onClick: () => void;
  disabled?: { reason: string };
};

export type ListRowRemove = {
  label: string;
  onClick: () => void;
};

export type ListRowOptions = {
  testid: string;
  idAttr: string;
  id: string;
  name: string;
  indices: ReadonlyArray<Range>;
  summary: string;
  summaryTestid?: string;
  edit: ListRowEdit;
  remove: ListRowRemove;
};

// One factory for every soft-deletable list row (Foods, Recipes): same
// name/summary/actions shape, so the two views can't drift into subtly
// different DOM or interaction behavior for the same affordance.
export function listRow(opts: ListRowOptions): HTMLLIElement {
  const prefix = opts.testid.replace(/-row$/, '');

  const nameSpan = el(
    'span', { 'data-testid': `${opts.testid}-name`, class: 'row-name' },
    renderHighlighted(opts.name, opts.indices),
  );

  const summaryAttrs: Record<string, string> = { class: 'row-summary' };
  if (opts.summaryTestid !== undefined) {
    summaryAttrs['data-testid'] = opts.summaryTestid;
  }

  const editBtn = el('button', {
    'data-testid': `${prefix}-edit`, type: 'button', 'aria-label': opts.edit.label,
  }, ['Edit']);
  editBtn.addEventListener('click', opts.edit.onClick);
  if (opts.edit.disabled) {
    editBtn.disabled = true;
    editBtn.title = opts.edit.disabled.reason;
  }

  const removeBtn = el('button', {
    'data-testid': `${prefix}-delete`, type: 'button', 'aria-label': opts.remove.label,
  }, ['×']);
  removeBtn.addEventListener('click', opts.remove.onClick);

  return el('li', { 'data-testid': opts.testid, [opts.idAttr]: opts.id }, [
    nameSpan,
    el('span', summaryAttrs, [opts.summary]),
    el('div', { class: 'row-actions' }, [editBtn, removeBtn]),
  ]);
}
