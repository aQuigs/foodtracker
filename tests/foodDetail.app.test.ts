import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import {
  clickFoodsTab, clickLog, clickLogTab, fixedClock, foodDetail,
  makeContainer, pickFood, setAmount, setLogUnit, findEntryRow,
} from './_helpers.js';

describe('app — food detail card e2e through createApp', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('picking a food auto-opens the food detail card', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    expect(foodDetail(container)).to.equal(null);
    pickFood(container, 'Banana');
    expect(foodDetail(container, 'seed-banana')).to.exist;
  });

  it('clicking the same food again collapses the card but keeps it selected', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    expect(foodDetail(container, 'seed-banana')).to.exist;

    (container.querySelector('[data-testid="food-option"][data-food-id="seed-banana"]') as HTMLElement).click();

    expect(foodDetail(container)).to.equal(null);
    const reRow = container.querySelector('[data-testid="food-option"][data-food-id="seed-banana"]') as HTMLElement;
    expect(reRow.getAttribute('data-selected')).to.equal('true');
    expect(reRow.getAttribute('aria-expanded')).to.equal('false');
  });

  it('picking a different food closes the previous card and opens the new one', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    expect(foodDetail(container, 'seed-banana')).to.exist;

    pickFood(container, 'Oats');
    expect(foodDetail(container, 'seed-banana')).to.equal(null);
    expect(foodDetail(container, 'seed-oats')).to.exist;
  });

  it('this-entry column updates live as amount changes', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    const live = container.querySelector('[data-testid="food-detail-this-entry-calories"]')!.textContent!;
    expect(live).to.contain('107');
  });

  it('this-entry column updates when log unit changes', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '1');
    setLogUnit(container, 'oz');
    const live = container.querySelector('[data-testid="food-detail-this-entry-calories"]')!.textContent!;
    expect(live).to.contain('25');
  });

  it('mutual exclusion: opening an entry detail closes the food card', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);
    expect(foodDetail(container)).to.exist;

    const entryRow = findEntryRow(container, 'Banana');
    entryRow.click();
    expect(foodDetail(container)).to.equal(null);
    expect(container.querySelector('[data-testid="entry-detail"]')).to.exist;
  });

  it('mutual exclusion: opening the food card closes an open entry detail', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    const entryRow = findEntryRow(container, 'Banana');
    entryRow.click();
    expect(container.querySelector('[data-testid="entry-detail"]')).to.exist;

    pickFood(container, 'Oats');
    expect(container.querySelector('[data-testid="entry-detail"]')).to.equal(null);
    expect(foodDetail(container, 'seed-oats')).to.exist;
  });

  it('switching to the Foods view collapses the food card', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    expect(foodDetail(container)).to.exist;
    clickFoodsTab(container);
    expect(foodDetail(container)).to.equal(null);
  });

  it('navigating to a different date collapses the food card', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    expect(foodDetail(container)).to.exist;
    (container.querySelector('[data-testid="prev-date"]') as HTMLButtonElement).click();
    expect(foodDetail(container)).to.equal(null);
  });

  it('logging an entry keeps the card open but resets the this-entry column to em-dash', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);
    expect(foodDetail(container, 'seed-banana')).to.exist;
    const live = container.querySelector('[data-testid="food-detail-this-entry-calories"]')!.textContent!;
    expect(live).to.contain('—');
  });

  it('reload (new app from saved repo) starts with no detail card open', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    expect(foodDetail(container)).to.exist;

    const container2 = makeContainer();
    createApp({ container: container2, repo, clock: fixedClock() });
    expect(foodDetail(container2)).to.equal(null);
    container2.remove();
  });

  it('logging then switching tabs and back: card stays closed after returning', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    clickFoodsTab(container);
    clickLogTab(container);
    expect(foodDetail(container)).to.equal(null);
  });
});
