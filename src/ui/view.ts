import { dailyTotals, entryKcal } from '../domain/calc.js';
import type { State } from '../domain/types.js';
import { filterFoods } from './search.js';

export type ViewModel = {
  state: State;
  today: string;
  query: string;
  selectedFoodId: string | null;
  gramsRaw: string;
  error: string | null;
};

export type ViewHandlers = {
  onLog: (foodId: string, gramsRaw: string) => void;
  onDelete: (entryId: string) => void;
  onQueryChange: (q: string) => void;
  onFoodSelect: (foodId: string) => void;
  onGramsChange: (g: string) => void;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

type FocusSnapshot = { testid: string; selectionStart: number | null; selectionEnd: number | null };

function captureFocus(container: HTMLElement): FocusSnapshot | null {
  const active = document.activeElement;
  if (!active || !container.contains(active)) {
    return null;
  }

  const testid = active.getAttribute('data-testid');
  if (!testid) {
    return null;
  }

  const snap: FocusSnapshot = { testid, selectionStart: null, selectionEnd: null };
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    try {
      snap.selectionStart = active.selectionStart;
      snap.selectionEnd = active.selectionEnd;
    } catch {
      // Some input types (number, email) throw on selectionStart access in some browsers.
    }
  }
  return snap;
}

function restoreFocus(container: HTMLElement, snap: FocusSnapshot | null): void {
  if (!snap) {
    return;
  }

  const next = container.querySelector(`[data-testid="${snap.testid}"]`) as HTMLElement | null;
  if (!next) {
    return;
  }

  next.focus();
  if ((next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) && snap.selectionStart !== null) {
    try { next.setSelectionRange(snap.selectionStart, snap.selectionEnd ?? snap.selectionStart); } catch { /* see captureFocus */ }
  }
}

export function render(container: HTMLElement, vm: ViewModel, handlers: ViewHandlers): void {
  const focused = captureFocus(container);
  const foodsById = new Map(vm.state.foods.map((f) => [f.id, f]));
  const filtered = filterFoods(vm.state.foods, vm.query);
  const totals = dailyTotals(vm.state, vm.today);
  const todaysEntries = vm.state.entries.filter((e) => e.date === vm.today);

  const search = el('input', {
    'data-testid': 'search-input',
    type: 'search',
    placeholder: 'Search foods…',
    'aria-label': 'Search foods',
  });
  search.value = vm.query;
  search.addEventListener('input', () => handlers.onQueryChange(search.value));

  const picker = el('ul', { 'data-testid': 'food-picker', class: 'picker' });
  for (const food of filtered) {
    const opt = el('li', {
      'data-testid': 'food-option',
      'data-food-id': food.id,
      ...(food.id === vm.selectedFoodId ? { 'data-selected': 'true' } : {}),
      role: 'button',
      tabindex: '0',
    }, [food.name]);
    opt.addEventListener('click', () => handlers.onFoodSelect(food.id));
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlers.onFoodSelect(food.id);
      }
    });
    picker.append(opt);
  }

  const grams = el('input', {
    'data-testid': 'grams-input',
    type: 'number',
    inputmode: 'decimal',
    step: 'any',
    placeholder: 'Grams',
    'aria-label': 'Grams',
  });
  grams.value = vm.gramsRaw;
  grams.addEventListener('input', () => handlers.onGramsChange(grams.value));

  const logBtn = el('button', {
    'data-testid': 'log-button',
    type: 'button',
  }, ['Log it']);
  logBtn.addEventListener('click', () => handlers.onLog(vm.selectedFoodId ?? '', vm.gramsRaw));

  const form = el('section', { class: 'form' }, [
    search,
    picker,
    el('div', { class: 'log-row' }, [grams, logBtn]),
  ]);

  if (vm.error !== null) {
    form.append(el('p', { 'data-testid': 'error-message', class: 'error', role: 'alert' }, [vm.error]));
  }

  const list = el('ul', { 'data-testid': 'entry-list', class: 'entries' });
  for (const entry of todaysEntries) {
    const food = foodsById.get(entry.foodId);
    if (!food) {
      continue;
    }

    const kcal = Math.round(entryKcal(entry, food));
    const del = el('button', {
      'data-testid': 'delete-button',
      'data-entry-id': entry.id,
      type: 'button',
      'aria-label': `Delete ${food.name}`,
    }, ['×']);
    del.addEventListener('click', () => handlers.onDelete(entry.id));
    list.append(el('li', { 'data-testid': 'entry-row' }, [
      `${food.name}  ${entry.grams}g  ${kcal} cal `,
      del,
    ]));
  }

  const totalsRow = el('div', { 'data-testid': 'totals-row', class: 'totals' }, [
    `Total: ${Math.round(totals.kcal)} cal   ` +
    `Protein ${Math.round(totals.protein)}g   ` +
    `Carbs ${Math.round(totals.carbs)}g   ` +
    `Fat ${Math.round(totals.fat)}g`,
  ]);

  container.replaceChildren(
    el('h1', {}, ['Food Tracker']),
    form,
    list,
    totalsRow,
  );
  restoreFocus(container, focused);
}

