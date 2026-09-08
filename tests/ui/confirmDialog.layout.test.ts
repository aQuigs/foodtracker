import { expect } from '@esm-bundle/chai';
import { createConfirmDialog } from '../../src/ui/confirmDialog.js';
import { loadStyles, makeContainer } from '../_helpers.js';

const noop = { onConfirm: () => {}, onCancel: () => {} };

// The card's width on a 375px phone once its own gutter is taken off.
const PHONE_CARD_WIDTH = '311px';

// The browser's largest text setting: two buttons at this size are wider
// than the card.
const ZOOMED_TEXT = '32px';

describe('ui — confirm dialog layout', () => {
  let container: HTMLElement;
  before(loadStyles);
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => {
    document.documentElement.style.fontSize = '';
    container.remove();
  });

  it('keeps both buttons inside the card when they no longer fit side by side', () => {
    const { node, render } = createConfirmDialog(noop);
    container.append(node);
    node.style.width = PHONE_CARD_WIDTH;
    document.documentElement.style.fontSize = ZOOMED_TEXT;
    render('Delete Banana, 120 g from this day?');

    const card = node.getBoundingClientRect();
    for (const testid of ['delete-confirm-cancel', 'delete-confirm-yes']) {
      const button = (node.querySelector(`[data-testid="${testid}"]`) as HTMLElement).getBoundingClientRect();
      expect(button.left, `${testid} left edge`).to.be.at.least(card.left);
      expect(button.right, `${testid} right edge`).to.be.at.most(card.right);
    }

    render(null);
  });
});
