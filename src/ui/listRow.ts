import { el } from './dom.js';

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
  title: (string | HTMLElement)[];
  detail?: (string | HTMLElement)[];
  summary: string;
  summaryTestid?: string;
  edit: ListRowEdit;
  remove: ListRowRemove;
};

export type TwoLineRowOptions = {
  attrs: Record<string, string>;
  name: HTMLElement;
  detail: (string | HTMLElement)[];
  summary: string;
  summaryTestid?: string | undefined;
  actions: HTMLElement;
};

// The two-line row shape shared by every food row with a detail line
// (Foods, Catalog): the name gets the full width and wraps between words;
// the detail and the calories share the line below and wrap independently
// of it, so neither squeezes the other into an unreadable stack.
export function twoLineRow(opts: TwoLineRowOptions): HTMLLIElement {
  const summaryAttrs: Record<string, string> = { class: 'row-summary' };
  if (opts.summaryTestid !== undefined) {
    summaryAttrs['data-testid'] = opts.summaryTestid;
  }

  const meta = el('span', { class: 'row-meta' }, [
    el('span', { class: 'row-detail' }, opts.detail),
    el('span', summaryAttrs, [opts.summary]),
  ]);

  const attrs = { ...opts.attrs, class: `${opts.attrs.class ?? ''} row-with-detail`.trim() };
  return el('li', attrs, [opts.name, meta, opts.actions]);
}

// One factory for every soft-deletable list row (Foods, Recipes): same
// name/summary/actions shape, so the two views can't drift into subtly
// different DOM or interaction behavior for the same affordance.
export function listRow(opts: ListRowOptions): HTMLLIElement {
  const prefix = opts.testid.replace(/-row$/, '');

  const nameSpan = el(
    'span', { 'data-testid': `${opts.testid}-name`, class: 'row-name' },
    opts.title,
  );

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

  const actions = el('div', { class: 'row-actions' }, [editBtn, removeBtn]);

  if (opts.detail === undefined) {
    const summaryAttrs: Record<string, string> = { class: 'row-summary' };
    if (opts.summaryTestid !== undefined) {
      summaryAttrs['data-testid'] = opts.summaryTestid;
    }

    const summary = el('span', summaryAttrs, [opts.summary]);
    return el('li', { 'data-testid': opts.testid, [opts.idAttr]: opts.id }, [nameSpan, summary, actions]);
  }

  return twoLineRow({
    attrs: { 'data-testid': opts.testid, [opts.idAttr]: opts.id },
    name: nameSpan,
    detail: opts.detail,
    summary: opts.summary,
    summaryTestid: opts.summaryTestid,
    actions,
  });
}
