import type { BrandsIndex } from '../domain/types.js';
import {
  STORE_BUNDLES, brandEntry, brandIdOf, brandSource, bundleSources, labelSearchKey, sourceLabel,
} from '../domain/foodSources.js';
import { searchKey } from '../domain/searchKey.js';
import { byRank, fuzzyMatch } from './search.js';
import { renderHighlighted } from './highlight.js';
import type { Range } from './ranges.js';
import { el, reconcileChildren, setInputValue } from './dom.js';
import { disclosureButton } from './disclosure.js';
import { keyedRows } from './keyedRows.js';

export type BrandsIndexVm =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; index: BrandsIndex }
  | { kind: 'failed'; message: string };

export type SourcePickerVm = {
  // The static sources main.ts wired, in registry order.
  sources: string[];
  // Everything on: static sources and brand sources alike.
  enabled: ReadonlyArray<string>;
  // idle when no brand catalog is wired; the Brands section then stays out.
  brands: BrandsIndexVm;
  expanded: boolean;
  filter: string;
};

export type SourcePickerHandlers = {
  onToggle(): void;
  onFilterChange(q: string): void;
  // `source` is a static source, a store id (its brands toggle together) or
  // a brand source.
  onSourceChange(source: string, enabled: boolean): void;
};

export type SourcePicker = { node: HTMLElement; render(vm: SourcePickerVm): void };

// The brand list runs to tens of thousands; a filter is what finds a brand,
// and a match list longer than this is one the user has not typed enough for.
const BRAND_MATCH_CAP = 25;

type Option = { id: string; name: string; matchKey: string; count?: number };
type Hit = { option: Option; indices: ReadonlyArray<Range> };
type SourceRow = { li: HTMLLIElement; checkbox: HTMLInputElement; labelSpan: HTMLSpanElement; countSpan: HTMLSpanElement };

const STORE_OPTIONS: Option[] = Object.entries(STORE_BUNDLES)
  .map(([id, bundle]) => ({ id, name: bundle.label, matchKey: labelSearchKey(bundle.label) }));

// Built once per index object: the matcher wants one option per brand and
// the index does not change between keystrokes.
const optionsByIndex = new WeakMap<BrandsIndex, Option[]>();

function brandOptions(index: BrandsIndex): Option[] {
  let options = optionsByIndex.get(index);
  if (options === undefined) {
    options = index.brands.map(([id, label, count]) => ({ id: brandSource(id), name: label, matchKey: labelSearchKey(label), count }));
    optionsByIndex.set(index, options);
  }

  return options;
}

function narrow(options: Option[], filter: string, tieBreak: (a: Option, b: Option) => number): Hit[] {
  const matches = fuzzyMatch(options, filter);
  matches.sort(byRank(tieBreak));
  return matches.map(({ food, indices }) => ({ option: food, indices }));
}

function byPosition(ids: string[]): (a: Option, b: Option) => number {
  return (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id);
}

