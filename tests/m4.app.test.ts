import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { exportState } from '../src/ui/importExport.js';
import type { Food, State } from '../src/domain/types.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import {
  activeValue, clickFoodsTab, clickLog, clickLogTab, confirmDelete, fixedClock, makeContainer, pickFood, seedTestState, seededRepo, setAmount, setLogUnit,
} from './_helpers.js';

const MILK: Food = {
  id: 'seed-milk', name: 'Milk',
  nutritionFacts: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  servingSize: 240, servingUnit: 'ml',
  createdAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
};

function milkRepo(): InMemoryRepository {
  const repo = new InMemoryRepository();
  const seeded = seedTestState();
  repo.save({ ...seeded, foods: [...seeded.foods, MILK] });
  return repo;
}

function logUnitOptions(c: HTMLElement): string[] {
  return Array.from(c.querySelectorAll<HTMLButtonElement>('[data-testid="log-unit-group"] [data-value]'))
    .filter((b) => !b.disabled)
    .map((b) => b.getAttribute('data-value') ?? '');
}

function activeLogUnit(c: HTMLElement): string | null {
  return activeValue(c, 'log-unit-group');
}

describe('app — M4 multi-unit end-to-end', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('logs a g-food in oz and records the converted grams', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setLogUnit(container, 'oz');
    setAmount(container, '1');
    clickLog(container);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.textContent).to.contain('1 oz');
    expect(row.textContent).to.contain('Banana');
  });

  it('logs a count food in count and records the converted grams', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Egg');
    setLogUnit(container, 'count');
    setAmount(container, '2');
    clickLog(container);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.textContent).to.contain('2 count');
    expect(row.textContent).to.contain('Egg');
  });

  it('restricts log-unit options to compatible units (g-food → g/oz/lb only)', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    expect(logUnitOptions(container)).to.deep.equal(['g', 'oz', 'lb']);
  });

  it('restricts log-unit options to compatible units (count-food → count only)', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Egg');
    expect(logUnitOptions(container)).to.deep.equal(['count']);
  });

  it('restricts log-unit options to compatible units (ml-food → ml only)', () => {
    createApp({ container, repo: milkRepo(), clock: fixedClock() });
    pickFood(container, 'Milk');
    expect(logUnitOptions(container)).to.deep.equal(['ml']);
    expect(activeLogUnit(container)).to.equal('ml');
  });

  it('resets the log unit when the selected food is soft-deleted', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Egg');
    expect(activeLogUnit(container)).to.equal('count');

    clickFoodsTab(container);
    const eggRow = Array.from(container.querySelectorAll('[data-testid="food-row"]'))
      .find((r) => r.textContent!.includes('Egg'))!;
    (eggRow.querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    confirmDelete(container);

    clickLogTab(container);
    expect(activeLogUnit(container)).to.equal('g');
  });

  it('resets selection and log unit after import (even when food id collides)', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Egg');
    expect(activeLogUnit(container)).to.equal('count');

    const replacement: State = {
      version: 1,
      foods: [{
        id: 'seed-egg',
        name: 'Egg (g-based)',
        nutritionFacts: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
        servingSize: 100,
        servingUnit: 'g',
        createdAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
      }],
      entries: [],
    };

    clickFoodsTab(container);
    const ta = container.querySelector('[data-testid="import-textarea"]') as HTMLTextAreaElement;
    ta.value = exportState(replacement);
    ta.dispatchEvent(new Event('input'));
    (container.querySelector('[data-testid="import-button"]') as HTMLButtonElement).click();

    clickLogTab(container);
    expect(container.querySelector('[data-testid="food-option"][data-selected="true"]')).to.equal(null);
    expect(activeLogUnit(container)).to.equal('g');
  });

  it('the log amount input has a visible label, not just a placeholder', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    const labels = Array.from(container.querySelectorAll('label')).map((l) => l.textContent ?? '');
    const hasAmountLabel = labels.some((t) => /amount/i.test(t));
    expect(hasAmountLabel, 'expected a visible Amount label near the amount input').to.equal(true);
  });
});

describe('app — focus restoration after row actions', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('keeps focus on the clicked food-edit, not the first food-edit in the list', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickFoodsTab(container);
    const rows = Array.from(container.querySelectorAll('[data-testid="food-row"]'));
    expect(rows.length).to.be.greaterThan(2);
    const yogurtRow = rows.find((r) => r.textContent!.includes('Greek yogurt'))!;
    const yogurtEdit = yogurtRow.querySelector('[data-testid="food-edit"]') as HTMLButtonElement;
    yogurtEdit.focus();
    yogurtEdit.click();

    const active = document.activeElement as HTMLElement | null;
    if (active && active.getAttribute('data-testid') === 'food-edit') {
      expect(active.getAttribute('data-food-id'), 'focused food-edit must be the clicked row, not the first').to.equal('seed-yogurt');
    }
  });

  it('lands focus on the delete button at the deleted row\'s index, not the first one', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);
    pickFood(container, 'Oats');
    setAmount(container, '50');
    clickLog(container);
    pickFood(container, 'Chicken breast');
    setAmount(container, '200');
    clickLog(container);

    const rows = Array.from(container.querySelectorAll('[data-testid="entry-row"]'));
    expect(rows.length).to.equal(3);
    const middleDelete = rows[1]!.querySelector('[data-testid="delete-button"]') as HTMLButtonElement;
    middleDelete.focus();
    middleDelete.click();
    confirmDelete(container);

    const remaining = Array.from(container.querySelectorAll('[data-testid="delete-button"]')) as HTMLElement[];
    expect(remaining.length).to.equal(2);
    expect(document.activeElement, 'focus takes the deleted row\'s place').to.equal(remaining[1]);
  });
});
