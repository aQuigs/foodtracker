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

// The visible name of a form control, above the control it names.
export function formField(label: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'food-form-field' }, [
    el('span', { class: 'food-form-field-label' }, [label]),
    control,
  ]);
}

function makeSearchInput(testid: string, onInput: (value: string) => void): HTMLInputElement {
  const input = el('input', { 'data-testid': testid, type: 'search', class: 'search-input' });
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

// Every search box in the app: same element, same class, same width rule.
// This one carries its name as a placeholder, so the name goes away as soon
// as the user types — searchField is the version that keeps it.
export function searchInput(testid: string, label: string, onInput: (value: string) => void): HTMLInputElement {
  const input = makeSearchInput(testid, onInput);
  input.setAttribute('placeholder', label);
  input.setAttribute('aria-label', label);
  return input;
}

export type SearchField = { input: HTMLInputElement; field: HTMLElement };

// A search box named by a visible label instead of a placeholder. One string
// writes the label, so the two can't drift, and the box needs no aria-label
// of its own — the <label> wrapping it is its name.
export function searchField(testid: string, label: string, onInput: (value: string) => void): SearchField {
  const input = makeSearchInput(testid, onInput);
  return { input, field: formField(label, input) };
}

// Every number field in the app: decimal keyboard on phones, any step, no
// negatives.
export function numberInput(attrs: Record<string, string>): HTMLInputElement {
  return el('input', { ...attrs, type: 'number', inputmode: 'decimal', step: 'any', min: '0' });
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
