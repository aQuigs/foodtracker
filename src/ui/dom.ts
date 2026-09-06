export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

export function setInputValue(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  if (input.value !== value) {
    input.value = value;
  }
}

// Moves parent's children to match `desired`, touching only nodes that are
// out of place. A node already at its correct index is never touched, so it
// keeps focus (an existing checkbox mid-click, say); a node that has to move
// is removed and re-inserted by insertBefore, which does blur it if it was
// focused — callers that must preserve focus across a reorder need to keep
// the focused row's index stable, not rely on this function for it.
export function reconcileChildren(parent: Element, desired: readonly Element[]): void {
  for (let i = 0; i < desired.length; i++) {
    const wanted = desired[i]!;
    if (parent.children[i] !== wanted) {
      parent.insertBefore(wanted, parent.children[i] ?? null);
    }
  }

  while (parent.children.length > desired.length) {
    parent.lastElementChild!.remove();
  }
}

// For a list rebuilt from scratch on every paint, by design, rather than
// reconciled in place: captures which child (identified by testid + a key
// attribute) has focus before `render` runs, then refocuses the rebuilt
// list's matching node afterward — so a fresh element for the same logical
// row doesn't read as a focus loss to the user.
export function withFocusPreserved(list: Element, testid: string, keyAttr: string, render: () => void): void {
  const active = document.activeElement;
  const key = active instanceof HTMLElement && active.getAttribute('data-testid') === testid
    ? active.getAttribute(keyAttr)
    : null;

  render();

  if (key !== null) {
    const restored = list.querySelector(`[data-testid="${testid}"][${keyAttr}="${CSS.escape(key)}"]`);
    if (restored instanceof HTMLElement) {
      restored.focus();
    }
  }
}

// Every search box in the app: same element, same class, same width rule.
export function searchInput(testid: string, label: string, onInput: (value: string) => void): HTMLInputElement {
  const input = el('input', {
    'data-testid': testid, type: 'search', class: 'search-input', placeholder: label, 'aria-label': label,
  });
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

// Every number field in the app: decimal keyboard on phones, any step, no
// negatives.
export function numberInput(attrs: Record<string, string>): HTMLInputElement {
  return el('input', { ...attrs, type: 'number', inputmode: 'decimal', step: 'any', min: '0' });
}

// Toggle state lives on a boolean attribute, not a class, so `[data-active]`
// styling composes with whatever other classes a button already carries.
export function setActive(btn: HTMLElement, active: boolean): void {
  if (active) {
    btn.setAttribute('data-active', 'true');
  } else {
    btn.removeAttribute('data-active');
  }
}

export function renderError(
  parent: HTMLElement, testid: string, message: string | null, before: HTMLElement | null = null,
): void {
  const existing = parent.querySelector(`[data-testid="${testid}"]`);
  if (message === null) {
    if (existing) {
      existing.remove();
    }

    return;
  }

  if (existing) {
    existing.textContent = message;
    return;
  }

  const errorEl = el('p', { 'data-testid': testid, class: 'error', role: 'alert' }, [message]);
  if (before !== null && before.parentNode === parent) {
    parent.insertBefore(errorEl, before);
  } else {
    parent.append(errorEl);
  }
}
