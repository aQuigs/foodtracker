import { expect } from '@esm-bundle/chai';
import { createSourcePicker, type SourcePickerHandlers, type SourcePickerVm } from '../../src/ui/sourcePicker.js';
import { makeContainer } from '../_helpers.js';
import { brandRow, fakeBrandList } from '../brandsFakes.js';

function noopHandlers(): SourcePickerHandlers {
  return { onToggle: () => {}, onFilterChange: () => {}, onSourceChange: () => {} };
}

function rows(id: string, label: string, n: number) {
  return Array.from({ length: n }, (_, i) => brandRow(id, label, `${i}`, `Item ${i}`));
}

// Kirkland Signature and H-E-B are house brands of Costco and H-E-B; Tiny Co
// and Tinier Foods were listed without rows.
const LIST = fakeBrandList([
  { id: 'chobani', label: 'Chobani', rows: rows('chobani', 'Chobani', 2) },
  { id: 'chobani-complete', label: 'Chobani Complete', rows: rows('chobani-complete', 'Chobani Complete', 1) },
  { id: 'lays', label: "Lay's", rows: rows('lays', "Lay's", 2) },
  { id: 'kirkland-signature', label: 'Kirkland Signature', rows: rows('kirkland-signature', 'Kirkland Signature', 1) },
  { id: 'heb', label: 'H-E-B', rows: rows('heb', 'H-E-B', 1) },
  { id: 'tiny-co', label: 'Tiny Co', rows: rows('tiny-co', 'Tiny Co', 1), listedOnly: true },
  { id: 'tinier', label: 'Tinier Foods', rows: rows('tinier', 'Tinier Foods', 3), listedOnly: true },
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
    render(vm({ enabled: ['usda', 'brand:chobani', 'costco'], expanded: false }));

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

  it('checks a store by its own id and never shows one partly on, whatever house brand is on by itself', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['sams-club', 'brand:kirkland-signature'] }));

    expect(checkbox(node, 'sams-club').checked).to.equal(true);
    expect(checkbox(node, 'costco').checked).to.equal(false);

    for (const row of options(node)) {
      expect((row.querySelector('[data-testid="source-checkbox"]') as HTMLInputElement).indeterminate, row.textContent!).to.equal(false);
    }
  });

  it('fires onSourceChange with the one name a row stands for and the new checked state', () => {
    let captured: [string, boolean] | null = null;
    const { node, render } = createSourcePicker({
      ...noopHandlers(),
      onSourceChange: (source, enabled) => { captured = [source, enabled]; },
    });
    container.append(node);
    render(vm({ enabled: ['usda', 'brand:chobani'], brands: { kind: 'ready', list: LIST } }));

    checkbox(node, 'costco').click();
    expect(captured).to.deep.equal(['costco', true]);

    checkbox(node, 'usda').click();
    expect(captured).to.deep.equal(['usda', false]);

    checkbox(node, 'brand:chobani').click();
    expect(captured).to.deep.equal(['brand:chobani', false]);
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
    render(vm({ enabled: ['usda', 'brand:lays', 'brand:chobani'], brands: { kind: 'ready', list: LIST } }));

    const brandRows = options(node).filter((r) => r.getAttribute('data-source')!.startsWith('brand:'));
    expect(brandRows.map((r) => r.getAttribute('data-source'))).to.deep.equal(['brand:chobani', 'brand:lays']);
    expect(brandRows.map((r) => r.getAttribute('data-count'))).to.deep.equal(['2', '2']);
    expect(brandRows.map((r) => r.querySelector('label')!.textContent)).to.deep.equal(['Chobani2', "Lay's2"]);
    expect(brandRows.every((r) => (r.querySelector('[data-testid="source-checkbox"]') as HTMLInputElement).checked)).to.equal(true);

    const hint = node.querySelector('[data-testid="source-brands-hint"]')!;
    expect(hint.textContent).to.equal('Type above to search 5 brands.');
  });

  it('names a brand that is on but missing from the brand list by its id', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['brand:nature-valley'], brands: { kind: 'ready', list: LIST } }));

    const row = options(node).find((r) => r.getAttribute('data-source') === 'brand:nature-valley')!;
    expect(row.querySelector('label')!.textContent).to.equal('Nature Valley');
    expect(row.hasAttribute('data-count')).to.equal(false);
  });

  it('with a filter, searches the whole brand list: bigger brands first among equal ranks, highlighted, with checked state', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['brand:chobani-complete'], brands: { kind: 'ready', list: LIST }, filter: 'chobani' }));

    expect(sectionsOf(node)).to.deep.equal(['brands']);
    expect(sourcesOf(node)).to.deep.equal(['brand:chobani', 'brand:chobani-complete']);
    expect(options(node).every((r) => r.querySelector('mark') !== null)).to.equal(true);
    expect(checkbox(node, 'brand:chobani').checked).to.equal(false);
    expect(checkbox(node, 'brand:chobani-complete').checked).to.equal(true);
    expect(node.querySelector('[data-testid="source-brands-hint"]')).to.equal(null);
  });

  it('finds a punctuated brand from the spelling a person types', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: [], brands: { kind: 'ready', list: LIST }, filter: 'lays' }));

    expect(sourcesOf(node)).to.deep.equal(['brand:lays']);
  });

  it('never lists a store\'s house brand under Brands, found by a filter or on by itself', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);

    render(vm({ enabled: [], brands: { kind: 'ready', list: LIST }, filter: 'heb' }));
    expect(sourcesOf(node)).to.deep.equal(['heb']);

    render(vm({ enabled: [], brands: { kind: 'ready', list: LIST }, filter: 'kirkland' }));
    expect(sourcesOf(node)).to.deep.equal([]);

    render(vm({ enabled: ['brand:kirkland-signature'], brands: { kind: 'ready', list: LIST } }));
    expect(sourcesOf(node).filter((s) => s!.startsWith('brand:'))).to.deep.equal([]);
  });

  it('lists a brand shipped without rows in the same row as any other, its checkbox disabled and a note of what it holds', () => {
    let fired = 0;
    const { node, render } = createSourcePicker({ ...noopHandlers(), onSourceChange: () => { fired++; } });
    container.append(node);
    render(vm({ enabled: [], brands: { kind: 'ready', list: LIST }, filter: 'tin' }));

    expect(sourcesOf(node)).to.deep.equal(['brand:tinier', 'brand:tiny-co']);
    const counts = options(node).map((r) => r.querySelector('.source-count')!.textContent);
    expect(counts).to.deep.equal(['not included (3 items)', 'not included (1 item)']);
    expect(options(node).map((r) => r.getAttribute('data-count'))).to.deep.equal(['3', '1']);

    const box = checkbox(node, 'brand:tiny-co');
    expect(box.disabled).to.equal(true);
    expect(box.closest('label')!.children).to.have.lengthOf(3);
    box.click();
    expect(fired).to.equal(0);

    render(vm({ enabled: [], brands: { kind: 'ready', list: LIST }, filter: 'chobani' }));
    expect(checkbox(node, 'brand:chobani').disabled).to.equal(false);
    expect(node.querySelector('[data-source="brand:chobani"] .source-count')!.textContent).to.equal('2');
  });

  it('leaves a brand without rows that is still on free to be turned off', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['brand:tiny-co'], brands: { kind: 'ready', list: LIST } }));

    const box = checkbox(node, 'brand:tiny-co');
    expect(box.checked).to.equal(true);
    expect(box.disabled).to.equal(false);
    expect(node.querySelector('[data-source="brand:tiny-co"] .source-count')!.textContent).to.equal('not included (1 item)');
  });

  it('with no filter, puts the brands that are on and the search hint ahead of the store list', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: ['usda', 'brand:chobani'], brands: { kind: 'ready', list: LIST } }));

    expect(sectionsOf(node)).to.deep.equal(['usda', 'brands', 'stores']);
    expect(sourcesOf(node).slice(0, 4)).to.deep.equal(['usda', 'usda-full', 'brand:chobani', 'costco']);
    const items = Array.from(node.querySelectorAll('[data-testid="source-option"], [data-testid="source-brands-hint"]'));
    expect(items.map((el) => el.getAttribute('data-testid')).indexOf('source-brands-hint')).to.equal(3);
  });

  it('caps brand matches and says how many more there are', () => {
    const many = fakeBrandList(Array.from({ length: 30 }, (_, i) => ({
      id: `acme-${i}`, label: `Acme ${i}`, rows: Array.from({ length: i + 1 }, (_, j) => brandRow(`acme-${i}`, `Acme ${i}`, `${i}-${j}`, `Thing ${j}`)),
    })));
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: [], brands: { kind: 'ready', list: many }, filter: 'acme' }));

    const shown = sourcesOf(node);
    expect(shown).to.have.lengthOf(25);
    expect(shown[0]).to.equal('brand:acme-29');
    expect(shown[24]).to.equal('brand:acme-5');
    expect(node.querySelector('[data-testid="source-brands-hint"]')!.textContent).to.equal('Showing 25 of 30 brands. Keep typing to narrow.');
  });

  it('shows an empty state when the filter matches nothing anywhere', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render(vm({ enabled: [], brands: { kind: 'ready', list: LIST }, filter: 'zzznotasource' }));

    expect(node.querySelector('[data-testid="source-option"]')).to.equal(null);
    expect(node.querySelector('[data-testid="source-section"]')).to.equal(null);
    const empty = node.querySelector('[data-testid="source-filter-empty"]')!;
    expect(empty.textContent).to.equal('No sources match.');
  });

  it('keeps the loading status, not the empty state, while the brand list is still on its way', () => {
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
    render(vm({ enabled: ['usda'], brands: { kind: 'ready', list: LIST }, filter: 'chobani' }));

    const box = checkbox(node, 'brand:chobani');
    box.focus();
    box.click();
    render(vm({ enabled: ['usda', 'brand:chobani'], brands: { kind: 'ready', list: LIST }, filter: 'chobani' }));

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
