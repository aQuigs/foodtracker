import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { parseState } from '../src/domain/validate.js';
import type { Recipe } from '../src/domain/types.js';
import {
  clickFoodsTab, clickLog, clickLogTab, draftItemCal, draftItemRow, draftTotal, fixedClock, makeContainer, pickRecipe,
  seedTestState, servingsInput, setDateInput,
} from './_helpers.js';

// Round-trips through JSON + parseState instead of reusing the same
// InMemoryRepository object, so this actually exercises serialization
// (recipes, recipeLogs, entry.recipeLogId) rather than sharing state by
// reference between the two app instances.
function roundTripped(repo: InMemoryRepository, makeId: () => string): InMemoryRepository {
  const state = parseState(JSON.stringify(repo.load()), makeId)!;
  const repo2 = new InMemoryRepository();
  repo2.save(state);
  return repo2;
}

const omelette: Recipe = {
  id: 'r1', name: 'Omelette',
  items: [
    { foodId: 'seed-egg', amount: 3, unit: 'count' },
    { foodId: 'seed-chicken', amount: 60, unit: 'g' },
  ],
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

function repoWithOmelette(): InMemoryRepository {
  const repo = new InMemoryRepository();
  repo.save({ ...seedTestState(), recipes: [omelette] });
  return repo;
}

function searchLog(c: HTMLElement, q: string): void {
  const input = c.querySelector('[data-testid="search-input"]') as HTMLInputElement;
  input.value = q;
  input.dispatchEvent(new Event('input'));
}

function draftAmountInput(c: HTMLElement, foodId: string): HTMLInputElement {
  return draftItemRow(c, foodId).querySelector('[data-testid="recipe-draft-amount"]') as HTMLInputElement;
}

function setDraftAmount(c: HTMLElement, foodId: string, value: string): void {
  const input = draftAmountInput(c, foodId);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function setServings(c: HTMLElement, value: string): void {
  const input = servingsInput(c);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('app — recipe logging end-to-end', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('shows a Recipe tag when searching for the recipe by name', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    const opt = container.querySelector('[data-testid="recipe-option"]')!;
    expect(opt.querySelector('[data-testid="picker-tag"]')!.textContent).to.equal('Recipe');
  });

  it('picking the recipe opens the card with its portions and a Servings field', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');

    expect(draftAmountInput(container, 'seed-egg').value).to.equal('3');
    expect(draftAmountInput(container, 'seed-chicken').value).to.equal('60');

    expect(servingsInput(container).closest('[data-testid="recipe-detail"]') !== null).to.equal(true);
    expect(servingsInput(container).value).to.equal('1');
    expect((container.querySelector('[data-testid="amount-input"]') as HTMLElement).closest('label')!.hidden).to.equal(true);
    expect((container.querySelector('[data-testid="log-unit-group"]') as HTMLElement).closest('label')!.hidden).to.equal(true);
    expect((container.querySelector('[data-testid="chip-row"]') as HTMLElement).hidden).to.equal(true);
  });

  it('updates the total as amounts and servings change', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');

    setDraftAmount(container, 'seed-egg', '2');
    setServings(container, '2');

    // 2 eggs * 78 + 60g * 1.65/g = 156 + 99 = 255 for one serving, 510 for two
    expect(draftTotal(container)).to.contain('Total 2 × 255 cal each serving = 510 cal');
  });

  it('clicking the selected recipe row again deselects it: the card goes and Amount and Unit return', () => {
    const repo = repoWithOmelette();
    createApp({ container, repo, clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    setServings(container, '3');

    pickRecipe(container, 'Omelette');

    expect(container.querySelector('[data-testid="recipe-detail"]') === null).to.equal(true);
    expect((container.querySelector('[data-testid="amount-input"]') as HTMLElement).closest('label')!.hidden).to.equal(false);
    expect((container.querySelector('[data-testid="log-unit-group"]') as HTMLElement).closest('label')!.hidden).to.equal(false);

    clickLog(container);
    expect(repo.load()!.entries.length).to.equal(0);
  });

  it('keeps the card, and its servings, open across a date change', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    setServings(container, '3');

    setDateInput(container, '2026-01-02');
    expect(servingsInput(container).value).to.equal('3');
  });

  it('typing a new search deselects the recipe, so no draft can hide behind a bare Log it', () => {
    const repo = repoWithOmelette();
    createApp({ container, repo, clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    setServings(container, '3');

    searchLog(container, 'chick');

    expect(container.querySelector('[data-testid="recipe-detail"]') === null).to.equal(true);
    expect((container.querySelector('[data-testid="amount-input"]') as HTMLElement).closest('label')!.hidden).to.equal(false);

    clickLog(container);
    expect(repo.load()!.entries.length).to.equal(0);
  });

  it('shows a dash for a blank amount', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    setDraftAmount(container, 'seed-egg', '');
    expect(draftItemCal(container, 'seed-egg')).to.equal('—');
  });

  it('logs one entry per item under a group header, and the day total includes them', () => {
    const repo = repoWithOmelette();
    createApp({ container, repo, clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    setDraftAmount(container, 'seed-egg', '2');
    setServings(container, '2');
    clickLog(container);

    const rows = Array.from(container.querySelectorAll('[data-testid="entry-row"]'));
    expect(rows).to.have.lengthOf(2);
    expect(rows[0]!.textContent).to.contain('Egg');
    expect(rows[0]!.textContent).to.contain('4 count');
    expect(rows[1]!.textContent).to.contain('Chicken breast');
    expect(rows[1]!.textContent).to.contain('120 g');

    const header = container.querySelector('[data-testid="recipe-group-header"]')!;
    expect(header.querySelector('[data-testid="recipe-group-label"]')!.textContent).to.equal('Omelette ×2');
    expect(header.querySelector('[data-testid="recipe-group-total"]')!.textContent).to.equal('510 cal');

    const dayTotal = container.querySelector('[data-testid="totals-calories"]')!.textContent!;
    expect(dayTotal).to.contain('510');

    const persisted = repo.load();
    expect(persisted.entries).to.have.lengthOf(2);
    expect(persisted.recipeLogs).to.have.lengthOf(1);
  });

  it('shows the macro chart with slices after logging a recipe', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    clickLog(container);

    const chart = container.querySelector('[data-testid="macro-chart"]') as HTMLElement;
    expect(chart.hidden).to.equal(false);
    expect(container.querySelectorAll('[data-testid^="macro-slice-"]').length).to.be.greaterThan(0);
  });

  it('renders the header without a ×N suffix when servings is 1', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    clickLog(container);

    const header = container.querySelector('[data-testid="recipe-group-header"]')!;
    expect(header.querySelector('[data-testid="recipe-group-label"]')!.textContent).to.equal('Omelette');
  });

  it('refuses to log when every amount is blank', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    setDraftAmount(container, 'seed-egg', '');
    setDraftAmount(container, 'seed-chicken', '');
    clickLog(container);

    const err = container.querySelector('[data-testid="error-message"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('Enter at least one amount greater than 0.');
  });

  it('refuses to log when servings is 0', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    setServings(container, '0');
    clickLog(container);

    const err = container.querySelector('[data-testid="error-message"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('Enter servings greater than 0.');
  });

  it('removes the header and both rows when the group × is clicked', () => {
    const repo = repoWithOmelette();
    createApp({ container, repo, clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    clickLog(container);

    (container.querySelector('[data-testid="recipe-group-delete"]') as HTMLButtonElement).click();

    expect(container.querySelector('[data-testid="recipe-group-header"]')).to.equal(null);
    expect(container.querySelectorAll('[data-testid="entry-row"]')).to.have.lengthOf(0);
    expect(repo.load().entries).to.have.lengthOf(0);
    expect(repo.load().recipeLogs).to.have.lengthOf(0);
  });

  it('deleting one item row leaves the header and the other row', () => {
    const repo = repoWithOmelette();
    createApp({ container, repo, clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    clickLog(container);

    const eggRow = Array.from(container.querySelectorAll('[data-testid="entry-row"]'))
      .find((r) => r.textContent!.includes('Egg'))!;
    (eggRow.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();

    expect(container.querySelector('[data-testid="recipe-group-header"]')).to.exist;
    const remaining = container.querySelectorAll('[data-testid="entry-row"]');
    expect(remaining).to.have.lengthOf(1);
    expect(remaining[0]!.textContent).to.contain('Chicken breast');
  });

  it('deleting the last item row removes the header too', () => {
    const repo = repoWithOmelette();
    createApp({ container, repo, clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    clickLog(container);

    let rows = Array.from(container.querySelectorAll('[data-testid="entry-row"]'));
    (rows[0]!.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();
    rows = Array.from(container.querySelectorAll('[data-testid="entry-row"]'));
    (rows[0]!.querySelector('[data-testid="delete-button"]') as HTMLButtonElement).click();

    expect(container.querySelector('[data-testid="recipe-group-header"]')).to.equal(null);
    expect(repo.load().recipeLogs).to.have.lengthOf(0);
  });

  it('resets the draft to the recipe portions and servings 1 after logging', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    setDraftAmount(container, 'seed-egg', '2');
    setServings(container, '2');
    clickLog(container);

    expect(draftAmountInput(container, 'seed-egg').value).to.equal('3');
    expect(draftAmountInput(container, 'seed-chicken').value).to.equal('60');
    expect(servingsInput(container).value).to.equal('1');
  });

  it('reload (new app from saved repo) shows the persisted group', () => {
    const repo = repoWithOmelette();
    const clock = fixedClock();
    createApp({ container, repo, clock });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    setServings(container, '2');
    clickLog(container);

    const repo2 = roundTripped(repo, clock.newId);
    const container2 = makeContainer();
    createApp({ container: container2, repo: repo2, clock: fixedClock() });
    const header = container2.querySelector('[data-testid="recipe-group-header"]')!;
    expect(header.querySelector('[data-testid="recipe-group-label"]')!.textContent).to.equal('Omelette ×2');
    expect(container2.querySelectorAll('[data-testid="entry-row"]')).to.have.lengthOf(2);
    container2.remove();
  });

  it('exports and re-imports recipes and recipe-log groups', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    setServings(container, '2');
    clickLog(container);

    clickFoodsTab(container);
    (container.querySelector('[data-testid="export-button"]') as HTMLButtonElement).click();
    const exported = (container.querySelector('[data-testid="export-textarea"]') as HTMLTextAreaElement).value;

    const repo2 = new InMemoryRepository();
    const container2 = makeContainer();
    createApp({ container: container2, repo: repo2, clock: fixedClock() });
    clickFoodsTab(container2);
    const ta = container2.querySelector('[data-testid="import-textarea"]') as HTMLTextAreaElement;
    ta.value = exported;
    ta.dispatchEvent(new Event('input'));
    (container2.querySelector('[data-testid="import-button"]') as HTMLButtonElement).click();

    clickLogTab(container2);
    const header = container2.querySelector('[data-testid="recipe-group-header"]')!;
    expect(header.querySelector('[data-testid="recipe-group-label"]')!.textContent).to.equal('Omelette ×2');
    expect(container2.querySelectorAll('[data-testid="entry-row"]')).to.have.lengthOf(2);
    expect(repo2.load().recipes.some((r) => r.name === 'Omelette')).to.equal(true);
    container2.remove();
  });

  it('after logging, the recipe outranks a never-logged food in an empty-query picker', () => {
    createApp({ container, repo: repoWithOmelette(), clock: fixedClock() });
    searchLog(container, 'omel');
    pickRecipe(container, 'Omelette');
    clickLog(container);

    searchLog(container, '');
    const firstOption = container.querySelector('[data-testid="food-option"], [data-testid="recipe-option"]')!;
    expect(firstOption.getAttribute('data-testid')).to.equal('recipe-option');
    expect(firstOption.textContent).to.contain('Omelette');
  });
});
