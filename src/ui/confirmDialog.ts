import { el } from './dom.js';

export type ConfirmDialog = {
  node: HTMLDialogElement;
  render: (message: string | null) => void;
};

// aria-describedby resolves across the whole document, so each dialog carries
// its own message id rather than a shared literal.
let dialogSeq = 0;

// The one gate in front of a destructive action: a native modal, so the page
// behind it is inert and Escape reaches us as a cancel.
export function createConfirmDialog(handlers: { onConfirm: () => void; onCancel: () => void }): ConfirmDialog {
  const messageId = `delete-confirm-message-${dialogSeq++}`;
  const message = el('p', {
    id: messageId, 'data-testid': 'delete-confirm-message', class: 'confirm-dialog-message',
  });

  const cancel = el('button', {
    'data-testid': 'delete-confirm-cancel', type: 'button', class: 'confirm-dialog-cancel',
  }, ['Cancel']);
  cancel.addEventListener('click', handlers.onCancel);

  const confirm = el('button', { 'data-testid': 'delete-confirm-yes', type: 'button' }, ['Delete']);
  confirm.addEventListener('click', handlers.onConfirm);

  // The name says what the dialog is; the description says what it would
  // destroy, which is the part the user has to hear before answering.
  const node = el('dialog', {
    'data-testid': 'delete-confirm', class: 'confirm-dialog', role: 'alertdialog',
    'aria-label': 'Confirm delete', 'aria-describedby': messageId,
  }, [
    message,
    el('div', { class: 'confirm-dialog-actions' }, [cancel, confirm]),
  ]);

  // Escape closes a native dialog on its own, which would leave the app still
  // holding the pending delete; route it through the same cancel path.
  node.addEventListener('cancel', (e) => {
    e.preventDefault();
    handlers.onCancel();
  });

  return {
    node,
    render(text) {
      if (text === null) {
        if (node.open) {
          node.close();
        }

        return;
      }

      message.textContent = text;

      if (!node.open) {
        node.showModal();
      }
    },
  };
}
