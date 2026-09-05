import { expect } from '@esm-bundle/chai';
import { createSourcePicker } from '../../src/ui/sourcePicker.js';
import { makeContainer } from '../_helpers.js';

function noopHandlers(): {
  onToggle: () => void;
  onFilterChange: (q: string) => void;
  onSourceChange: (source: string, enabled: boolean) => void;
} {
  return { onToggle: () => {}, onFilterChange: () => {}, onSourceChange: () => {} };
}

describe('ui — source picker', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('shows the collapsed disclosure with an n-of-m count', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render({ sources: ['usda', 'usda-full', 'costco', 'heb'], enabled: ['usda', 'usda-full'], expanded: false, filter: '' });

    const toggle = node.querySelector('[data-testid="source-picker-toggle"]')!;
    expect(toggle.textContent).to.include('Sources (2 of 4)');
    expect(toggle.textContent).to.include('▸');
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
  });

  it('flips the glyph and aria-expanded when expanded', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render({ sources: ['usda', 'usda-full'], enabled: ['usda'], expanded: true, filter: '' });

    const toggle = node.querySelector('[data-testid="source-picker-toggle"]')!;
    expect(toggle.textContent).to.include('▾');
    expect(toggle.textContent).to.include('Sources (1 of 2)');
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
  });

  it('fires onToggle when the disclosure is clicked', () => {
    let fired = 0;
    const { node, render } = createSourcePicker({ ...noopHandlers(), onToggle: () => { fired++; } });
    container.append(node);
    render({ sources: ['usda'], enabled: ['usda'], expanded: false, filter: '' });

    (node.querySelector('[data-testid="source-picker-toggle"]') as HTMLButtonElement).click();
    expect(fired).to.equal(1);
  });

  it('hides the panel when collapsed and shows it when expanded', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);

    render({ sources: ['usda'], enabled: ['usda'], expanded: false, filter: '' });
    const panel = node.querySelector('[data-testid="source-picker-panel"]') as HTMLElement;
    expect(panel.hidden).to.equal(true);

    render({ sources: ['usda'], enabled: ['usda'], expanded: true, filter: '' });
    expect(panel.hidden).to.equal(false);
  });

  it('lists every wired source in wired order with its checked state', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render({ sources: ['usda', 'costco', 'heb'], enabled: ['heb'], expanded: true, filter: '' });

    const rows = Array.from(node.querySelectorAll('[data-testid="source-option"]'));
    expect(rows.map((r) => r.getAttribute('data-source'))).to.deep.equal(['usda', 'costco', 'heb']);

    const checkboxes = rows.map((r) => r.querySelector('[data-testid="source-checkbox"]') as HTMLInputElement);
    expect(checkboxes.map((c) => c.checked)).to.deep.equal([false, false, true]);
  });

  it('fires onSourceChange with the source and the new checked state', () => {
    let captured: [string, boolean] | null = null;
    const { node, render } = createSourcePicker({
      ...noopHandlers(),
      onSourceChange: (source, enabled) => { captured = [source, enabled]; },
    });
    container.append(node);
    render({ sources: ['usda', 'costco'], enabled: ['usda'], expanded: true, filter: '' });

    const costcoBox = node.querySelector('[data-source="costco"] [data-testid="source-checkbox"]') as HTMLInputElement;
    costcoBox.click();
    expect(captured).to.deep.equal(['costco', true]);

    const usdaBox = node.querySelector('[data-source="usda"] [data-testid="source-checkbox"]') as HTMLInputElement;
    usdaBox.click();
    expect(captured).to.deep.equal(['usda', false]);
  });

  it('narrows by fuzzy match on the label with highlights, keeping wired order among equal ranks', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    // Wired order is usda, usda-full — labels "Everyday foods" / "All USDA
    // foods" would sort the other way alphabetically, so this also proves
    // the tiebreak is wired order, not label order.
    render({ sources: ['usda', 'usda-full'], enabled: [], expanded: true, filter: 'foods' });

    const rows = Array.from(node.querySelectorAll('[data-testid="source-option"]'));
    expect(rows.map((r) => r.getAttribute('data-source'))).to.deep.equal(['usda', 'usda-full']);
    expect(rows.every((r) => r.querySelector('mark') !== null)).to.equal(true);
  });

  it('excludes non-matching sources from a filtered list', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render({ sources: ['usda', 'costco'], enabled: [], expanded: true, filter: 'costco' });

    const rows = Array.from(node.querySelectorAll('[data-testid="source-option"]'));
    expect(rows.map((r) => r.getAttribute('data-source'))).to.deep.equal(['costco']);
  });

  it('shows an empty state when the filter matches nothing', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render({ sources: ['usda', 'costco'], enabled: [], expanded: true, filter: 'zzznotasource' });

    expect(node.querySelector('[data-testid="source-option"]')).to.equal(null);
    const empty = node.querySelector('[data-testid="source-filter-empty"]')!;
    expect(empty.textContent).to.equal('No sources match.');
  });

  it('does not reset the caret when re-rendered with an unchanged filter value', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render({ sources: ['usda'], enabled: ['usda'], expanded: true, filter: 'apple' });

    const input = node.querySelector('[data-testid="source-filter-input"]') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(2, 2);

    render({ sources: ['usda'], enabled: ['usda'], expanded: true, filter: 'apple' });
    expect(input.selectionStart).to.equal(2);
  });

  it('keeps focus on the toggle across the re-render its own click triggers', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render({ sources: ['usda'], enabled: ['usda'], expanded: false, filter: '' });

    const toggle = node.querySelector('[data-testid="source-picker-toggle"]') as HTMLButtonElement;
    toggle.focus();
    toggle.click();
    render({ sources: ['usda'], enabled: ['usda'], expanded: true, filter: '' });

    const stillFocused = document.activeElement === node.querySelector('[data-testid="source-picker-toggle"]');
    expect(stillFocused, 'toggle should keep focus across the re-render').to.equal(true);
  });

  it('keeps focus on a checkbox across the re-render its own click triggers', () => {
    const { node, render } = createSourcePicker(noopHandlers());
    container.append(node);
    render({ sources: ['usda', 'costco'], enabled: ['usda'], expanded: true, filter: '' });

    const checkbox = node.querySelector('[data-source="costco"] [data-testid="source-checkbox"]') as HTMLInputElement;
    checkbox.focus();
    checkbox.click();
    render({ sources: ['usda', 'costco'], enabled: ['usda', 'costco'], expanded: true, filter: '' });

    const stillFocused = document.activeElement === node.querySelector('[data-source="costco"] [data-testid="source-checkbox"]');
    expect(stillFocused, 'checkbox should keep focus across the re-render').to.equal(true);
  });

  it('fires onFilterChange as the filter input changes', () => {
    let captured = '';
    const { node, render } = createSourcePicker({ ...noopHandlers(), onFilterChange: (q) => { captured = q; } });
    container.append(node);
    render({ sources: ['usda'], enabled: ['usda'], expanded: true, filter: '' });

    const input = node.querySelector('[data-testid="source-filter-input"]') as HTMLInputElement;
    input.value = 'cos';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.equal('cos');
  });
});
