import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { baseVm, makeContainer, noopHandlers, seedTestState } from '../_helpers.js';
import type { Entry, Food, Recipe, RecipeLog, State } from '../../src/domain/types.js';
import type { RecipeDraft } from '../../src/ui/recipeIntents.js';

const omelette: Recipe = {
  id: 'r1', name: 'Omelette',
  items: [
    { foodId: 'seed-egg', amount: 3, unit: 'count' },
    { foodId: 'seed-chicken', amount: 60, unit: 'g' },
  ],
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

function stateWithRecipe(...recipes: Recipe[]): State {
  return { ...seedTestState(), recipes };
}

function draft(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return { recipeId: 'r1', amounts: { 'seed-egg': '3', 'seed-chicken': '60' }, servings: '1', ...overrides };
}

function recipeOption(container: HTMLElement, id = 'r1'): HTMLElement {
  return container.querySelector(`[data-testid="recipe-option"][data-recipe-id="${id}"]`) as HTMLElement;
}

function recipeDetail(container: HTMLElement, id = 'r1'): HTMLElement | null {
  return container.querySelector(`[data-testid="recipe-detail"][data-recipe-id="${id}"]`) as HTMLElement | null;
}

function draftItemRow(container: HTMLElement, foodId: string): HTMLElement {
  return container.querySelector(`[data-testid="recipe-draft-item"][data-food-id="${foodId}"]`) as HTMLElement;
}

describe('view — log picker recipe rows', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('shows a Recipe tag on a recipe option', () => {
    const state = stateWithRecipe(omelette);
    render(container, { ...baseVm, state, query: 'omel' }, noopHandlers);
    const opt = recipeOption(container);
    expect(opt).to.exist;
    const tag = opt.querySelector('[data-testid="picker-tag"]');
    expect(tag).to.exist;
    expect(tag!.textContent).to.equal('Recipe');
  });

  it('marks the recipe row selected when recipeDraft.recipeId matches', () => {
    const state = stateWithRecipe(omelette);
    render(container, { ...baseVm, state, recipeDraft: draft() }, noopHandlers);
    expect(recipeOption(container).getAttribute('data-selected')).to.equal('true');
  });

  it('does not select the recipe row without a matching draft', () => {
    const state = stateWithRecipe(omelette);
    render(container, { ...baseVm, state }, noopHandlers);
    expect(recipeOption(container).hasAttribute('data-selected')).to.equal(false);
  });

  it('sets aria-expanded and mounts the card when the recipe is open', () => {
    const state = stateWithRecipe(omelette);
    render(container, {
      ...baseVm, state, recipeDraft: draft(), expandedDetail: { kind: 'recipe', id: 'r1' },
    }, noopHandlers);
    expect(recipeOption(container).getAttribute('aria-expanded')).to.equal('true');
    expect(recipeDetail(container)).to.exist;
  });

  it('renders the card directly after its picker row', () => {
    const state = stateWithRecipe(omelette);
    render(container, {
      ...baseVm, state, recipeDraft: draft(), expandedDetail: { kind: 'recipe', id: 'r1' },
    }, noopHandlers);
    const row = recipeOption(container);
    expect(row.nextElementSibling).to.equal(recipeDetail(container));
  });

  it('sets aria-expanded=false when selected but the card is closed', () => {
    const state = stateWithRecipe(omelette);
    render(container, { ...baseVm, state, recipeDraft: draft(), expandedDetail: null }, noopHandlers);
    expect(recipeOption(container).getAttribute('aria-expanded')).to.equal('false');
    expect(recipeDetail(container)).to.equal(null);
  });

  it('fires onRecipeSelect when a non-selected recipe row is clicked', () => {
    let captured: string | null = null;
    const state = stateWithRecipe(omelette);
    render(container, { ...baseVm, state }, { ...noopHandlers, onRecipeSelect: (id) => { captured = id; } });
    recipeOption(container).click();
    expect(captured).to.equal('r1');
  });

  it('fires onToggleRecipe when the selected recipe row is clicked again', () => {
    let selected: string | null = null;
    let toggled: string | null = null;
    const state = stateWithRecipe(omelette);
    render(container, { ...baseVm, state, recipeDraft: draft() }, {
      ...noopHandlers,
      onRecipeSelect: (id) => { selected = id; },
      onToggleRecipe: (id) => { toggled = id; },
    });
    recipeOption(container).click();
    expect(toggled).to.equal('r1');
    expect(selected).to.equal(null);
  });
});

