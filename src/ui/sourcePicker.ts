import {
  STORE_BUNDLES, brandIdOf, brandSource, isHouseBrand, labelSearchKey, sourceLabel,
  type BrandDirectory, type BrandEntry,
} from '../domain/foodSources.js';
import { searchKey } from '../domain/searchKey.js';
import { byRank, fuzzyMatch } from './search.js';
import { renderHighlighted } from './highlight.js';
import type { Range } from './ranges.js';
import { el, reconcileChildren, setInputValue } from './dom.js';
import { cappedListHint, hintRow } from './hintRow.js';
import { disclosureButton } from './disclosure.js';
import { keyedRows } from './keyedRows.js';

export type BrandListVm =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; brands: BrandDirectory }
  | { kind: 'failed'; message: string };

export type SourcePickerVm = {
  // The static sources main.ts wired, in registry order.
  sources: string[];
  // Everything on, as the enabled list names it: static sources, stores and
  // brand sources.
  enabled: ReadonlyArray<string>;
  // idle until the picker first asks for the brand list, and for good when
  // no catalog is wired; the Brands section stays out meanwhile.
  brands: BrandListVm;
  expanded: boolean;
  filter: string;
};

export type SourcePickerHandlers = {
  onToggle(): void;
  onFilterChange(q: string): void;
  // The one name a row stands for: a static source, a brand source or a
  // store id.
  onSourceChange(source: string, enabled: boolean): void;
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

// A row: the one name it turns on (its id), what the filter matches it on,
// and — for a brand the list names — its list entry.
type Option = { id: string; name: string; matchKey: string; entry?: BrandEntry };
type Hit = { option: Option; indices: ReadonlyArray<Range> };
type SourceRow = { li: HTMLLIElement; checkbox: HTMLInputElement; labelSpan: HTMLSpanElement; countSpan: HTMLSpanElement };

function option(id: string, name: string, entry?: BrandEntry): Option {
  return { id, name, matchKey: labelSearchKey(name), ...(entry === undefined ? {} : { entry }) };
}

const STORE_OPTIONS: Option[] = [...STORE_BUNDLES].map(([id, bundle]) => option(id, bundle.label));

// A brand the build lists but ships no rows for (too few to be worth a
// download) is still findable, so a search for it says why it cannot be
// turned on instead of finding nothing.
function isListedOnly(entry: BrandEntry): boolean {
  return !entry.included;
}

function countText(entry: BrandEntry): string {
  const count = entry.count.toLocaleString();

  if (isListedOnly(entry)) {
    return `not included (${count} ${entry.count === 1 ? 'item' : 'items'})`;
  }

  return count;
}

// fuzzyMatch keeps its input order and the sort is stable, so without a
// tie-break equal ranks stay in the order the options came in.
function narrow(options: Option[], filter: string, tieBreak: (a: Option, b: Option) => number = () => 0): Hit[] {
  const matches = fuzzyMatch(options, filter);
  matches.sort(byRank(tieBreak));
  return matches.map(({ food, indices }) => ({ option: food, indices }));
}

function byCountThenName(a: Option, b: Option): number {
  return (b.entry?.count ?? 0) - (a.entry?.count ?? 0) || a.name.localeCompare(b.name);
}

function sectionHeader(section: Section): HTMLLIElement {
  return el('li', { 'data-testid': 'source-section', 'data-section': section, class: 'source-section' }, [SECTIONS[section]]);
}

export function createSourcePicker(handlers: SourcePickerHandlers): SourcePicker {
  const filterInput = el('input', {
    type: 'search', class: 'search-input', 'data-testid': 'source-filter-input',
    placeholder: 'Filter sources', 'aria-label': 'Filter sources',
  });
  filterInput.addEventListener('input', () => handlers.onFilterChange(filterInput.value));

  const list = el('ul', { 'data-testid': 'source-list', class: 'scroll-list' });
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

  const headers: Record<Section, HTMLLIElement> = {
    usda: sectionHeader('usda'),
    brands: sectionHeader('brands'),
    stores: sectionHeader('stores'),
  };

  // Keyed by source and kept while a row stays listed, so a checkbox
  // mid-click keeps its focus across the re-render that click causes.
  const rows = keyedRows<SourceRow>((source) => {
    const checkbox = el('input', { type: 'checkbox', 'data-testid': 'source-checkbox' });
    const labelSpan = el('span', {});
    const countSpan = el('span', { class: 'source-count' });
    const li = el('li', { 'data-testid': 'source-option', 'data-source': source, class: 'source-option' }, [
      el('label', {}, [checkbox, labelSpan, countSpan]),
    ]);

    checkbox.addEventListener('change', () => handlers.onSourceChange(source, checkbox.checked));
    return { li, checkbox, labelSpan, countSpan };
  });

  // A listed-only brand that is somehow on stays free to be turned off.
  function rowFor(hit: Hit, enabled: Set<string>): HTMLLIElement {
    const { option, indices } = hit;
    const { entry } = option;
    const row = rows.get(option.id);

    row.checkbox.checked = enabled.has(option.id);
    row.checkbox.disabled = entry !== undefined && isListedOnly(entry) && !row.checkbox.checked;
    row.labelSpan.replaceChildren(...renderHighlighted(option.name, indices));

    if (entry === undefined) {
      row.countSpan.textContent = '';
      row.li.removeAttribute('data-count');
    } else {
      row.countSpan.textContent = countText(entry);
      row.li.setAttribute('data-count', String(entry.count));
    }

    return row.li;
  }

  function listedRows(options: Option[], filter: string, enabled: Set<string>): HTMLLIElement[] {
    return narrow(options, filter).map((hit) => rowFor(hit, enabled));
  }

  // Matching a filter against tens of thousands of brands is the one costly
  // step of a render, and the picker re-renders on every paint while open —
  // a download's progress, a toggle — with the filter unchanged. Kept for
  // as long as its inputs hold.
  let lastHits: { brands: BrandDirectory; filter: string; hits: Hit[] } | null = null;

  function brandHits(brands: BrandDirectory, filter: string): Hit[] {
    if (lastHits === null || lastHits.brands !== brands || lastHits.filter !== filter) {
      const options = brands.searchable.map(({ entry, matchKey }) => ({ id: brandSource(entry.id), name: entry.label, matchKey, entry }));
      lastHits = { brands, filter, hits: narrow(options, filter, byCountThenName) };
    }

    return lastHits.hits;
  }

  // Without a filter the section lists what is on, so a brand can be turned
  // off from here; with one it searches the whole list.
  function brandRows(vm: SourcePickerVm, enabled: Set<string>): HTMLLIElement[] {
    const status = vm.brands;

    if (status.kind === 'idle') {
      return [];
    }

    if (status.kind === 'loading') {
      return [hintRow('source-index-status', 'Loading brands…', { 'data-state': 'loading' })];
    }

    if (status.kind === 'failed') {
      return [hintRow('source-index-status', "Couldn't load the brand list. Type a filter or reopen Sources to retry.", { 'data-state': 'failed', title: status.message })];
    }

    const { brands } = status;

    if (searchKey(vm.filter) === '') {
      const on = vm.enabled.flatMap((source) => {
        const id = brandIdOf(source);
        if (id === null || isHouseBrand(id)) {
          return [];
        }

        const entry = brands.byId.get(id);
        return [option(source, entry?.label ?? sourceLabel(source), entry)];
      });
      on.sort((a, b) => a.name.localeCompare(b.name));

      return [
        ...on.map((o) => rowFor({ option: o, indices: [] }, enabled)),
        hintRow('source-brands-hint', `Type above to search ${brands.searchable.length.toLocaleString()} brands.`),
      ];
    }

    const matches = brandHits(brands, vm.filter);
    const shown = matches.slice(0, BRAND_MATCH_CAP).map((hit) => rowFor(hit, enabled));

    if (matches.length > BRAND_MATCH_CAP) {
      shown.push(cappedListHint('source-brands-hint', BRAND_MATCH_CAP, matches.length, 'brands'));
    }

    return shown;
  }

  const sectionRows: Record<Section, (vm: SourcePickerVm, enabled: Set<string>) => HTMLLIElement[]> = {
    usda: (vm, enabled) => listedRows(vm.sources.map((s) => option(s, sourceLabel(s))), vm.filter, enabled),
    brands: brandRows,
    stores: (vm, enabled) => listedRows(STORE_OPTIONS, vm.filter, enabled),
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
      return items.length === 0 ? [] : [headers[section], ...items];
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
