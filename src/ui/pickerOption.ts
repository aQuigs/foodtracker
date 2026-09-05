import { el } from './dom.js';
import { renderHighlighted } from './highlight.js';
import type { Range } from './ranges.js';

export type PickerOptionUpdate = {
  name: string;
  indices: ReadonlyArray<Range>;
  tag?: string;
  selected?: boolean;
  open?: boolean;
  detailId?: string;
  onActivate: () => void;
};

export type PickerOptionRow = {
  li: HTMLLIElement;
  update(opts: PickerOptionUpdate): void;
};

// One row shape for every clickable picker option (the log picker's foods
// and recipes, the recipe editor's "add a food" rows): same selected/open
// attributes and the same click/Enter/Space activation, so the three
// surfaces can't drift into subtly different keyboard or a11y behavior.
// A caller that reuses the row across renders (rather than recreating it)
// keeps whatever's inside it — such as the log picker's recipe card — from
// losing focus every time the list is redrawn.
export function createPickerOption(opts: { testid: string; idAttr: string; id: string }): PickerOptionRow {
  const li = el('li', {
    'data-testid': opts.testid,
    class: 'picker-option',
    [opts.idAttr]: opts.id,
    role: 'button',
    tabindex: '0',
  });

  let onActivate: () => void = () => {};
  li.addEventListener('click', () => onActivate());
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  });

  function update(next: PickerOptionUpdate): void {
    onActivate = next.onActivate;

    if (next.selected) {
      li.setAttribute('data-selected', 'true');
      li.setAttribute('aria-expanded', next.open ? 'true' : 'false');
      if (next.open && next.detailId !== undefined) {
        li.setAttribute('aria-controls', next.detailId);
      } else {
        li.removeAttribute('aria-controls');
      }
    } else {
      li.removeAttribute('data-selected');
      li.removeAttribute('aria-expanded');
      li.removeAttribute('aria-controls');
    }

    const children: (Node | string)[] = [...renderHighlighted(next.name, next.indices)];
    if (next.tag !== undefined) {
      children.push(el('span', { 'data-testid': 'picker-tag', class: 'picker-tag' }, [next.tag]));
    }

    li.replaceChildren(...children);
  }

  return { li, update };
}
