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

function setAmount(container: HTMLElement, value: string) {
  const input = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function clickLog(container: HTMLElement) {
  (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();
}

describe('app — entry detail card integration', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('clicking an entry row expands its detail card', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);
    expect(container.querySelector('[data-testid="entry-detail"]')).to.equal(null);
    (container.querySelector('[data-testid="entry-row"]') as HTMLElement).click();
    expect(container.querySelector('[data-testid="entry-detail"]')).to.exist;
  });

  it('clicking the same row again collapses the detail card', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);
    const row = container.querySelector('[data-testid="entry-row"]') as HTMLElement;
    row.click();
    expect(container.querySelector('[data-testid="entry-detail"]')).to.exist;
    row.click();
    expect(container.querySelector('[data-testid="entry-detail"]')).to.equal(null);
  });

  it('clicking a different row replaces the expanded card', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);
    pickFood(container, 'Oats');
    setAmount(container, '50');
    clickLog(container);

    const rows = Array.from(container.querySelectorAll('[data-testid="entry-row"]')) as HTMLElement[];
    rows[0]!.click();
    expect(container.querySelectorAll('[data-testid="entry-detail"]').length).to.equal(1);
    rows[1]!.click();
    expect(container.querySelectorAll('[data-testid="entry-detail"]').length).to.equal(1);
  });

  it('onEditEntry deletes the entry and prefills the log form', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);

    const row = container.querySelector('[data-testid="entry-row"]') as HTMLElement;
    row.click();

    (container.querySelector('[data-testid="entry-detail-edit"]') as HTMLButtonElement).click();

    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);

    const selectedFood = container.querySelector('[data-testid="food-option"][data-selected="true"]');
    expect(selectedFood).to.exist;
    expect(selectedFood!.textContent).to.contain('Banana');

    const amountInput = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    expect(amountInput.value).to.equal('120');

    const unitSelect = container.querySelector('[data-testid="log-unit"]') as HTMLSelectElement;
    expect(unitSelect.value).to.equal('g');
  });

  it('onEditEntry resets the expanded card (no detail visible after edit)', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);

    (container.querySelector('[data-testid="entry-row"]') as HTMLElement).click();
    (container.querySelector('[data-testid="entry-detail-edit"]') as HTMLButtonElement).click();

    expect(container.querySelector('[data-testid="entry-detail"]')).to.equal(null);
  });
});
