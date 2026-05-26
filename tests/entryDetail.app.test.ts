import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import {
  clickFoodsTab, clickLog, clickLogTab, entryDetail, fixedClock, findEntryRow,
  makeContainer, pickFood, setAmount, setDateInput, setLogUnit,
} from './_helpers.js';

function logBanana(container: HTMLElement, amount = '100') {
  pickFood(container, 'Banana');
  setAmount(container, amount);
  clickLog(container);
}

describe('app — entry detail card (M6)', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('starts collapsed; clicking a row expands it; clicking again collapses', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    logBanana(container, '100');
    expect(entryDetail(container)).to.equal(null);

    const row = findEntryRow(container, 'Banana');
    row.click();
    expect(entryDetail(container)).to.exist;

    findEntryRow(container, 'Banana').click();
    expect(entryDetail(container)).to.equal(null);
  });

  it('clicking a different row collapses the first and expands the second', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    logBanana(container, '100');
    pickFood(container, 'Oats');
    setAmount(container, '50');
    clickLog(container);

    findEntryRow(container, 'Banana').click();
    expect(container.querySelectorAll('[data-testid="entry-detail"]').length).to.equal(1);

    findEntryRow(container, 'Oats').click();
    const cards = container.querySelectorAll('[data-testid="entry-detail"]');
    expect(cards.length).to.equal(1);
    expect((cards[0] as HTMLElement).getAttribute('data-entry-id')).to.equal('id-2');
  });

  it('clicking the delete button does NOT expand the row', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    logBanana(container, '100');
    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    expect(entryDetail(container)).to.equal(null);
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(0);
  });

  it('deleting the currently-expanded entry resets expansion', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    logBanana(container, '100');
    pickFood(container, 'Oats');
    setAmount(container, '50');
    clickLog(container);

    findEntryRow(container, 'Banana').click();
    const bananaRow = findEntryRow(container, 'Banana');
    (bananaRow.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();

    expect(entryDetail(container)).to.equal(null);
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(1);
  });

  it('switching to the Foods view collapses any open card', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    logBanana(container, '100');
    findEntryRow(container, 'Banana').click();
    expect(entryDetail(container)).to.exist;

    clickFoodsTab(container);
    clickLogTab(container);
    expect(entryDetail(container)).to.equal(null);
  });

  it('navigating to a different date collapses any open card', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    logBanana(container, '100');
    findEntryRow(container, 'Banana').click();
    expect(entryDetail(container)).to.exist;

    (container.querySelector('[data-testid="prev-date"]') as HTMLButtonElement).click();
    (container.querySelector('[data-testid="next-date"]') as HTMLButtonElement).click();
    expect(entryDetail(container)).to.equal(null);
  });

  it('jump-today collapses any open card', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    logBanana(container, '100');
    findEntryRow(container, 'Banana').click();
    setDateInput(container, '2026-05-20');
    (container.querySelector('[data-testid="jump-today"]') as HTMLButtonElement).click();
    expect(entryDetail(container)).to.equal(null);
  });

  it('reload starts with no card open even if a row existed before', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    logBanana(container, '100');
    findEntryRow(container, 'Banana').click();
    expect(entryDetail(container)).to.exist;

    container.remove();
    const container2 = makeContainer();
    createApp({ container: container2, repo, clock: fixedClock() });
    expect(entryDetail(container2)).to.equal(null);
    container2.remove();
  });

  it('card shows resolved macros for a 1-oz banana entry', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setLogUnit(container, 'oz');
    setAmount(container, '1');
    clickLog(container);

    findEntryRow(container, 'Banana').click();
    const cal = container.querySelector('[data-testid="entry-detail-calories"]')!.textContent!;
    expect(cal).to.match(/Calories/);
    expect(cal).to.match(/25/);
  });
});