describe('view — recipe draft card', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  function openCard(overrides: Partial<RecipeDraft> = {}): void {
    const state = stateWithRecipe(omelette);
    render(container, {
      ...baseVm, state, recipeDraft: draft(overrides), expandedDetail: { kind: 'recipe', id: 'r1' },
    }, noopHandlers);
  }

  it('renders one row per recipe item with amount and unit', () => {
    openCard();
    const eggRow = draftItemRow(container, 'seed-egg');
    expect(eggRow).to.exist;
    expect((eggRow.querySelector('[data-testid="recipe-draft-amount"]') as HTMLInputElement).value).to.equal('3');
    expect(eggRow.textContent).to.contain('count');

    const chickenRow = draftItemRow(container, 'seed-chicken');
    expect((chickenRow.querySelector('[data-testid="recipe-draft-amount"]') as HTMLInputElement).value).to.equal('60');
    expect(chickenRow.textContent).to.contain('g');
  });

  it('computes per-item calories from the typed amount, unscaled by servings', () => {
    openCard({ servings: '2' });
    // 3 count * 78 cal = 234
    expect(draftItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-draft-item-cal"]')!.textContent)
      .to.equal('234 cal');
    // 60g * 165 cal/100g = 99
    expect(draftItemRow(container, 'seed-chicken').querySelector('[data-testid="recipe-draft-item-cal"]')!.textContent)
      .to.equal('99 cal');
  });

  it('shows a dash for a blank amount', () => {
    openCard({ amounts: { 'seed-egg': '', 'seed-chicken': '60' } });
    expect(draftItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-draft-item-cal"]')!.textContent)
      .to.equal('—');
  });

  it('shows a dash for a zero amount', () => {
    openCard({ amounts: { 'seed-egg': '0', 'seed-chicken': '60' } });
    expect(draftItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-draft-item-cal"]')!.textContent)
      .to.equal('—');
  });

  it('shows a brand tag in a draft item\'s name when its food is a pack food', () => {
    const costcoAlmonds: Food = {
      id: 'costco-almonds', name: 'Almonds', source: 'costco',
      nutritionFacts: { calories: 579, protein: 21, carbs: 22, fat: 50 },
      servingSize: 100, servingUnit: 'g', createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    };
    const snack: Recipe = {
      id: 'r2', name: 'Snack',
      items: [{ foodId: 'costco-almonds', amount: 30, unit: 'g' }],
      createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    };
    const base = seedTestState();
    const state: State = { ...base, foods: [...base.foods, costcoAlmonds], recipes: [snack] };
    render(container, {
      ...baseVm, state,
      recipeDraft: { recipeId: 'r2', amounts: { 'costco-almonds': '30' }, servings: '1' },
      expandedDetail: { kind: 'recipe', id: 'r2' },
    }, noopHandlers);
    const row = draftItemRow(container, 'costco-almonds');
    expect(row.querySelector('[data-testid="source-tag"]')).to.exist;
    expect(row.textContent).to.contain('Almonds');
  });

  it('computes the total as amounts × servings when the draft is valid', () => {
    openCard({ amounts: { 'seed-egg': '2', 'seed-chicken': '60' }, servings: '2' });
    // (2*78 + 60/100*165) * 2 = (156 + 99) * 2 = 510
    const total = container.querySelector('[data-testid="recipe-draft-total"]')!.textContent!;
    expect(total).to.contain('Total');
    expect(total).to.contain('510 cal');
  });

  it('shows "Total —" when every amount is blank', () => {
    openCard({ amounts: { 'seed-egg': '', 'seed-chicken': '' } });
    expect(container.querySelector('[data-testid="recipe-draft-total"]')!.textContent).to.equal('Total —');
  });

  it('shows "Total —" when servings is invalid', () => {
    openCard({ servings: '0' });
    expect(container.querySelector('[data-testid="recipe-draft-total"]')!.textContent).to.equal('Total —');
  });

  function multiplierHint(foodId: string): HTMLElement {
    return draftItemRow(container, foodId).querySelector('[data-testid="recipe-draft-multiplier"]') as HTMLElement;
  }

  it('shows an N× hint before each amount when servings is not 1, updated as servings changes', () => {
    openCard({ servings: '2' });
    for (const foodId of ['seed-egg', 'seed-chicken']) {
      const hint = multiplierHint(foodId);
      expect(hint.textContent).to.equal('2×');

      const input = draftItemRow(container, foodId).querySelector('[data-testid="recipe-draft-amount"]')!;
      expect(hint.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).to.not.equal(0);
    }

    openCard({ servings: '3' });
    expect(multiplierHint('seed-egg').textContent).to.equal('3×');
  });

  it('keeps fractional servings in the hint', () => {
    openCard({ servings: '1.5' });
    expect(multiplierHint('seed-egg').textContent).to.equal('1.5×');
  });

  it('shows no hint at servings 1', () => {
    openCard();
    expect(multiplierHint('seed-egg').textContent).to.equal('');
  });

  it('shows no hint when servings is invalid', () => {
    openCard({ servings: '0' });
    expect(multiplierHint('seed-egg').textContent).to.equal('');
  });

  it('excludes a deleted item from the total, like its row', () => {
    const deletedChicken = { ...seedTestState().foods.find((f) => f.id === 'seed-chicken')!, deletedAt: '2026-02-01T00:00:00Z' };
    const state: State = {
      ...stateWithRecipe(omelette),
      foods: seedTestState().foods.map((f) => f.id === 'seed-chicken' ? deletedChicken : f),
    };
    render(container, {
      ...baseVm, state, recipeDraft: draft(), expandedDetail: { kind: 'recipe', id: 'r1' },
    }, noopHandlers);
    // Egg 3 count * 78 cal = 234; chicken is deleted and excluded from the total.
    const total = container.querySelector('[data-testid="recipe-draft-total"]')!.textContent!;
    expect(total).to.contain('234 cal');
  });

  it('renders a deleted item food with a suffix and a dash, regardless of amount', () => {
    const deletedChicken = { ...seedTestState().foods.find((f) => f.id === 'seed-chicken')!, deletedAt: '2026-02-01T00:00:00Z' };
    const state: State = {
      ...stateWithRecipe(omelette),
      foods: seedTestState().foods.map((f) => f.id === 'seed-chicken' ? deletedChicken : f),
    };
    render(container, {
      ...baseVm, state, recipeDraft: draft(), expandedDetail: { kind: 'recipe', id: 'r1' },
    }, noopHandlers);
    const row = draftItemRow(container, 'seed-chicken');
    expect(row.textContent).to.contain('Chicken breast (deleted)');
    expect(row.querySelector('[data-testid="recipe-draft-item-cal"]')!.textContent).to.equal('—');
  });

  it('fires onRecipeDraftAmountChange with the food id and typed value', () => {
    let captured: [string, string] | null = null;
    const state = stateWithRecipe(omelette);
    render(container, {
      ...baseVm, state, recipeDraft: draft(), expandedDetail: { kind: 'recipe', id: 'r1' },
    }, { ...noopHandlers, onRecipeDraftAmountChange: (foodId, v) => { captured = [foodId, v]; } });
    const input = draftItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-draft-amount"]') as HTMLInputElement;
    input.value = '5';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.deep.equal(['seed-egg', '5']);
  });

  it('reuses the same amount input across a re-render, keeping focus and caret across a keystroke', () => {
    const state = stateWithRecipe(omelette);
    render(container, {
      ...baseVm, state, recipeDraft: draft(), expandedDetail: { kind: 'recipe', id: 'r1' },
    }, noopHandlers);
    const before = draftItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-draft-amount"]') as HTMLInputElement;
    before.focus();
    expect(document.activeElement).to.equal(before);

    render(container, {
      ...baseVm, state, recipeDraft: draft({ amounts: { 'seed-egg': '5', 'seed-chicken': '60' } }),
      expandedDetail: { kind: 'recipe', id: 'r1' },
    }, noopHandlers);

    const after = draftItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-draft-amount"]') as HTMLInputElement;
    expect(after).to.equal(before);
    expect(after.value).to.equal('5');
    expect(document.activeElement).to.equal(after);
  });

  it('reuses the same picker row for the selected recipe across a draft-only re-render', () => {
    const state = stateWithRecipe(omelette);
    render(container, {
      ...baseVm, state, recipeDraft: draft(), expandedDetail: { kind: 'recipe', id: 'r1' },
    }, noopHandlers);
    const before = recipeOption(container);

    render(container, {
      ...baseVm, state, recipeDraft: draft({ servings: '2' }), expandedDetail: { kind: 'recipe', id: 'r1' },
    }, noopHandlers);

    expect(recipeOption(container)).to.equal(before);
  });
});

describe('view — log row Servings vs Amount/Unit', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('shows Servings and hides Amount/Unit/chips when a recipe draft is active', () => {
    const state = stateWithRecipe(omelette);
    render(container, { ...baseVm, state, recipeDraft: draft(), selectedFoodId: null }, noopHandlers);

    const servingsInput = container.querySelector('[data-testid="servings-input"]') as HTMLInputElement;
    expect(servingsInput.closest('label')!.hidden).to.equal(false);
    expect(servingsInput.value).to.equal('1');

    expect((container.querySelector('[data-testid="amount-input"]') as HTMLElement).closest('label')!.hidden).to.equal(true);
    expect((container.querySelector('[data-testid="log-unit-group"]') as HTMLElement).closest('label')!.hidden).to.equal(true);
    expect((container.querySelector('[data-testid="chip-row"]') as HTMLElement).hidden).to.equal(true);
  });

  it('shows Amount/Unit and hides Servings without a recipe draft', () => {
    render(container, { ...baseVm, recipeDraft: null, selectedFoodId: 'seed-banana' }, noopHandlers);

    expect((container.querySelector('[data-testid="amount-input"]') as HTMLElement).closest('label')!.hidden).to.equal(false);
    expect((container.querySelector('[data-testid="log-unit-group"]') as HTMLElement).closest('label')!.hidden).to.equal(false);
    expect((container.querySelector('[data-testid="servings-input"]') as HTMLElement).closest('label')!.hidden).to.equal(true);
  });

  it('fires onServingsChange on the servings input', () => {
    let captured = '';
    const state = stateWithRecipe(omelette);
    render(container, { ...baseVm, state, recipeDraft: draft() }, { ...noopHandlers, onServingsChange: (v) => { captured = v; } });
    const input = container.querySelector('[data-testid="servings-input"]') as HTMLInputElement;
    input.value = '3';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.equal('3');
  });

  it('fires onLogRecipe when Log it is clicked with a recipe draft active', () => {
    let called = false;
    const state = stateWithRecipe(omelette);
    render(container, { ...baseVm, state, recipeDraft: draft() }, { ...noopHandlers, onLogRecipe: () => { called = true; } });
    (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();
    expect(called).to.equal(true);
  });

  it('fires onLog (not onLogRecipe) when Log it is clicked without a recipe draft', () => {
    let loggedRecipe = false;
    let logged: [string, string, string] | null = null;
    render(container, {
      ...baseVm, recipeDraft: null, selectedFoodId: 'seed-banana', amount: '100', logUnit: 'g',
    }, {
      ...noopHandlers,
      onLogRecipe: () => { loggedRecipe = true; },
      onLog: (foodId, amount, unit) => { logged = [foodId, amount, unit]; },
    });
    (container.querySelector('[data-testid="log-button"]') as HTMLButtonElement).click();
    expect(loggedRecipe).to.equal(false);
    expect(logged).to.deep.equal(['seed-banana', '100', 'g']);
  });
});

describe('view — grouped entries', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  function stateWithGroup(servings: number): State {
    const recipeLog: RecipeLog = { id: 'rl1', recipeId: 'r1', servings };
    const entries: Entry[] = [
      { id: 'e1', date: baseVm.today, foodId: 'seed-egg', amount: 3 * servings, unit: 'count', loggedAt: '2026-05-23T09:00:00Z', mealId: 'm1', recipeLogId: 'rl1' },
      { id: 'e2', date: baseVm.today, foodId: 'seed-chicken', amount: 60 * servings, unit: 'g', loggedAt: '2026-05-23T09:00:00Z', mealId: 'm1', recipeLogId: 'rl1' },
    ];
    return {
      ...stateWithRecipe(omelette),
      meals: [{ id: 'm1', date: baseVm.today, position: 0 }],
      entries,
      recipeLogs: [recipeLog],
    };
  }

  it('renders a group header with the recipe name, ×servings and total, before its entries', () => {
    const state = stateWithGroup(2);
    render(container, { ...baseVm, state }, noopHandlers);
    const header = container.querySelector('[data-testid="recipe-group-header"][data-recipe-log-id="rl1"]')!;
    expect(header.querySelector('[data-testid="recipe-group-label"]')!.textContent).to.equal('Omelette ×2');
    // egg 6 count * 78 = 468; chicken 120g * 1.65/g = 198 => 666
    expect(header.querySelector('[data-testid="recipe-group-total"]')!.textContent).to.equal('666 cal');

    const entryRows = Array.from(container.querySelectorAll('[data-testid="entry-row"]'));
    expect(entryRows).to.have.lengthOf(2);
    for (const row of entryRows) {
      expect(row.getAttribute('data-recipe-log-id')).to.equal('rl1');
      expect(row.classList.contains('entry-row-grouped')).to.equal(true);
    }
  });

  it('omits the ×N suffix when servings is 1', () => {
    const state = stateWithGroup(1);
    render(container, { ...baseVm, state }, noopHandlers);
    const header = container.querySelector('[data-testid="recipe-group-header"]')!;
    expect(header.querySelector('[data-testid="recipe-group-label"]')!.textContent).to.equal('Omelette');
  });

  it('does not group an ordinary entry with no recipeLogId', () => {
    const state: State = {
      ...stateWithRecipe(omelette),
      meals: [{ id: 'm1', date: baseVm.today, position: 0 }],
      entries: [{ id: 'e1', date: baseVm.today, foodId: 'seed-banana', amount: 100, unit: 'g', loggedAt: '2026-05-23T09:00:00Z', mealId: 'm1' }],
      recipeLogs: [],
    };
    render(container, { ...baseVm, state }, noopHandlers);
    expect(container.querySelector('[data-testid="recipe-group-header"]')).to.equal(null);
    const row = container.querySelector('[data-testid="entry-row"]')!;
    expect(row.hasAttribute('data-recipe-log-id')).to.equal(false);
    expect(row.classList.contains('entry-row-grouped')).to.equal(false);
  });

  it('fires onDeleteRecipeLog with the group id when the group × is clicked', () => {
    let captured: string | null = null;
    const state = stateWithGroup(2);
    render(container, { ...baseVm, state }, { ...noopHandlers, onDeleteRecipeLog: (id) => { captured = id; } });
    (container.querySelector('[data-testid="recipe-group-delete"]') as HTMLButtonElement).click();
    expect(captured).to.equal('rl1');
  });

  it('falls back to "Recipe" when the recipe log names no live recipe', () => {
    const state = stateWithGroup(1);
    const withoutRecipe: State = { ...state, recipes: [] };
    render(container, { ...baseVm, state: withoutRecipe }, noopHandlers);
    const header = container.querySelector('[data-testid="recipe-group-header"]')!;
    expect(header.querySelector('[data-testid="recipe-group-label"]')!.textContent).to.equal('Recipe');
  });
});
