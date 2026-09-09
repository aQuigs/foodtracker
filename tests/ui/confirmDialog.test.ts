import { expect } from '@esm-bundle/chai';
import { createConfirmDialog } from '../../src/ui/confirmDialog.js';
import { makeContainer } from '../_helpers.js';

const noop = { onConfirm: () => {}, onCancel: () => {} };

describe('ui — confirm dialog', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('is described by the question it asks, so what is being deleted is announced with it', () => {
    const { node, render } = createConfirmDialog(noop);
    container.append(node);
    render('Delete Banana, 120 g from this day?');

    expect(node.getAttribute('role'), 'a destructive confirmation is an alertdialog').to.equal('alertdialog');

    const message = node.querySelector('[data-testid="delete-confirm-message"]') as HTMLElement;
    expect(message.textContent).to.contain('Banana');
    expect(message.id).to.not.equal('');
    expect(node.getAttribute('aria-describedby'), 'the dialog points at its message').to.equal(message.id);
  });

  it('gives every dialog its own message id, since aria-describedby resolves across the document', () => {
    const a = createConfirmDialog(noop);
    const b = createConfirmDialog(noop);
    container.append(a.node, b.node);

    expect(a.node.getAttribute('aria-describedby')).to.not.equal(b.node.getAttribute('aria-describedby'));
  });
});
