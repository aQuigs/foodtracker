import { el } from './dom.js';

export function setActive(btn: HTMLElement, active: boolean): void {
  if (active) {
    btn.setAttribute('data-active', 'true');
  } else {
    btn.removeAttribute('data-active');
  }
}

export type ToggleOption<T extends string> = { value: T; label: string };

export type ToggleGroupSpec<T extends string> = {
  testid: string;
  ariaLabel: string;
  options: ReadonlyArray<ToggleOption<T>>;
  // Attribute that carries each button's value; defaults to data-value.
  valueAttr?: string;
};

export type ToggleGroupVm<T extends string> = {
  selected: T | null;
  // Options outside this set render disabled; omitted means all enabled.
  enabled?: ReadonlyArray<T>;
  onPick: (value: T) => void;
};

export type ToggleGroup<T extends string> = { node: HTMLDivElement; render(vm: ToggleGroupVm<T>): void };

// One button group for every "pick one of a few" control: the unit pickers,
// the trends metric and range. Every option is always painted (disabled when
// not allowed), so the group's size never depends on what is selectable.
export function createToggleGroup<T extends string>(spec: ToggleGroupSpec<T>): ToggleGroup<T> {
  const valueAttr = spec.valueAttr ?? 'data-value';
  const node = el('div', {
    'data-testid': spec.testid, class: 'toggle-group', role: 'group', 'aria-label': spec.ariaLabel,
  });

  // Buttons are created once and only have their attributes flipped on
  // render, so the button being clicked keeps focus across the re-render
  // that its own click causes.
  const buttons = spec.options.map((o) => el('button', {
    [valueAttr]: o.value, type: 'button', class: 'toggle-group-button',
  }, [o.label]));
  node.append(...buttons);

  return {
    node,
    render(vm) {
      const enabledSet = vm.enabled === undefined ? null : new Set<string>(vm.enabled);
      spec.options.forEach((o, i) => {
        const btn = buttons[i]!;
        const active = o.value === vm.selected;
        const enabled = enabledSet === null || enabledSet.has(o.value);
        setActive(btn, active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.disabled = !enabled;
        btn.onclick = enabled ? () => vm.onPick(o.value) : null;
      });
    },
  };
}
