import type { BrandList } from '../domain/dataFiles.js';
import {
  STORE_BUNDLES, brandEntries, brandEntry, brandIdOf, brandSource, bundleSources, labelSearchKey, sourceLabel,
} from '../domain/foodSources.js';
import { searchKey } from '../domain/searchKey.js';
import { byRank, fuzzyMatch } from './search.js';
import { renderHighlighted } from './highlight.js';
import type { Range } from './ranges.js';
import { el, reconcileChildren, setInputValue } from './dom.js';
import { hintRow } from './hintRow.js';
import { disclosureButton } from './disclosure.js';
import { keyedRows } from './keyedRows.js';

export type BrandListVm =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; list: BrandList }
  | { kind: 'failed'; message: string };

export type SourcePickerVm = {
  // The static sources main.ts wired, in registry order.
  sources: string[];
  // Everything on: static sources and brand sources alike.
  enabled: ReadonlyArray<string>;
  // idle when no brand catalog is wired; the Brands section then stays out.
  brands: BrandListVm;
  expanded: boolean;
  filter: string;
};

export type SourcePickerHandlers = {
  onToggle(): void;
  onFilterChange(q: string): void;
  // The sources a row stands for: one for a static source or a brand, a
  // store's whole bundle for a store.
  onSourcesChange(sources: string[], enabled: boolean): void;
};

export type SourcePicker = { node: HTMLElement; render(vm: SourcePickerVm): void };

// The brand list runs to tens of thousands; a filter is what finds a brand,
// and a match list longer than this is one the user has not typed enough for.
const BRAND_MATCH_CAP = 25;

// Brands before stores: with no filter the section shows what is on and
// how to find more, which twelve store rows would otherwise push out of
// the scroll window; with a store's name typed, only a brand or two share
// it, so the store row still sits near the top.
const SECTIONS = { usda: 'USDA', brands: 'Brands', stores: 'Stores' } as const;
type Section = keyof typeof SECTIONS;

// A row: what the filter matches it on, the sources it turns on, and — for a
// brand — how many rows it holds.
type Option = { id: string; name: string; matchKey: string; sources: string[]; count?: number };
type Hit = { option: Option; indices: ReadonlyArray<Range> };
type SourceRow = { li: HTMLLIElement; checkbox: HTMLInputElement; labelSpan: HTMLSpanElement; countSpan: HTMLSpanElement; sources: string[] };

function option(id: string, name: string, sources: string[], count?: number): Option {
  return { id, name, matchKey: labelSearchKey(name), sources, ...(count === undefined ? {} : { count }) };
}

const STORE_OPTIONS: Option[] = [...STORE_BUNDLES].map(([id, bundle]) => option(id, bundle.label, bundleSources(id)));

// Built once per list object: the matcher wants one option per brand and
// the list does not change between keystrokes.
const optionsByList = new WeakMap<BrandList, Option[]>();