function hint(testid: string, text: string, attrs: Record<string, string> = {}): HTMLLIElement {
  return el('li', { 'data-testid': testid, class: 'catalog-hint', ...attrs }, [text]);
}

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

  const headers = keyedRows<HTMLLIElement>((section) => el('li', {
    'data-testid': 'source-section', 'data-section': section, class: 'source-section',
  }, [section === 'usda' ? 'USDA' : section === 'stores' ? 'Stores' : 'Brands']));

  // Keyed by source and kept while a row stays listed, so a checkbox
  // mid-click keeps its focus across the re-render that click causes.
  const rows = keyedRows<SourceRow>((source) => {
    const checkbox = el('input', { type: 'checkbox', 'data-testid': 'source-checkbox' });
    checkbox.addEventListener('change', () => handlers.onSourceChange(source, checkbox.checked));

    const labelSpan = el('span', {});
    const countSpan = el('span', { class: 'source-count' });
    const li = el('li', { 'data-testid': 'source-option', 'data-source': source, class: 'source-option' }, [
      el('label', {}, [checkbox, labelSpan, countSpan]),
    ]);

    return { li, checkbox, labelSpan, countSpan };
  });

  function rowFor(hit: Hit, checked: boolean, indeterminate = false): HTMLLIElement {
    const row = rows.get(hit.option.id);
    row.checkbox.checked = checked;
    row.checkbox.indeterminate = indeterminate;
    row.labelSpan.replaceChildren(...renderHighlighted(hit.option.name, hit.indices));

    if (hit.option.count === undefined) {
      row.countSpan.textContent = '';
      row.li.removeAttribute('data-count');
    } else {
      row.countSpan.textContent = hit.option.count.toLocaleString();
      row.li.setAttribute('data-count', String(hit.option.count));
    }

    return row.li;
  }

  function staticRows(vm: SourcePickerVm, enabled: Set<string>): HTMLLIElement[] {
    const options = vm.sources.map((s) => {
      const name = sourceLabel(s);
      return { id: s, name, matchKey: labelSearchKey(name) };
    });

    return narrow(options, vm.filter, byPosition(vm.sources)).map((hit) => rowFor(hit, enabled.has(hit.option.id)));
  }

  // A store is checked when every brand it bundles is on, indeterminate when
  // only some are — a brand unticked on its own shows here as a partial store.
  function storeRows(vm: SourcePickerVm, enabled: Set<string>): HTMLLIElement[] {
    return narrow(STORE_OPTIONS, vm.filter, byPosition(STORE_OPTIONS.map((o) => o.id))).map((hit) => {
      const brands = bundleSources(hit.option.id);
      const on = brands.filter((b) => enabled.has(b)).length;
      return rowFor(hit, on === brands.length, on > 0 && on < brands.length);
    });
  }

  // Without a filter the section lists what is on, so a brand can be turned
  // off from here; with one it searches the whole index.
  function brandRows(vm: SourcePickerVm, enabled: Set<string>): HTMLLIElement[] {
    const brands = vm.brands;

    if (brands.kind === 'idle') {
      return [];
    }

    if (brands.kind === 'loading') {
      return [hint('source-index-status', 'Loading brands…', { 'data-state': 'loading' })];
    }

    if (brands.kind === 'failed') {
      return [hint('source-index-status', "Couldn't load the brand list. Reload to retry.", { 'data-state': 'failed', title: brands.message })];
    }

    const { index } = brands;

    if (searchKey(vm.filter) === '') {
      const on = vm.enabled.flatMap((source) => {
        const id = brandIdOf(source);
        if (id === null) {
          return [];
        }

        const entry = brandEntry(index, id);
        return [{ id: source, name: entry?.[1] ?? sourceLabel(source), matchKey: '', ...(entry ? { count: entry[2] } : {}) }];
      });
      on.sort((a, b) => a.name.localeCompare(b.name));

      return [
        ...on.map((option) => rowFor({ option, indices: [] }, true)),
        hint('source-brands-hint', `Type above to search ${index.brands.length.toLocaleString()} brands.`),
      ];
    }

    const matches = narrow(brandOptions(index), vm.filter, (a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name));
    const shown = matches.slice(0, BRAND_MATCH_CAP).map((hit) => rowFor(hit, enabled.has(hit.option.id)));

    if (matches.length > BRAND_MATCH_CAP) {
      shown.push(hint('source-brands-hint', `Showing ${BRAND_MATCH_CAP} of ${matches.length.toLocaleString()} brands. Keep typing to narrow.`));
    }

    return shown;
  }

  function render(vm: SourcePickerVm): void {
    disclosure.update({ label: `Sources (${vm.enabled.length} on)`, expanded: vm.expanded });

    panel.hidden = !vm.expanded;
    setInputValue(filterInput, vm.filter);

    if (!vm.expanded) {
      return;
    }

    // Brands before stores: with no filter the section shows what is on and
    // how to find more, which twelve store rows would otherwise push out of
    // the scroll window; with a store's name typed, only a brand or two share
    // it, so the store row still sits near the top.
    const enabled = new Set(vm.enabled);
    const sections: Array<[string, HTMLLIElement[]]> = [
      ['usda', staticRows(vm, enabled)],
      ['brands', brandRows(vm, enabled)],
      ['stores', storeRows(vm, enabled)],
    ];

    const desired = sections
      .filter(([, items]) => items.length > 0)
      .flatMap(([section, items]) => [headers.get(section), ...items]);

    if (desired.length === 0) {
      list.replaceChildren(hint('source-filter-empty', 'No sources match.'));
      return;
    }

    reconcileChildren(list, desired);
    rows.prune(desired.map((li) => li.getAttribute('data-source')).filter((s): s is string => s !== null));
  }

  return { node, render };
}
