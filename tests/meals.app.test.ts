import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import {
  clickLog, fixedClock, makeContainer, pickFood, setAmount, TODAY,
} from './_helpers.js';

function mealHeaders(c: HTMLElement): HTMLElement[] {
  return Array.from(c.querySelectorAll('[data-testid="meal-header"]')) as HTMLElement[];
}

function mealLabels(c: HTMLElement): string[] {
  return mealHeaders(c).map((h) =>
    (h.querySelector('[data-testid="meal-header-label"]')!.textContent || '').trim());
}

function newMealBtn(c: HTMLElement): HTMLButtonElement {
  return c.querySelector('[data-testid="new-meal-button"]') as HTMLButtonElement;
}

describe('app — meals end-to-end', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('fresh day shows "Meal 1" header and a New meal button', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    expect(mealLabels(container)).to.deep.equal(['Meal 1']);
    expect(newMealBtn(container)).to.exist;
  });

  it('logging an entry on a fresh day creates Meal 1 in state and assigns the entry to it', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);

    const loaded = repo.load();
    expect(loaded.meals.filter((m) => m.date === TODAY)).to.have.lengthOf(1);
    expect(loaded.entries[0]!.mealId).to.equal(loaded.meals[0]!.id);
    expect(mealLabels(container)).to.deep.equal(['Meal 1']);
  });

  it('clicking "New meal" appends Meal 2; the next log lands in Meal 2', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);

    newMealBtn(container).click();
    expect(mealLabels(container)).to.deep.equal(['Meal 2', 'Meal 1']);

    pickFood(container, 'Oats');
    setAmount(container, '50');
    clickLog(container);

    const loaded = repo.load();
    const meal2 = loaded.meals.find((m) => m.position === 1)!;
    const oatsEntry = loaded.entries.find((e) => e.foodId === 'seed-oats')!;
    expect(oatsEntry.mealId).to.equal(meal2.id);
  });

  it('deleting the only entry of a non-latest meal removes its header (Meal 2 → Meal 1 renumber)', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });

    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);
    newMealBtn(container).click();
    pickFood(container, 'Oats');
    setAmount(container, '50');
    clickLog(container);

    expect(mealLabels(container)).to.deep.equal(['Meal 2', 'Meal 1']);

    const bananaRow = Array.from(container.querySelectorAll('[data-testid="entry-row"]'))
      .find((r) => r.textContent!.includes('Banana'))!;
    (bananaRow.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();

    expect(mealLabels(container)).to.deep.equal(['Meal 1']);
    const loaded = repo.load();
    expect(loaded.meals.filter((m) => m.date === TODAY)).to.have.lengthOf(1);
  });

  it('deleting the only entry of the LATEST meal keeps the header visible (it stays as the active empty meal)', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });

    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    const delBtn = container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement;
    delBtn.click();

    expect(mealLabels(container)).to.deep.equal(['Meal 1']);
  });

  it('per-meal totals appear in the meal header and a day total appears at the bottom', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    const total = mealHeaders(container)[0]!
      .querySelector('[data-testid="meal-header-total"]')!.textContent!;
    expect(total).to.contain('89');

    const dayTotal = container.querySelector('[data-testid="totals-calories"]')!.textContent!;
    expect(dayTotal).to.contain('89');
  });

  it('clicking "New meal" before any entry exists does not create a ghost meal', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    newMealBtn(container).click();
    newMealBtn(container).click();
    newMealBtn(container).click();
    expect(repo.load().meals.filter((m) => m.date === TODAY)).to.have.lengthOf(0);
    expect(mealLabels(container)).to.deep.equal(['Meal 1']);
  });

  it('clicking "New meal" twice in a row creates only one new meal (latest must be non-empty)', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    newMealBtn(container).click();
    newMealBtn(container).click();
    newMealBtn(container).click();

    expect(repo.load().meals.filter((m) => m.date === TODAY)).to.have.lengthOf(2);
    expect(mealLabels(container)).to.deep.equal(['Meal 2', 'Meal 1']);
  });

  it('"New meal" after deleting the only entry of the latest meal is a no-op', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    (container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    expect(mealLabels(container)).to.deep.equal(['Meal 1']);

    newMealBtn(container).click();
    expect(mealLabels(container)).to.deep.equal(['Meal 1']);
    expect(repo.load().meals.filter((m) => m.date === TODAY)).to.have.lengthOf(1);
  });
});
