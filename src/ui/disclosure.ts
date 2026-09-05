import { el } from './dom.js';

export type DisclosureOptions = {
  testid: string;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  attrs?: Record<string, string>;
};

export type Disclosure = {
  node: HTMLButtonElement;
  update(next: { label: string; expanded: boolean }): void;
};

// Shared by the source picker's own toggle and each catalog result fold
// header — same affordance (collapsed glyph + label + count), same class.
// `update` mutates the existing button in place, so a caller that keeps the
// button across renders (the source picker) never has to replace — and
// thereby de-focus — it.
export function disclosureButton(opts: DisclosureOptions): Disclosure {
  const glyph = el('span', { 'aria-hidden': 'true' }, [opts.expanded ? '▾ ' : '▸ ']);
  const labelText = el('span', {}, [opts.label]);
  const node = el('button', {
    'data-testid': opts.testid,
    type: 'button',
    class: 'disclosure-toggle',
    'aria-expanded': opts.expanded ? 'true' : 'false',
    ...(opts.attrs ?? {}),
  }, [glyph, labelText]);
  node.addEventListener('click', opts.onToggle);

  function update(next: { label: string; expanded: boolean }): void {
    node.setAttribute('aria-expanded', next.expanded ? 'true' : 'false');
    glyph.textContent = next.expanded ? '▾ ' : '▸ ';
    labelText.textContent = next.label;
  }

  return { node, update };
}
