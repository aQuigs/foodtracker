import { expect } from '@esm-bundle/chai';
import { createToggleGroup } from '../../src/ui/toggleGroup.js';

type Size = 'small' | 'large';

const OPTIONS = [
  { value: 'small' as Size, label: 'S' },
  { value: 'large' as Size, label: 'L' },
];

function buttons(node: HTMLElement): HTMLButtonElement[] {
  return Array.from(node.querySelectorAll('button'));
}

describe('createToggleGroup', () => {
  it('renders one button per option carrying its value and label', () => {
    const group = createToggleGroup<Size>({ testid: 'size', ariaLabel: 'Size', options: OPTIONS });
    group.render({ selected: null, onPick: () => {} });

    expect(group.node.getAttribute('data-testid')).to.equal('size');
    expect(group.node.getAttribute('role')).to.equal('group');
    expect(buttons(group.node).map((b) => b.getAttribute('data-value'))).to.deep.equal(['small', 'large']);
    expect(buttons(group.node).map((b) => b.textContent)).to.deep.equal(['S', 'L']);
  });

  it('uses a custom value attribute when asked', () => {
    const group = createToggleGroup<Size>({ testid: 'size', ariaLabel: 'Size', options: OPTIONS, valueAttr: 'data-size' });
    group.render({ selected: null, onPick: () => {} });
    expect(buttons(group.node).map((b) => b.getAttribute('data-size'))).to.deep.equal(['small', 'large']);
  });

  it('marks the selected option active and pressed', () => {
    const group = createToggleGroup<Size>({ testid: 'size', ariaLabel: 'Size', options: OPTIONS });
    group.render({ selected: 'large', onPick: () => {} });

    const [small, large] = buttons(group.node);
    expect(large!.getAttribute('data-active')).to.equal('true');
    expect(large!.getAttribute('aria-pressed')).to.equal('true');
    expect(small!.hasAttribute('data-active')).to.equal(false);
    expect(small!.getAttribute('aria-pressed')).to.equal('false');
  });

  it('disables options outside the enabled set and ignores their clicks', () => {
    const picked: Size[] = [];
    const group = createToggleGroup<Size>({ testid: 'size', ariaLabel: 'Size', options: OPTIONS });
    group.render({ selected: null, enabled: ['small'], onPick: (v) => picked.push(v) });

    const [small, large] = buttons(group.node);
    expect(large!.disabled).to.equal(true);
    expect(small!.disabled).to.equal(false);
    large!.click();
    small!.click();
    expect(picked).to.deep.equal(['small']);
  });

  it('re-renders in place so a focused button keeps focus', () => {
    const group = createToggleGroup<Size>({ testid: 'size', ariaLabel: 'Size', options: OPTIONS });
    document.body.append(group.node);
    try {
      group.render({ selected: 'small', onPick: () => {} });
      const large = buttons(group.node)[1]!;
      large.focus();
      group.render({ selected: 'large', onPick: () => {} });
      expect(document.activeElement).to.equal(large);
      expect(large.getAttribute('data-active')).to.equal('true');
    } finally {
      group.node.remove();
    }
  });
});
