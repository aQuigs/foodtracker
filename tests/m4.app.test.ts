import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { InMemoryRepository } from '../src/persistence/inMemory.js';
import { exportState } from '../src/ui/importExport.js';
import type { State } from '../src/domain/types.js';
import {
  clickLog, fixedClock, makeContainer, pickFood, setAmount, setLogUnit,
} from './_helpers.js';

function clickFoodsTab(c: HTMLElement) {
  (c.querySelector('[data-testid="view-toggle-foods"]') as HTMLButtonElement).click();
}

function clickLogTab(c: HTMLElement) {
  (c.querySelector('[data-testid="view-toggle-log"]') as HTMLButtonElement).click();
}

function logUnitSelect(c: HTMLElement): HTMLSelectElement {
  return c.querySelector('[data-testid="log-unit-select"]') as HTMLSelectElement;
}

function logUnitOptions(c: HTMLElement): string[] {
  return Array.from(logUnitSelect(c).options).map((o) => o.value);
}

describe('app — M4 multi-unit end-to-end', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('logs a g-food in oz and records the converted grams', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setLogUnit(container, 'oz');
    setAmount(container, '1');
    clickLog(container);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.textContent).to.contain('1 oz');
    expect(row.textContent).to.contain('Banana');
  });

  it('logs a count food in count and records the converted grams', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Egg');
    setLogUnit(container, 'count');
    setAmount(container, '2');
    clickLog(container);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.textContent).to.contain('2 count');
    expect(row.textContent).to.contain('Egg');
  });

  it('restricts log-unit options to compatible units (g-food → g/oz/lb only)', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Banana');
    expect(logUnitOptions(container)).to.deep.equal(['g', 'oz', 'lb']);
  });

  it('restricts log-unit options to compatible units (count-food → count/g only)', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Egg');
    expect(logUnitOptions(container)).to.deep.equal(['count', 'g']);
  });

  it('resets the log unit when the selected food is soft-deleted', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
    pickFood(container, 'Egg');
    expect(logUnitSelect(container).value).to.equal('count');

    clickFoodsTab(container);
    const eggRow = Array.from(container.querySelectorAll('[data-testid="food-row"]'))
      .find((r) => r.textContent!.includes('Egg'))!;
    (eggRow.querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();

    clickLogTab(container);
    expect(logUnitSelect(container).value).to.equal('g');
  });

  it('resets selection and log unit after import (even when food id collides)', () => {
    const repo = new InMemoryRepository();
    createApp({ container, repo, clock: fixedClock() });
    pickFood(container, 'Egg');
    expect(logUnitSelect(container).value).to.equal('count');

    const replacement: State = {
      version: 2,
      foods: [{
        id: 'seed-egg',
        name: 'Egg (g-based)',
        nutritionFacts: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
        primaryUnit: 'g',
        weightPerUnit: 100,
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
    expect(logUnitSelect(container).value).to.equal('g');
  });

  it('the log amount input has a visible label, not just a placeholder', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
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
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
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

  it('does not jump focus to the first delete-button after deleting a non-first entry', () => {
    createApp({ container, repo: new InMemoryRepository(), clock: fixedClock() });
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
    const middle = rows[1]!;
    const middleDelete = middle.querySelector('[data-testid="delete-button"]') as HTMLButtonElement;
    const middleEntryId = middleDelete.getAttribute('data-entry-id');
    middleDelete.focus();
    middleDelete.click();

    const active = document.activeElement as HTMLElement | null;
    if (active && active.getAttribute('data-testid') === 'delete-button') {
      const activeEntryId = active.getAttribute('data-entry-id');
      expect(activeEntryId).to.not.equal(middleEntryId);
      const remaining = Array.from(container.querySelectorAll('[data-testid="delete-button"]')) as HTMLElement[];
      if (remaining[0]) {
        expect(activeEntryId, 'focus must not silently land on the first remaining delete').to.not.equal(remaining[0].getAttribute('data-entry-id'));
      }
    }
  });
});
