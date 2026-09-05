import { sourceLabel } from '../domain/foodSources.js';
import { byRank, fuzzyMatch } from './search.js';
import { renderHighlighted } from './highlight.js';
import { el, reconcileChildren, setInputValue } from './dom.js';
import { disclosureButton } from './disclosure.js';
import { keyedRows } from './keyedRows.js';

export type SourcePickerVm = {
  sources: string[];
  // Already the wired-order intersection with state.enabledSources — a
  // subset of `sources`, not raw state.
  enabled: ReadonlyArray<string>;
  expanded: boolean;
  filter: string;
};

export type SourcePickerHandlers = {
  onToggle(): void;
  onFilterChange(q: string): void;
  onSourceChange(source: string, enabled: boolean): void;
};

export type SourcePicker = { node: HTMLElement; render(vm: SourcePickerVm): void };

type SourceRow = { li: HTMLLIElement; checkbox: HTMLInputElement; labelSpan: HTMLSpanElement };

export function createSourcePicker(handlers: SourcePickerHandlers): SourcePicker {
  const filterInput = el('input', {
    type: 'search', class: 'search-input', 'data-testid': 'source-filter-input',
    placeholder: 'Filter sources', 'aria-label': 'Filter sources',
  });
  filterInput.addEventListener('input', () => handlers.onFilterChange(filterInput.value));

  const list = el('ul', { 'data-testid': 'source-list', class: 'scroll-list source-list' });
  const panel = el('div', { 'data-testid': 'source-picker-panel', class: 'source-picker-panel' }, [filterInput, list]);
  const node = el('div', { 'data-testid': 'source-picker', class: 'source-picker' });

  // Created once and mutated via disclosure.update() on every render, so
  // clicking it never replaces — and de-focuses — the button.
  const disclosure = disclosureButton({
    testid: 'source-picker-toggle',
    label: 'Sources',
    expanded: false,
    onToggle: handlers.onToggle,
  });
  node.append(disclosure.node, panel);

  // Keyed by source and never rebuilt while a source stays wired, so a
  // checkbox mid-click keeps its focus across the re-render that click causes.
  const rows = keyedRows<SourceRow>((source) => {
    const checkbox = el('input', { type: 'checkbox', 'data-testid': 'source-checkbox' });
    checkbox.addEventListener('change', () => handlers.onSourceChange(source, checkbox.checked));

    const labelSpan = el('span', {});
    const li = el('li', { 'data-testid': 'source-option', 'data-source': source, class: 'source-option' }, [
      el('label', {}, [checkbox, labelSpan]),
    ]);

    return { li, checkbox, labelSpan };
  });

  function render(vm: SourcePickerVm): void {
    disclosure.update({ label: `Sources (${vm.enabled.length} of ${vm.sources.length})`, expanded: vm.expanded });

    panel.hidden = !vm.expanded;
    setInputValue(filterInput, vm.filter);

    const items = vm.sources.map((s) => ({ id: s, name: sourceLabel(s) }));
    const matches = fuzzyMatch(items, vm.filter);
    matches.sort(byRank((a, b) => vm.sources.indexOf(a.id) - vm.sources.indexOf(b.id)));

    if (matches.length === 0) {
      list.replaceChildren(el('li', { 'data-testid': 'source-filter-empty', class: 'catalog-hint' }, ['No sources match.']));
      return;
    }

    const desired = matches.map(({ food, indices }) => {
      const row = rows.get(food.id);
      row.checkbox.checked = vm.enabled.includes(food.id);
      row.labelSpan.replaceChildren(...renderHighlighted(food.name, indices));
      return row.li;
    });

    reconcileChildren(list, desired);
  }

  return { node, render };
}
