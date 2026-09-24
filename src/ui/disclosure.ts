import { el } from './dom.js';

export type DisclosureOptions = {
  testid: string;
  label: string;
  expanded: boolean;
  onToggle: () => void;
};

export type Disclosure = {
  node: HTMLButtonElement;
  update(next: { label: string; expanded: boolean }): void;
};

// A disclosure toggle: collapsed glyph plus label.
export function disclosureButton(opts: DisclosureOptions): Disclosure {
  const glyph = el('span', { 'aria-hidden': 'true' }, [opts.expanded ? '▾ ' : '▸ ']);
  const labelText = el('span', {}, [opts.label]);
  const node = el('button', {
    'data-testid': opts.testid,
    type: 'button',
    class: 'disclosure-toggle',
    'aria-expanded': opts.expanded ? 'true' : 'false',
  }, [glyph, labelText]);
  node.addEventListener('click', opts.onToggle);

  function update(next: { label: string; expanded: boolean }): void {
    node.setAttribute('aria-expanded', next.expanded ? 'true' : 'false');
    glyph.textContent = next.expanded ? '▾ ' : '▸ ';
    labelText.textContent = next.label;
  }

  return { node, update };
}
