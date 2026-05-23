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
  if (!match) {
    throw new Error(`No food option containing "${name}"`);
  }

  match.click();
}

function setGrams(container: HTMLElement, grams: string) {
  const input = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
  input.value = grams;
  input.dispatchEvent(new Event('input'));
}

function clickLog(container: HTMLElement) {
  (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();
}

describe('app — end-to-end through real composition root', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders seed foods and empty entries on first open', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    expect(container.querySelectorAll('[data-testid="food-option"]').length).to.equal(10);
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
  });

  it('logging a valid entry appends it to today\'s list', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setGrams(container, '120');
    clickLog(container);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Banana');
    expect(rows[0]!.textContent).to.contain('107');
  });

  it('totals update immediately after logging', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setGrams(container, '120');
    clickLog(container);
    const totals = container.querySelector('[data-testid="totals-row"]')!.textContent!;
    expect(totals).to.contain('107');
  });

  it('totals update immediately after delete', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setGrams(container, '120');
    clickLog(container);
    expect(container.querySelector('[data-testid="totals-row"]')!.textContent).to.contain('107');
    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="totals-row"]')!.textContent).to.contain('0');
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
  });

  it('shows error and does not log when food is not picked', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    setGrams(container, '100');
    clickLog(container);
    expect(container.querySelector('[data-testid="error-message"]')!.textContent).to.contain('Pick a food.');
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
  });

  it('shows error and does not log when grams is empty/invalid/zero/negative', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    for (const bad of ['', '   ', '0', '-5', 'abc']) {
      setGrams(container, bad);
      clickLog(container);
      const err = container.querySelector('[data-testid="error-message"]');
      expect(err, `expected error for grams=${JSON.stringify(bad)}`).to.exist;
      expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
    }
  });

  it('clears error after a successful log', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    clickLog(container);
    expect(container.querySelector('[data-testid="error-message"]')).to.exist;
    pickFood(container, 'Banana');
    setGrams(container, '100');
    clickLog(container);
    expect(container.querySelector('[data-testid="error-message"]')).to.equal(null);
  });

  it('clears error after a delete', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setGrams(container, '100');
    clickLog(container);
    clickLog(container);
    expect(container.querySelector('[data-testid="error-message"]')).to.exist;
    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="error-message"]')).to.equal(null);
  });

  it('persists across "reload" — new app from same repo sees saved entries', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setGrams(container, '120');
    clickLog(container);

    const container2 = makeContainer();
    createApp({ container: container2, repo, clock: fixedClock() });
    const rows = container2.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Banana');
    container2.remove();
  });

  it('delete persists — a reload after delete shows no entry', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setGrams(container, '120');
    clickLog(container);
    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();

    const container2 = makeContainer();
    createApp({ container: container2, repo, clock: fixedClock() });
    expect(container2.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
    container2.remove();
  });

  it('search filters food options live', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    const search = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    search.value = 'oat';
    search.dispatchEvent(new Event('input'));
    const opts = container.querySelectorAll('[data-testid="food-option"]');
    expect(opts.length).to.equal(1);
    expect(opts[0]!.textContent).to.contain('Oats');
  });

  it('clears grams input after successful log (but keeps selected food)', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setGrams(container, '120');
    clickLog(container);
    const amount = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    expect(amount.value).to.equal('');
    const selected = container.querySelector('[data-testid="food-option"][data-selected="true"]');
    expect(selected, 'food selection persists after log').to.exist;
  });

  it('defaults log unit to picked food\'s primaryUnit', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Egg');
    const unit = container.querySelector('[data-testid="log-unit"]') as HTMLSelectElement;
    expect(unit.value).to.equal('count');
  });

  it('logs 2 eggs as a count entry with grams resolved to 100', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Egg');
    setGrams(container, '2');
    clickLog(container);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.textContent).to.contain('Egg');
    expect(row.textContent).to.contain('2 count');
    expect(container.querySelector('[data-testid="totals-row"]')!.textContent).to.contain('155');
  });

  it('overrides primary unit at log time via the dropdown', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Chicken');
    const unit = container.querySelector('[data-testid="log-unit"]') as HTMLSelectElement;
    unit.value = 'oz';
    unit.dispatchEvent(new Event('change'));
    setGrams(container, '4');
    clickLog(container);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.textContent).to.contain('4oz');
  });

  it('clicking a chip fills the amount input and Log produces an entry with the chip value as grams', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');

    const chip = container.querySelector('[data-testid="chip-100"]') as HTMLButtonElement;
    expect(chip, 'chip-100 should be rendered after picking a "g" food').to.exist;
    chip.click();

    const amount = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    expect(amount.value).to.equal('100');

    clickLog(container);

    const entries = repo.load().entries;
    expect(entries.length).to.equal(1);
    expect(entries[0]!.grams).to.equal(100);
    expect(entries[0]!.amount).to.equal(100);
    expect(entries[0]!.unit).to.equal('g');
  });
});
