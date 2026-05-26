import type { Clock } from '../src/app.js';
import type { ViewModel } from '../src/ui/view.js';
import { EMPTY_FOOD_FORM } from '../src/ui/view.js';
import { freshState } from '../src/domain/seed.js';

export const TODAY = '2026-05-23';

export const baseVm: ViewModel = {
  state: freshState(),
  today: TODAY,
  now: new Date(`${TODAY}T12:00:00Z`),
  selectedDate: TODAY,
  query: '', selectedFoodId: null, amount: '', logUnit: 'g', error: null,
  view: 'log',
  foodForm: { ...EMPTY_FOOD_FORM },
  foodFormError: null,
  importText: '', importError: null, exportText: '',
  foodsQuery: '',
  expandedEntryId: null,
};

export function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

export function fixedClock(now = `${TODAY}T10:00:00.000Z`): Clock {
  let seq = 0;
  return {
    now: () => new Date(now),
    today: () => TODAY,
    newId: () => `id-${++seq}`,
  };
}

export function pickFood(container: HTMLElement, name: string): void {
  const opts = Array.from(container.querySelectorAll('[data-testid="food-option"]')) as HTMLElement[];
  const match = opts.find((o) => o.textContent!.includes(name));
  if (!match) {
    throw new Error(`No food option containing "${name}"`);
  }

  match.click();
}

export function setAmount(container: HTMLElement, amount: string): void {
  const input = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
  input.value = amount;
  input.dispatchEvent(new Event('input'));
}

export function setLogUnit(container: HTMLElement, unit: string): void {
  const sel = container.querySelector('[data-testid="log-unit-select"]') as HTMLSelectElement;
  sel.value = unit;
  sel.dispatchEvent(new Event('change'));
}

export function clickLog(container: HTMLElement): void {
  (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();
}

export function setDateInput(container: HTMLElement, date: string): void {
  const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
  input.value = date;
  input.dispatchEvent(new Event('change'));
}

export function clickFoodsTab(container: HTMLElement): void {
  (container.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();
}

export function clickLogTab(container: HTMLElement): void {
  (container.querySelector('[data-testid="view-toggle-log"]') as HTMLButtonElement).click();
}

export function chipRow(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-testid="chip-row"]') as HTMLElement;
}

export function chipButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(chipRow(container).querySelectorAll('button')) as HTMLButtonElement[];
}

export function chipLabels(container: HTMLElement): string[] {
  return chipButtons(container).map((b) => b.textContent!.trim());
}

export function entryRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="entry-row"]')) as HTMLElement[];
}

export function findEntryRow(container: HTMLElement, foodName: string): HTMLElement {
  const row = entryRows(container).find((r) => r.textContent!.includes(foodName));
  if (!row) {
    throw new Error(`No entry row containing "${foodName}"`);
  }

  return row;
}

export function entryDetail(container: HTMLElement, entryId?: string): HTMLElement | null {
  const sel = entryId === undefined
    ? '[data-testid="entry-detail"]'
    : `[data-testid="entry-detail"][data-entry-id="${entryId}"]`;
  return container.querySelector(sel) as HTMLElement | null;
}

export const noopHandlers = {
  onLog: () => {},
  onDelete: () => {},
  onQueryChange: () => {},
  onFoodSelect: () => {},
  onAmountChange: () => {},
  onLogUnitChange: () => {},
  onDateChange: () => {},
  onPrevDate: () => {},
  onNextDate: () => {},
  onJumpToday: () => {},
  onViewChange: () => {},
  onFoodFormChange: () => {},
  onFoodFormSubmit: () => {},
  onEditFood: () => {},
  onSoftDeleteFood: () => {},
  onCancelEdit: () => {},
  onExport: () => {},
  onImport: () => {},
  onImportTextChange: () => {},
  onFoodsQueryChange: () => {},
  onToggleEntry: () => {},
};
