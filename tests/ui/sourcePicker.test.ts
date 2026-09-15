import { expect } from '@esm-bundle/chai';
import { createSourcePicker, type SourcePickerHandlers, type SourcePickerVm } from '../../src/ui/sourcePicker.js';
import { bundleSources } from '../../src/domain/foodSources.js';
import { makeContainer } from '../_helpers.js';
import { brandRow, fakeIndex } from '../brandsFakes.js';

function noopHandlers(): SourcePickerHandlers {
  return { onToggle: () => {}, onFilterChange: () => {}, onSourcesChange: () => {} };
}

const INDEX = fakeIndex([
  { id: 'chobani', label: 'Chobani', rows: [brandRow('chobani', 'Chobani', '1', 'Greek Yogurt'), brandRow('chobani', 'Chobani', '2', 'Oat Milk')] },
  { id: 'chobani-complete', label: 'Chobani Complete', rows: [brandRow('chobani-complete', 'Chobani Complete', '3', 'Vanilla')] },
  { id: 'kirkland-signature', label: 'Kirkland Signature', rows: [brandRow('kirkland-signature', 'Kirkland Signature', '4', 'Almonds')] },
  { id: 'heb', label: 'H-E-B', rows: [brandRow('heb', 'H-E-B', '5', 'Tortillas')] },
]);

function vm(overrides: Partial<SourcePickerVm> = {}): SourcePickerVm {
  return {
    sources: ['usda', 'usda-full'],
    enabled: ['usda', 'usda-full'],
    brands: { kind: 'idle' },
    expanded: true,
    filter: '',
    ...overrides,
  };
}

function options(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>('[data-testid="source-option"]'));
}

function sourcesOf(node: HTMLElement): (string | null)[] {
  return options(node).map((r) => r.getAttribute('data-source'));
}

function sectionsOf(node: HTMLElement): (string | null)[] {
  return Array.from(node.querySelectorAll('[data-testid="source-section"]')).map((s) => s.getAttribute('data-section'));
}

function checkbox(node: HTMLElement, source: string): HTMLInputElement {
  return node.querySelector(`[data-source="${source}"] [data-testid="source-checkbox"]`) as HTMLInputElement;
}

const STORE_IDS = ['costco', 'heb', 'kroger', 'meijer', 'publix', 'safeway', 'sams-club', 'target', 'trader-joes', 'walmart', 'wegmans', 'whole-foods'];