function brandOptions(list: BrandList): Option[] {
  let options = optionsByList.get(list);
  if (options === undefined) {
    options = brandEntries(list).map((entry) => {
      const source = brandSource(entry.id);
      return option(source, entry.label, [source], entry.count);
    });
    optionsByList.set(list, options);
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
  }, [SECTIONS[section as Section]]));

  // Keyed by row id and kept while a row stays listed, so a checkbox
  // mid-click keeps its focus across the re-render that click causes.
  const rows = keyedRows<SourceRow>((id) => {
    const checkbox = el('input', { type: 'checkbox', 'data-testid': 'source-checkbox' });
    const labelSpan = el('span', {});
    const countSpan = el('span', { class: 'source-count' });
    const li = el('li', { 'data-testid': 'source-option', 'data-source': id, class: 'source-option' }, [
      el('label', {}, [checkbox, labelSpan, countSpan]),
    ]);

    const row: SourceRow = { li, checkbox, labelSpan, countSpan, sources: [] };
    checkbox.addEventListener('change', () => handlers.onSourcesChange(row.sources, checkbox.checked));
    return row;
  });

  // Checked when every source the row stands for is on, indeterminate when
  // only some are — a brand unticked on its own shows here as a partial store.
  function rowFor(hit: Hit, enabled: Set<string>): HTMLLIElement {
    const { option, indices } = hit;
    const row = rows.get(option.id);
    const on = option.sources.filter((s) => enabled.has(s)).length;

    row.sources = option.sources;
    row.checkbox.checked = on === option.sources.length;
    row.checkbox.indeterminate = on > 0 && on < option.sources.length;
    row.labelSpan.replaceChildren(...renderHighlighted(option.name, indices));

    if (option.count === undefined) {
      row.countSpan.textContent = '';
      row.li.removeAttribute('data-count');
    } else {
      row.countSpan.textContent = option.count.toLocaleString();
      row.li.setAttribute('data-count', String(option.count));
    }

    return row.li;
  }

  function staticRows(vm: SourcePickerVm, enabled: Set<string>): HTMLLIElement[] {
    const options = vm.sources.map((s) => option(s, sourceLabel(s), [s]));
    return narrow(options, vm.filter, byPosition(vm.sources)).map((hit) => rowFor(hit, enabled));
  }

  function storeRows(vm: SourcePickerVm, enabled: Set<string>): HTMLLIElement[] {
    return narrow(STORE_OPTIONS, vm.filter, byPosition(STORE_OPTIONS.map((o) => o.id))).map((hit) => rowFor(hit, enabled));
  }

  // Matching a filter against tens of thousands of brands is the one costly
  // step of a render, and the picker re-renders on every paint while open —
  // a download's progress, a toggle — with the filter unchanged. Kept for
  // as long as its inputs hold.
  let lastHits: { list: BrandList; filter: string; hits: Hit[] } | null = null;

  function brandHits(list: BrandList, filter: string): Hit[] {
    if (lastHits === null || lastHits.list !== list || lastHits.filter !== filter) {
      const hits = narrow(brandOptions(list), filter, (a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name));
      lastHits = { list, filter, hits };
    }

    return lastHits.hits;
  }

  // Without a filter the section lists what is on, so a brand can be turned
  // off from here; with one it searches the whole list.
  function brandRows(vm: SourcePickerVm, enabled: Set<string>): HTMLLIElement[] {
    const brands = vm.brands;

    if (brands.kind === 'idle') {
      return [];
    }

    if (brands.kind === 'loading') {
      return [hintRow('source-index-status', 'Loading brands…', { 'data-state': 'loading' })];
    }

    if (brands.kind === 'failed') {
      return [hintRow('source-index-status', "Couldn't load the brand list. Reload to retry.", { 'data-state': 'failed', title: brands.message })];
    }

    const { list } = brands;

    if (searchKey(vm.filter) === '') {
      const on = vm.enabled.flatMap((source) => {
        const id = brandIdOf(source);
        return id === null ? [] : [option(source, sourceLabel(source, list), [source], brandEntry(list, id)?.count)];
      });
      on.sort((a, b) => a.name.localeCompare(b.name));

      return [
        ...on.map((o) => rowFor({ option: o, indices: [] }, enabled)),
        hintRow('source-brands-hint', `Type above to search ${list.brands.length.toLocaleString()} brands.`),
      ];
    }

    const matches = brandHits(list, vm.filter);
    const shown = matches.slice(0, BRAND_MATCH_CAP).map((hit) => rowFor(hit, enabled));

    if (matches.length > BRAND_MATCH_CAP) {
      shown.push(hintRow('source-brands-hint', `Showing ${BRAND_MATCH_CAP} of ${matches.length.toLocaleString()} brands. Keep typing to narrow.`));
    }

    return shown;
  }

  const sectionRows: Record<Section, (vm: SourcePickerVm, enabled: Set<string>) => HTMLLIElement[]> = {
    usda: staticRows,
    brands: brandRows,
    stores: storeRows,
  };

  function render(vm: SourcePickerVm): void {
    disclosure.update({ label: `Sources (${vm.enabled.length} on)`, expanded: vm.expanded });

    panel.hidden = !vm.expanded;
    setInputValue(filterInput, vm.filter);

    if (!vm.expanded) {
      return;
    }

    const enabled = new Set(vm.enabled);
    const desired = (Object.keys(SECTIONS) as Section[]).flatMap((section) => {
      const items = sectionRows[section](vm, enabled);
      return items.length === 0 ? [] : [headers.get(section), ...items];
    });

    if (desired.length === 0) {
      list.replaceChildren(hintRow('source-filter-empty', 'No sources match.'));
      return;
    }

    reconcileChildren(list, desired);
    rows.prune(desired.map((li) => li.getAttribute('data-source')).filter((s): s is string => s !== null));
  }

  return { node, render };
}
