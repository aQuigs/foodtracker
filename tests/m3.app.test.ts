import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { exportState } from '../src/ui/importExport.js';
import type { Clock } from '../src/app.js';
import type { State } from '../src/domain/types.js';
import { seedTestState } from './_helpers.js';

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

function clickFoodsTab(c: HTMLElement) {
  (c.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();
}
function clickLogTab(c: HTMLElement) {
  (c.querySelector('[data-testid="view-toggle-log"]') as HTMLButtonElement).click();
}
function typeForm(c: HTMLElement, field: string, value: string) {
  const input = c.querySelector(`[data-testid="food-form-${field}"]`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('app — Foods view (M3)', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('starts on Log view by default', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    expect(container.querySelector('[data-testid="log-button"]')).to.exist;
    expect(container.querySelector('[data-testid="food-form"]')).to.equal(null);
  });

  it('switches to Foods view via the toggle', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    clickFoodsTab(container);
    expect(container.querySelector('[data-testid="food-form"]')).to.exist;
    expect(container.querySelector('[data-testid="log-button"]')).to.equal(null);
  });

  it('adds a custom food and persists it', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    clickFoodsTab(container);
    typeForm(container, 'name', 'Cheese');
    typeForm(container, 'calories', '402');
    typeForm(container, 'protein', '25');
    typeForm(container, 'carbs', '1.3');
    typeForm(container, 'fat', '33');
    (container.querySelector('[data-testid="food-form-submit"]') as HTMLButtonElement).click();

    const rows = Array.from(container.querySelectorAll('[data-testid="food-row-name"]')).map((r) => r.textContent!.trim());
    expect(rows).to.include('Cheese');
    expect(repo.load().foods.find((f) => f.name === 'Cheese')).to.exist;
  });

  it('shows an error and does not add on invalid form input', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    clickFoodsTab(container);
    typeForm(container, 'name', '');
    (container.querySelector('[data-testid="food-form-submit"]') as HTMLButtonElement).click();
    const err = container.querySelector('[data-testid="food-form-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('Enter a name.');
  });

  it('rejects duplicate name', () => {
    const repo = new InMemoryRepository();
    repo.save(seedTestState());
    createApp({ container, repo, clock: fixedClock() });
    clickFoodsTab(container);
    typeForm(container, 'name', 'Banana');
    typeForm(container, 'calories', '90');
    (container.querySelector('[data-testid="food-form-submit"]') as HTMLButtonElement).click();
    const err = container.querySelector('[data-testid="food-form-error"]');
    expect(err!.textContent).to.contain('already exists');
  });

  it('edits an existing food', () => {
    const repo = new InMemoryRepository();
    repo.save(seedTestState());
    createApp({ container, repo, clock: fixedClock() });
    clickFoodsTab(container);
    const editButtons = container.querySelectorAll('[data-testid="food-edit"]');
    (editButtons[0] as HTMLButtonElement).click();
    typeForm(container, 'calories', '999');
    (container.querySelector('[data-testid="food-form-submit"]') as HTMLButtonElement).click();
    const updated = repo.load().foods.find((f) => f.nutritionFacts.calories === 999);
    expect(updated).to.exist;
  });

  it('filters the foods list via the foods-search input', () => {
    const repo = new InMemoryRepository();
    repo.save(seedTestState());
    createApp({ container, repo, clock: fixedClock() });
    clickFoodsTab(container);
    const search = container.querySelector('[data-testid="foods-search"]') as HTMLInputElement;
    search.value = 'ban';
    search.dispatchEvent(new Event('input'));
    const rows = Array.from(container.querySelectorAll('[data-testid="food-row-name"]')).map((r) => r.textContent!.trim());
    expect(rows).to.deep.equal(['Banana']);
  });

  it('cancels an edit and resets the form', () => {
    const repo = new InMemoryRepository();
    repo.save(seedTestState());
    createApp({ container, repo, clock: fixedClock() });
    clickFoodsTab(container);
    (container.querySelector('[data-testid="food-edit"]') as HTMLButtonElement).click();
    expect((container.querySelector('[data-testid="food-form-name"]') as HTMLInputElement).value).to.not.equal('');
    (container.querySelector('[data-testid="food-form-cancel"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="food-form-cancel"]')).to.equal(null);
    expect((container.querySelector('[data-testid="food-form-name"]') as HTMLInputElement).value).to.equal('');
  });

  it('soft-deletes a food and hides it from both the Foods view and the Log picker', () => {
    const repo = new InMemoryRepository();
    repo.save(seedTestState());
    createApp({ container, repo, clock: fixedClock() });
    clickFoodsTab(container);
    const before = container.querySelectorAll('[data-testid="food-row"]').length;
    (container.querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    const after = container.querySelectorAll('[data-testid="food-row"]').length;
    expect(after).to.equal(before - 1);

    const persisted = repo.load().foods.find((f) => f.deletedAt !== null);
    expect(persisted, 'deletedAt set on one food').to.exist;

    clickLogTab(container);
    const optNames = Array.from(container.querySelectorAll('[data-testid="food-option"]')).map((o) => o.textContent!.trim());
    expect(optNames).to.not.include(persisted!.name);
  });

  it('historical entries for a soft-deleted food still render in totals (M1a contract)', () => {
    const repo = new InMemoryRepository();
    repo.save(seedTestState());
    createApp({ container, repo, clock: fixedClock() });
    const search = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    search.value = 'banana';
    search.dispatchEvent(new Event('input'));
    (container.querySelector('[data-testid="food-option"]') as HTMLButtonElement).click();
    const grams = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    grams.value = '100';
    grams.dispatchEvent(new Event('input'));
    (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(1);

    clickFoodsTab(container);
    const bananaDelete = Array.from(container.querySelectorAll('[data-testid="food-row"]'))
      .find((r) => r.querySelector('[data-testid="food-row-name"]')!.textContent!.includes('Banana'))!
      .querySelector('[data-testid="food-delete"]') as HTMLButtonElement;
    bananaDelete.click();

    clickLogTab(container);
    expect(container.querySelectorAll('[data-testid="entry-row"]').length).to.equal(1);
    expect(container.querySelector('[data-testid="totals-row"]')!.textContent).to.contain('89');
  });

  it('exports state to clipboard via copy fn', async () => {
    let captured: string | null = null;
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock(), copyToClipboard: (t) => { captured = t; } });
    clickFoodsTab(container);
    (container.querySelector('[data-testid="export-button"]') as HTMLButtonElement).click();
    expect(captured).to.be.a('string');
    expect(JSON.parse(captured!)).to.deep.equal(repo.load());
  });

  it('exports state into a visible textarea (clipboard fallback)', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock(), copyToClipboard: () => {} });
    clickFoodsTab(container);
    const taBefore = container.querySelector('[data-testid="export-textarea"]') as HTMLTextAreaElement;
    expect(taBefore.value).to.equal('');
    (container.querySelector('[data-testid="export-button"]') as HTMLButtonElement).click();
    const taAfter = container.querySelector('[data-testid="export-textarea"]') as HTMLTextAreaElement;
    expect(taAfter.value).to.be.a('string').and.have.length.greaterThan(0);
    expect(JSON.parse(taAfter.value)).to.deep.equal(repo.load());
  });

  it('exports do not throw when clipboard fn rejects', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock(), copyToClipboard: () => Promise.reject(new Error('denied')) });
    clickFoodsTab(container);
    (container.querySelector('[data-testid="export-button"]') as HTMLButtonElement).click();
    const ta = container.querySelector('[data-testid="export-textarea"]') as HTMLTextAreaElement;
    expect(ta.value).to.have.length.greaterThan(0);
  });

  it('imports state and replaces existing', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    clickFoodsTab(container);
    const replacement: State = {
      version: 1,
      foods: [{
        id: 'only', name: 'Only food',
        nutritionFacts: { calories: 100, protein: 5, carbs: 10, fat: 2 },
        servingUnit: 'g', servingSize: 100,
        createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
      }],
      entries: [],
    };
    const ta = container.querySelector('[data-testid="import-textarea"]') as HTMLTextAreaElement;
    ta.value = exportState(replacement);
    ta.dispatchEvent(new Event('input'));
    (container.querySelector('[data-testid="import-button"]') as HTMLButtonElement).click();

    const rows = Array.from(container.querySelectorAll('[data-testid="food-row-name"]')).map((r) => r.textContent!.trim());
    expect(rows).to.deep.equal(['Only food']);
    expect(repo.load().foods.length).to.equal(1);
  });

  it('rejects invalid import without changing state', () => {
    const repo = new InMemoryRepository();
    const before = repo.load();
    createApp({ container, repo, clock: fixedClock() });
    clickFoodsTab(container);
    const ta = container.querySelector('[data-testid="import-textarea"]') as HTMLTextAreaElement;
    ta.value = 'not json';
    ta.dispatchEvent(new Event('input'));
    (container.querySelector('[data-testid="import-button"]') as HTMLButtonElement).click();
    const err = container.querySelector('[data-testid="import-error"]');
    expect(err).to.exist;
    expect(repo.load()).to.deep.equal(before);
  });
});

describe('app — recently used sort on log view', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('places a recently-logged food first when query is empty', () => {
    const repo = new InMemoryRepository();
    repo.save(seedTestState());
    createApp({ container, repo, clock: fixedClock() });
    const search = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    search.value = 'broccoli';
    search.dispatchEvent(new Event('input'));
    (container.querySelector('[data-testid="food-option"]') as HTMLButtonElement).click();
    const grams = container.querySelector('[data-testid="amount-input"]') as HTMLInputElement;
    grams.value = '100';
    grams.dispatchEvent(new Event('input'));
    (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();

    search.value = '';
    search.dispatchEvent(new Event('input'));
    const firstOption = container.querySelector('[data-testid="food-option"]');
    expect(firstOption!.textContent).to.contain('Broccoli');
  });
});
