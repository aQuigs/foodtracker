import type { Unit } from '../domain/types.js';
import { UNITS } from '../domain/units.js';
import { el, setActive } from './dom.js';

export type UnitPicker = {
  group: HTMLDivElement;
  render: (allowed: readonly Unit[], selected: Unit | null, onPick: (u: Unit) => void) => void;
};

export function createUnitPicker(testid: string, ariaLabel: string): UnitPicker {
  const group = el('div', {
    'data-testid': testid,
    class: 'unit-picker',
    role: 'group',
    'aria-label': ariaLabel,
  });
  return {
    group,
    render: (allowed, selected, onPick) => {
      const focused = document.activeElement as HTMLElement | null;
      const focusedUnit = focused?.parentElement === group ? focused.getAttribute('data-unit') : null;
      const allowedSet = new Set(allowed);

      group.replaceChildren(...UNITS.map((u) => {
        const active = u === selected;
        const enabled = allowedSet.has(u);
        const attrs: Record<string, string> = {
          'data-unit': u,
          type: 'button',
          class: 'unit-picker-button',
          'aria-pressed': active ? 'true' : 'false',
        };
        if (!enabled) {
          attrs.disabled = '';
        }
        const btn = el('button', attrs, [u]);
        setActive(btn, active);
        if (enabled) {
          btn.onclick = () => onPick(u);
        }
        return btn;
      }));

      if (focusedUnit) {
        group.querySelector<HTMLButtonElement>(`[data-unit="${focusedUnit}"]`)?.focus();
      }
    },
  };
}
