import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { chipLabels, chipRow, clickLog, fixedClock, makeContainer, pickFood, searchLog, seededRepo, setAmount } from './_helpers.js';

describe('app — end-to-end through real composition root', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders the fixture foods and empty entries on first open', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    expect(container.querySelectorAll('[data-testid="food-option"]').length).to.equal(10);
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
  });

  it('logging a valid entry appends it to today\'s list', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Banana');
    expect(rows[0]!.textContent).to.contain('107');
  });

  it('totals update immediately after logging', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);
    const totals = container.querySelector('[data-testid="totals-calories"]')!.textContent!;
    expect(totals).to.contain('107');
  });

  it('totals update immediately after delete', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);
    expect(container.querySelector('[data-testid="totals-calories"]')!.textContent).to.contain('107');
    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="totals-calories"]')!.textContent).to.contain('0');
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
  });

  it('shows error and does not log when food is not picked', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    setAmount(container, '100');
    clickLog(container);
    expect(container.querySelector('[data-testid="error-message"]')!.textContent).to.contain('Pick a food.');
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
  });

  it('shows error and does not log when grams is empty/invalid/zero/negative', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    for (const bad of ['', '   ', '0', '-5', 'abc']) {
      setAmount(container, bad);
      clickLog(container);
      const err = container.querySelector('[data-testid="error-message"]');
      expect(err, `expected error for grams=${JSON.stringify(bad)}`).to.exist;
      expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
    }
  });

  it('clears error after a successful log', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickLog(container);
    expect(container.querySelector('[data-testid="error-message"]')).to.exist;
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);
    expect(container.querySelector('[data-testid="error-message"]')).to.equal(null);
  });

  it('clears error after a delete', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);
    clickLog(container);
    expect(container.querySelector('[data-testid="error-message"]')).to.exist;
    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="error-message"]')).to.equal(null);
  });

  it('persists across "reload" — new app from same repo sees saved entries', () => {
    const repo = seededRepo();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);

    const container2 = makeContainer();
    createApp({ container: container2, repo, clock: fixedClock() });
    const rows = container2.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Banana');
    container2.remove();
  });

  it('delete persists — a reload after delete shows no entry', () => {
    const repo = seededRepo();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);
    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();

    const container2 = makeContainer();
    createApp({ container: container2, repo, clock: fixedClock() });
    expect(container2.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
    container2.remove();
  });

  it('search filters food options live', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    searchLog(container, 'oat');
    const opts = container.querySelectorAll('[data-testid="food-option"]');
    expect(opts.length).to.equal(1);
    expect(opts[0]!.textContent).to.contain('Oats');
  });

  it('a search that drops the selected food from the picker ends the selection, so Log it cannot log a hidden food', () => {
    const repo = seededRepo();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');

    searchLog(container, 'bana');
    const stillSelected = container.querySelector('[data-testid="food-option"][data-selected="true"]') !== null;
    expect(stillSelected, 'a narrower match keeps the selection').to.equal(true);

    searchLog(container, 'zzzz');
    clickLog(container);
    expect(repo.load()!.entries.length).to.equal(0);
  });

  it('clears grams input after successful log (but keeps selected food)', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);
    const grams = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    expect(grams.value).to.equal('');
    const selected = container.querySelector('[data-testid="food-option"][data-selected="true"]');
    expect(selected, 'food selection persists after log').to.exist;
  });

  it('chip-row is hidden until a food is picked, then chips fill the amount, focus Log, and submit on Enter', () => {
    const repo = seededRepo();
    createApp({ container, repo, clock: fixedClock() });

    expect(chipRow(container).hidden).to.equal(true);

    pickFood(container, 'Banana');
    expect(chipRow(container).hidden).to.equal(false);

    const chip = container.querySelector('[data-testid="chip-button-100"]') as HTMLButtonElement;
    expect(chip, 'chip-button-100 should be rendered after picking a g-food').to.exist;
    chip.click();

    const amount = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    expect(amount.value).to.equal('100');

    const logBtn = container.querySelector('[data-testid="log-button"]') as HTMLButtonElement;
    expect(document.activeElement, 'Log button is focused after chip click').to.equal(logBtn);

    logBtn.click();

    const entries = repo.load().entries;
    expect(entries.length).to.equal(1);
    expect(entries[0]!.amount).to.equal(100);
    expect(entries[0]!.unit).to.equal('g');
  });

  it('chips change to oz values when the unit is switched to oz', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');

    const group = container.querySelector('[data-testid="log-unit-group"]') as HTMLElement;
    (group.querySelector('[data-unit="oz"]') as HTMLButtonElement).click();

    expect(chipLabels(container)).to.deep.equal(['1', '2', '4', '8']);
  });

  it('log error appears between the log-row and the chip-row, not after the chip-row', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    clickLog(container);

    const errorEl = container.querySelector('[data-testid="error-message"]') as HTMLElement;
    expect(errorEl, 'error should be rendered').to.exist;

    const row = chipRow(container);
    const errPos = errorEl.compareDocumentPosition(row);
    expect(errPos & Node.DOCUMENT_POSITION_FOLLOWING,
      'chip-row should come after the error in document order').to.not.equal(0);
  });
});
