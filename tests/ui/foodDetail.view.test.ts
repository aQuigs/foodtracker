import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import { NUTRIENT_KEYS, MACRO_KEYS } from '../../src/domain/types.js';
import type { State } from '../../src/domain/types.js';
import { baseVm, foodDetail, makeContainer, noopHandlers } from '../_helpers.js';

function perServing(container: HTMLElement, key: string): HTMLElement | null {
  return container.querySelector(`[data-testid="food-detail-per-serving-${key}"]`) as HTMLElement | null;
}

function thisEntry(container: HTMLElement, key: string): HTMLElement | null {
  return container.querySelector(`[data-testid="food-detail-this-entry-${key}"]`) as HTMLElement | null;
}

describe('food detail card rendering', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('does not render any food detail when expandedDetail is null', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', expandedDetail: null }, noopHandlers);
    expect(foodDetail(container)).to.equal(null);
  });

  it('does not render any food detail when expandedDetail is for an entry', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'entry', id: 'e1' },
    }, noopHandlers);
    expect(foodDetail(container)).to.equal(null);
  });

  it('renders the food detail when expandedDetail.kind === "food" and id matches a known food', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    const card = foodDetail(container, 'seed-banana');
    expect(card).to.exist;
  });

  it('renders the card directly after its picker row in document order', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    const row = container.querySelector('[data-testid="food-option"][data-food-id="seed-banana"]') as HTMLElement;
    const card = foodDetail(container, 'seed-banana')!;
    expect(row.nextElementSibling).to.equal(card);
  });

  it('renders one per-serving and one this-entry line per NUTRIENT_KEYS entry', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    for (const key of NUTRIENT_KEYS) {
      expect(perServing(container, key), `missing per-serving line for ${key}`).to.exist;
      expect(thisEntry(container, key), `missing this-entry line for ${key}`).to.exist;
    }
  });

  it('per-serving column shows the food\'s stored nutrition (Banana: 89 cal, 1.1g protein)', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    expect(perServing(container, 'calories')!.textContent).to.contain('89');
    expect(perServing(container, 'protein')!.textContent).to.contain('1.1');
    expect(perServing(container, 'carbs')!.textContent).to.contain('22.8');
    expect(perServing(container, 'fat')!.textContent).to.contain('0.3');
  });

  it('per-serving macros show percent of calories', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    for (const key of MACRO_KEYS) {
      expect(perServing(container, key)!.textContent, `${key} should have %`).to.match(/\d+\s*%/);
    }
    expect(perServing(container, 'calories')!.textContent, 'calories should not have %').to.not.match(/%/);
  });

  it('this-entry column shows live values when amount is valid (Banana 120g → 107 cal)', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      amount: '120',
      logUnit: 'g',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    expect(thisEntry(container, 'calories')!.textContent).to.contain('107');
    expect(thisEntry(container, 'protein')!.textContent).to.contain('1.3');
  });

  it('this-entry macros show percent of calories when amount is valid', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      amount: '120',
      logUnit: 'g',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    for (const key of MACRO_KEYS) {
      expect(thisEntry(container, key)!.textContent, `${key} should have %`).to.match(/\d+\s*%/);
    }
  });

  it('this-entry shows literal zeros when amount === "0" (no percentages, calories are 0)', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      amount: '0',
      logUnit: 'g',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    expect(thisEntry(container, 'calories')!.textContent).to.contain('0 cal');
    expect(thisEntry(container, 'protein')!.textContent).to.contain('0 g');
    expect(thisEntry(container, 'calories')!.textContent).to.not.match(/%/);
    expect(thisEntry(container, 'protein')!.textContent).to.not.match(/%/);
  });

  it('this-entry shows em-dash when amount is empty', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      amount: '',
      logUnit: 'g',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    for (const key of NUTRIENT_KEYS) {
      expect(thisEntry(container, key)!.textContent, `${key} should be dash`).to.contain('—');
      expect(thisEntry(container, key)!.textContent, `${key} should not have %`).to.not.match(/%/);
    }
  });

  it('this-entry shows em-dash for negative or non-numeric amount', () => {
    for (const bad of ['-5', 'abc', '   ']) {
      render(container, {
        ...baseVm,
        selectedFoodId: 'seed-banana',
        amount: bad,
        logUnit: 'g',
        expandedDetail: { kind: 'food', id: 'seed-banana' },
      }, noopHandlers);
      expect(thisEntry(container, 'calories')!.textContent, `amount=${JSON.stringify(bad)}`).to.contain('—');
    }
  });

  it('row sets aria-expanded=true when its food card is open', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    const row = container.querySelector('[data-testid="food-option"][data-food-id="seed-banana"]') as HTMLElement;
    expect(row.getAttribute('aria-expanded')).to.equal('true');
  });

  it('row sets aria-expanded=false when selected but card closed', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: null,
    }, noopHandlers);
    const row = container.querySelector('[data-testid="food-option"][data-food-id="seed-banana"]') as HTMLElement;
    expect(row.getAttribute('aria-expanded')).to.equal('false');
  });

  it('non-selected rows have no aria-expanded attribute', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    const oatsRow = container.querySelector('[data-testid="food-option"][data-food-id="seed-oats"]') as HTMLElement;
    expect(oatsRow.hasAttribute('aria-expanded')).to.equal(false);
  });

  it('clicking the selected row fires onToggleFood with the food id', () => {
    let captured: string | null = null;
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, { ...noopHandlers, onToggleFood: (id) => { captured = id; } });
    const row = container.querySelector('[data-testid="food-option"][data-food-id="seed-banana"]') as HTMLElement;
    row.click();
    expect(captured).to.equal('seed-banana');
  });

  it('clicking a non-selected row still fires onFoodSelect (not onToggleFood)', () => {
    let selected: string | null = null;
    let toggled: string | null = null;
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, { ...noopHandlers,
      onFoodSelect: (id) => { selected = id; },
      onToggleFood: (id) => { toggled = id; },
    });
    const oatsRow = container.querySelector('[data-testid="food-option"][data-food-id="seed-oats"]') as HTMLElement;
    oatsRow.click();
    expect(selected).to.equal('seed-oats');
    expect(toggled).to.equal(null);
  });

  it('Enter on the selected row fires onToggleFood', () => {
    let captured: string | null = null;
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, { ...noopHandlers, onToggleFood: (id) => { captured = id; } });
    const row = container.querySelector('[data-testid="food-option"][data-food-id="seed-banana"]') as HTMLElement;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(captured).to.equal('seed-banana');
  });

  it('card has role=region and an aria-label referencing the food name', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);
    const card = foodDetail(container, 'seed-banana')!;
    expect(card.getAttribute('role')).to.equal('region');
    expect(card.getAttribute('aria-label')).to.match(/Banana/);
  });

  it('renders for a count food (seed-egg) and shows count values', () => {
    render(container, {
      ...baseVm,
      selectedFoodId: 'seed-egg',
      logUnit: 'count',
      amount: '2',
      expandedDetail: { kind: 'food', id: 'seed-egg' },
    }, noopHandlers);
    const card = foodDetail(container, 'seed-egg');
    expect(card).to.exist;
    expect(thisEntry(container, 'calories')!.textContent).to.contain('156');
  });

  it('suppresses the this-entry column when the food has invalid servingSize', () => {
    const foods = freshState().foods.map((f) =>
      f.id === 'seed-egg' ? { ...f, servingSize: 0 } : f);
    const state: State = { version: 1, foods, entries: [] };
    render(container, {
      ...baseVm,
      state,
      selectedFoodId: 'seed-egg',
      amount: '1',
      logUnit: 'count',
      expandedDetail: { kind: 'food', id: 'seed-egg' },
    }, noopHandlers);
    expect(perServing(container, 'calories')!.textContent).to.contain('78');
    expect(thisEntry(container, 'calories')).to.equal(null);
  });
});
