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
  query: '', selectedFoodId: null, gramsRaw: '', error: null,
  view: 'log',
  foodForm: { ...EMPTY_FOOD_FORM },
  foodFormError: null,
  importText: '', importError: null, exportText: '',
  foodsQuery: '',
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

export function setGrams(container: HTMLElement, grams: string): void {
  const input = container.querySelector('[data-testid="grams-input"]') as HTMLInputElement;
  input.value = grams;
  input.dispatchEvent(new Event('input'));
}

export function clickLog(container: HTMLElement): void {
  (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();
}

export function setDateInput(container: HTMLElement, date: string): void {
  const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
  input.value = date;
  input.dispatchEvent(new Event('change'));
}

export const noopHandlers = {
  onLog: () => {},
  onDelete: () => {},
  onQueryChange: () => {},
  onFoodSelect: () => {},
  onGramsChange: () => {},
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
};
