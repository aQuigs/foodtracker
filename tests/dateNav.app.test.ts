import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { clickLog, fixedClock, makeContainer, pickFood, setDateInput, setAmount } from './_helpers.js';

describe('app — date navigation', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('starts on today by default', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    expect(input.value).to.equal('2026-05-23');
    expect(container.querySelector('[data-testid="jump-today"]')).to.equal(null);
  });

  it('prev button shifts to yesterday and shows the Today shortcut', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    (container.querySelector('[data-testid="prev-date"]') as HTMLButtonElement).click();
    const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    expect(input.value).to.equal('2026-05-22');
    expect(container.querySelector('[data-testid="jump-today"]')).to.exist;
  });

  it('next button shifts forward and shows the Today shortcut', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    (container.querySelector('[data-testid="next-date"]') as HTMLButtonElement).click();
    const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    expect(input.value).to.equal('2026-05-24');
    expect(container.querySelector('[data-testid="jump-today"]')).to.exist;
  });

  it('Today shortcut jumps back to today', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    (container.querySelector('[data-testid="prev-date"]') as HTMLButtonElement).click();
    (container.querySelector('[data-testid="jump-today"]') as HTMLButtonElement).click();
    const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    expect(input.value).to.equal('2026-05-23');
    expect(container.querySelector('[data-testid="jump-today"]')).to.equal(null);
  });

  it('date input change updates selected date', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    setDateInput(container, '2026-04-01');
    const input = container.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    expect(input.value).to.equal('2026-04-01');
  });

  it('logs new entry against the selected date, not today', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    setDateInput(container, '2026-05-20');
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);

    const state = repo.load();
    expect(state.entries.length).to.equal(1);
    expect(state.entries[0]!.date).to.equal('2026-05-20');
  });

  it('viewing yesterday shows yesterday\'s entries, not today\'s', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    (container.querySelector('[data-testid="prev-date"]') as HTMLButtonElement).click();
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);

    pickFood(container, 'Oats');
    setAmount(container, '50');
    clickLog(container);
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(1);

    (container.querySelector('[data-testid="next-date"]') as HTMLButtonElement).click();
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Banana');
  });

  it('reload resets selectedDate to today (not persisted)', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    (container.querySelector('[data-testid="prev-date"]') as HTMLButtonElement).click();

    const container2 = makeContainer();
    createApp({ container: container2, repo, clock: fixedClock() });
    const input = container2.querySelector('[data-testid="date-input"]') as HTMLInputElement;
    expect(input.value).to.equal('2026-05-23');
    container2.remove();
  });

  it('ignores empty/invalid date input change (does not corrupt selectedDate)', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    const before = (container.querySelector('[data-testid="date-input"]') as HTMLInputElement).value;
    setDateInput(container, '');
    const after = (container.querySelector('[data-testid="date-input"]') as HTMLInputElement).value;
    expect(after).to.equal(before);
  });

  it('records loggedAt distinct from entry date when logging on a past day', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    setDateInput(container, '2026-05-20');
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);
    const entry = repo.load().entries[0]!;
    expect(entry.date).to.equal('2026-05-20');
    expect(entry.loggedAt).to.equal('2026-05-23T10:00:00.000Z');
  });

  it('can delete an entry from a past date', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    setDateInput(container, '2026-05-20');
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(1);

    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
    expect(repo.load().entries.length).to.equal(0);
  });
});
