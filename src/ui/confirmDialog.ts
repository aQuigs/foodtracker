import { el } from './dom.js';
import type { DeletePrompt } from './view.js';

export type ConfirmDialog = {
  node: HTMLDialogElement;
  render: (prompt: DeletePrompt | null) => void;
};

// The one gate in front of a destructive action: a native modal, so the page
// behind it is inert and Escape reaches us as a cancel.
export function createConfirmDialog(handlers: { onConfirm: () => void; onCancel: () => void }): ConfirmDialog {
  const message = el('p', { 'data-testid': 'delete-confirm-message', class: 'confirm-dialog-message' });

  const cancel = el('button', {
    'data-testid': 'delete-confirm-cancel', type: 'button', class: 'confirm-dialog-cancel',
  }, ['Cancel']);
  cancel.addEventListener('click', handlers.onCancel);

  const confirm = el('button', { 'data-testid': 'delete-confirm-yes', type: 'button' }, ['Delete']);
  confirm.addEventListener('click', handlers.onConfirm);

  const node = el('dialog', {
    'data-testid': 'delete-confirm', class: 'confirm-dialog', 'aria-label': 'Confirm delete',
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
    render(prompt) {
      if (prompt === null) {
        if (node.open) {
          node.close();
        }

        return;
      }

      message.textContent = prompt.message;

      if (!node.open) {
        node.showModal();
      }
    },
  };
}
