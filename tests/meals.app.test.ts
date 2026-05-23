import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import type { Clock } from '../src/app.js';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function fixedClock(now = '2026-05-23T10:00:00.000Z'): Clock {
  let seq = 0;
  return {
    now: () => new Date(now),
    today: () => '2026-05-23',
    newId: () => `id-${++seq}`,
  };
}

function pickFood(container: HTMLElement, name: string) {
  const opts = Array.from(container.querySelectorAll('[data-testid="food-option"]')) as HTMLElement[];
  const match = opts.find((o) => o.textContent!.includes(name));
  if (!match) throw new Error(`No food option containing "${name}"`);
  match.click();
}

function setAmount(container: HTMLElement, amount: string) {
  const input = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
  input.value = amount;
  input.dispatchEvent(new Event('input'));
}

function clickLog(container: HTMLElement) {
  (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();
}

function clickEndMeal(container: HTMLElement) {
  const btn = container.querySelector('[data-testid="start-next-meal"]') as HTMLButtonElement;
  if (!btn) throw new Error('start-next-meal button not found');
  btn.click();
}

describe('app — meals integration', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('logs an entry and it appears in Meal 1 section', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    const row = container.querySelector('[data-testid="entry-row"]');
    expect(row).to.exist;
    expect(row!.textContent).to.contain('Banana');
    const heading = container.querySelector('.meal-heading');
    expect(heading!.textContent!.trim()).to.equal('Meal 1');
  });

  it('"End meal" button is disabled when no entries in current meal', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    clickEndMeal(container);
    const btn = container.querySelector('[data-testid="start-next-meal"]') as HTMLButtonElement;
    expect(btn.disabled).to.equal(true);
  });

  it('persists entry with the correct mealId (AC 17)', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    const saved = repo.load();
    expect(saved.entries).to.have.lengthOf(1);
    expect(saved.meals).to.have.lengthOf(1);
    expect(saved.entries[0]!.mealId).to.equal(saved.meals[0]!.id);
  });

  it('clicking "End meal" creates Meal 2 and subsequent entries go there', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    clickEndMeal(container);

    pickFood(container, 'Oats');
    setAmount(container, '50');
    clickLog(container);

    const headings = Array.from(container.querySelectorAll('.meal-heading')).map((h) => h.textContent!.trim());
    expect(headings).to.deep.equal(['Meal 1', 'Meal 2']);
    const entries = container.querySelectorAll('[data-testid="entry-row"]');
    expect(entries.length).to.equal(2);
  });
});