describe('ui — source picker', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('shows the collapsed disclosure with how many sources are on', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['usda', 'brand:chobani', 'brand:heb'], expanded: false }));

    const toggle = node.querySelector('[data-testid="source-picker-toggle"]')!;
    expect(toggle.textContent).to.include('Sources (3 on)');
    expect(toggle.textContent).to.include('▸');
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
  });

  it('flips the glyph and aria-expanded when expanded', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['usda'] }));

    const toggle = node.querySelector('[data-testid="source-picker-toggle"]')!;
    expect(toggle.textContent).to.include('▾');
    expect(toggle.textContent).to.include('Sources (1 on)');
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
  });

  it('fires onToggle when the disclosure is clicked', () => {
    let fired = 0;
    const { node, render } = createSourcePicker({ ...noopHandlers(), onToggle: () => { fired++; } });
    container.append(node);
    render(vm({ expanded: false }));

    (node.querySelector('[data-testid="source-picker-toggle"]') as HTMLButtonElement).click();
    expect(fired).to.equal(1);
  });

  it('hides the panel when collapsed and shows it when expanded', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);

    render(vm({ expanded: false }));
    const panel = node.querySelector('[data-testid="source-picker-panel"]') as HTMLElement;
    expect(panel.hidden).to.equal(true);

    render(vm({ expanded: true }));
    expect(panel.hidden).to.equal(false);
  });

  it('lists the static sources under USDA in wired order, then every store under Stores', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['usda-full'] }));

    expect(sectionsOf(node)).to.deep.equal(['usda', 'stores']);
    expect(sourcesOf(node)).to.deep.equal(['usda', 'usda-full', ...STORE_IDS]);
    expect(checkbox(node, 'usda').checked).to.equal(false);
    expect(checkbox(node, 'usda-full').checked).to.equal(true);
  });

  it('checks a store when all its brands are on, and marks it indeterminate when only some are', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['brand:members-mark', 'brand:kirkland-signature'] }));

    const samsClub = checkbox(node, 'sams-club');
    expect(samsClub.checked).to.equal(true);
    expect(samsClub.indeterminate).to.equal(false);

    const costco = checkbox(node, 'costco');
    expect(costco.checked).to.equal(false);
    expect(costco.indeterminate).to.equal(true);

    const target = checkbox(node, 'target');
    expect(target.checked).to.equal(false);
    expect(target.indeterminate).to.equal(false);
  });

  it('fires onSourcesChange with the sources a row stands for and the new checked state: one for a static source or a brand, the bundle for a store', () => {
    let captured: [string[], boolean] | null = null;
    const { node, render } = createSourcePicker({
      ...noopHandlers(),
      onSourcesChange: (sources, enabled) => { captured = [sources, enabled]; },
    });
    container.append(node);
    render(vm({ enabled: ['usda', 'brand:chobani'], brands: { kind: 'ready', index: INDEX } }));

    checkbox(node, 'costco').click();
    expect(captured).to.deep.equal([bundleSources('costco'), true]);

    checkbox(node, 'usda').click();
    expect(captured).to.deep.equal([['usda'], false]);

    checkbox(node, 'brand:chobani').click();
    expect(captured).to.deep.equal([['brand:chobani'], false]);
  });

  it('narrows every section by fuzzy match on the label with highlights, dropping sections with no match', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    // Wired order is usda, usda-full — labels "Everyday foods" / "All USDA
    // foods" would sort the other way alphabetically, so this also proves
    // the tiebreak is wired order, not label order.
    render(vm({ enabled: [], filter: 'foods' }));

    expect(sectionsOf(node)).to.deep.equal(['usda', 'stores']);
    expect(sourcesOf(node)).to.deep.equal(['usda', 'usda-full', 'whole-foods']);
    expect(options(node).every((r) => r.querySelector('mark') !== null)).to.equal(true);

    render(vm({ enabled: [], filter: 'costco' }));
    expect(sectionsOf(node)).to.deep.equal(['stores']);
    expect(sourcesOf(node)).to.deep.equal(['costco']);
  });

  // "H-E-B" and "Sam's Club" fold to "h e b" / "sam s club" by search key
  // alone, so the filter has to collapse the punctuation the way a person
  // spells the label.
  for (const [filter, source] of [['heb', 'heb'], ['sams club', 'sams-club'], ['joes', 'trader-joes']] as const) {
    it(`finds a punctuated store label from the unpunctuated "${filter}"`, () => {
      const { node, render } = createSourcePicker(noopHandlers());
      container.append(node);
      render(vm({ enabled: [], filter }));

      expect(sourcesOf(node)).to.deep.equal([source]);
    });
  }

  it('leaves the Brands section out when no brand catalog is wired', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ brands: { kind: 'idle' } }));

    expect(sectionsOf(node)).to.not.include('brands');
    expect(node.querySelector('[data-testid="source-index-status"]')).to.equal(null);
  });

  it('shows the Brands section loading, then failed with the reason as a tooltip', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);

    render(vm({ brands: { kind: 'loading' } }));
    expect(sectionsOf(node)).to.deep.equal(['usda', 'brands', 'stores']);
    const loading = node.querySelector('[data-testid="source-index-status"]')!;
    expect(loading.getAttribute('data-state')).to.equal('loading');
    expect(loading.textContent).to.equal('Loading brands…');

    render(vm({ brands: { kind: 'failed', message: 'HTTP 500' } }));
    const failed = node.querySelector('[data-testid="source-index-status"]')!;
    expect(failed.getAttribute('data-state')).to.equal('failed');
    expect(failed.textContent).to.equal("Couldn't load the brand list. Reload to retry.");
    expect(failed.getAttribute('title')).to.equal('HTTP 500');
  });

  it('with no filter, lists only the brands that are on — by label, with their counts — and how to find more', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['usda', 'brand:kirkland-signature', 'brand:chobani'], brands: { kind: 'ready', index: INDEX } }));

    const brandRows = options(node).filter((r) => r.getAttribute('data-source')!.startsWith('brand:'));
    expect(brandRows.map((r) => r.getAttribute('data-source'))).to.deep.equal(['brand:chobani', 'brand:kirkland-signature']);
    expect(brandRows.map((r) => r.getAttribute('data-count'))).to.deep.equal(['2', '1']);
    expect(brandRows.map((r) => r.querySelector('label')!.textContent)).to.deep.equal(['Chobani2', 'Kirkland Signature1']);
    expect(brandRows.every((r) => (r.querySelector('[data-testid="source-checkbox"]') as HTMLInputElement).checked)).to.equal(true);

    const hint = node.querySelector('[data-testid="source-brands-hint"]')!;
    expect(hint.textContent).to.equal('Type above to search 4 brands.');
  });

  it('names a brand that is on but missing from the index by its id', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['brand:nature-valley'], brands: { kind: 'ready', index: INDEX } }));

    const row = options(node).find((r) => r.getAttribute('data-source') === 'brand:nature-valley')!;
    expect(row.querySelector('label')!.textContent).to.equal('Nature Valley');
    expect(row.hasAttribute('data-count')).to.equal(false);
  });

  it('with a filter, searches the whole index: bigger brands first among equal ranks, highlighted, with checked state', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['brand:chobani-complete'], brands: { kind: 'ready', index: INDEX }, filter: 'chobani' }));

    expect(sectionsOf(node)).to.deep.equal(['brands']);
    expect(sourcesOf(node)).to.deep.equal(['brand:chobani', 'brand:chobani-complete']);
    expect(options(node).every((r) => r.querySelector('mark') !== null)).to.equal(true);
    expect(checkbox(node, 'brand:chobani').checked).to.equal(false);
    expect(checkbox(node, 'brand:chobani-complete').checked).to.equal(true);
    expect(node.querySelector('[data-testid="source-brands-hint"]')).to.equal(null);
  });

  it('finds a punctuated brand from the spelling a person types, ahead of the store of the same name', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: [], brands: { kind: 'ready', index: INDEX }, filter: 'heb' }));

    expect(sourcesOf(node)).to.deep.equal(['brand:heb', 'heb']);
  });

  it('with no filter, puts the brands that are on and the search hint ahead of the store list', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['usda', 'brand:chobani'], brands: { kind: 'ready', index: INDEX } }));

    expect(sectionsOf(node)).to.deep.equal(['usda', 'brands', 'stores']);
    expect(sourcesOf(node).slice(0, 4)).to.deep.equal(['usda', 'usda-full', 'brand:chobani', 'costco']);
    const items = Array.from(node.querySelectorAll('[data-testid="source-option"], [data-testid="source-brands-hint"]'));
    expect(items.map((el) => el.getAttribute('data-testid')).indexOf('source-brands-hint')).to.equal(3);
  });

  it('caps brand matches and says how many more there are', () => {
    const many = fakeIndex(Array.from({ length: 30 }, (_, i) => ({
      id: `acme-${i}`, label: `Acme ${i}`, rows: Array.from({ length: i + 1 }, (_, j) => brandRow(`acme-${i}`, `Acme ${i}`, `${i}-${j}`, `Thing ${j}`)),
    })));
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: [], brands: { kind: 'ready', index: many }, filter: 'acme' }));

    const shown = sourcesOf(node);
    expect(shown).to.have.lengthOf(25);
    expect(shown[0]).to.equal('brand:acme-29');
    expect(shown[24]).to.equal('brand:acme-5');
    expect(node.querySelector('[data-testid="source-brands-hint"]')!.textContent).to.equal('Showing 25 of 30 brands. Keep typing to narrow.');
  });

  it('shows an empty state when the filter matches nothing anywhere', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: [], brands: { kind: 'ready', index: INDEX }, filter: 'zzznotasource' }));

    expect(node.querySelector('[data-testid="source-option"]')).to.equal(null);
    expect(node.querySelector('[data-testid="source-section"]')).to.equal(null);
    const empty = node.querySelector('[data-testid="source-filter-empty"]')!;
    expect(empty.textContent).to.equal('No sources match.');
  });

  it('keeps the loading status, not the empty state, while the index is still on its way', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: [], brands: { kind: 'loading' }, filter: 'zzznotasource' }));

    expect(node.querySelector('[data-testid="source-filter-empty"]')).to.equal(null);
    expect(sectionsOf(node)).to.deep.equal(['brands']);
    expect(node.querySelector('[data-testid="source-index-status"]')!.getAttribute('data-state')).to.equal('loading');
  });

  it('does not reset the caret when re-rendered with an unchanged filter value', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ filter: 'apple' }));

    const input = node.querySelector('[data-testid="source-filter-input"]') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(2, 2);

    render(vm({ filter: 'apple' }));
    expect(input.selectionStart).to.equal(2);
  });

  it('keeps focus on the toggle across the re-render its own click triggers', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ expanded: false }));

    const toggle = node.querySelector('[data-testid="source-picker-toggle"]') as HTMLButtonElement;
    toggle.focus();
    toggle.click();
    render(vm({ expanded: true }));

    const stillFocused = document.activeElement === node.querySelector('[data-testid="source-picker-toggle"]');
    expect(stillFocused, 'toggle should keep focus across the re-render').to.equal(true);
  });

  it('keeps focus on a brand checkbox across the re-render its own click triggers', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['usda'], brands: { kind: 'ready', index: INDEX }, filter: 'chobani' }));

    const box = checkbox(node, 'brand:chobani');
    box.focus();
    box.click();
    render(vm({ enabled: ['usda', 'brand:chobani'], brands: { kind: 'ready', index: INDEX }, filter: 'chobani' }));

    const stillFocused = document.activeElement === checkbox(node, 'brand:chobani');
    expect(stillFocused, 'checkbox should keep focus across the re-render').to.equal(true);
  });

  it('fires onFilterChange as the filter input changes', () => {
    let captured = '';
    const { node, render } = createSourcePicker({ ...noopHandlers(), onFilterChange: (q) => { captured = q; } });
    container.append(node);
    render(vm());

    const input = node.querySelector('[data-testid="source-filter-input"]') as HTMLInputElement;
    input.value = 'cos';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.equal('cos');
  });
});
