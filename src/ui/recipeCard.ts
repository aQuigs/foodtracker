import type { Food, Portion, Recipe } from '../domain/types.js';
import { scaleNutrition, sumNutrition } from '../domain/calc.js';
import { parseRecipeDraft } from './recipeIntents.js';
import type { RecipeDraft } from './recipeIntents.js';
import { formatMealHeaderTotal } from './nutritionFormat.js';
import { foodLabel, foodTitle } from './foodTitle.js';
import { el, reconcileChildren, setInputValue } from './dom.js';

export type RecipeCardVm = {
  recipe: Recipe;
  draft: RecipeDraft;
  foodsById: Map<string, Food>;
  detailId: string;
};

export type RecipeCardHandlers = {
  onRecipeDraftAmountChange: (foodId: string, amount: string) => void;
};

export type RecipeCard = {
  node: HTMLLIElement;
  render(vm: RecipeCardVm): void;
};

type ItemRow = {
  row: HTMLDivElement;
  nameSpan: HTMLSpanElement;
  amountInput: HTMLInputElement;
  unitSpan: HTMLSpanElement;
  calSpan: HTMLSpanElement;
};

function itemCalText(item: Portion, amountStr: string, foodsById: Map<string, Food>): string {
  const amount = Number(amountStr.trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    return '—';
  }

  const cal = sumNutrition([{ foodId: item.foodId, amount, unit: item.unit }], foodsById).calories;
  return `${Math.round(cal)} cal`;
}

function isLiveFood(foodId: string, foodsById: Map<string, Food>): boolean {
  const food = foodsById.get(foodId);
  return food !== undefined && food.deletedAt === null;
}

// The card, its item rows and the total line are created once and reused
// across renders (keyed by foodId, same pattern as recipeEditor.ts) — the
// log picker rebuilds every row around this card on each paint, so an amount
// input that was itself replaced each time would lose focus and caret
// position on every keystroke.
export function createRecipeCard(handlers: RecipeCardHandlers): RecipeCard {
  const total = el('div', { 'data-testid': 'recipe-draft-total', class: 'recipe-detail-total' });
  const node = el('li', { 'data-testid': 'recipe-detail', class: 'recipe-detail', role: 'region' }, [total]);

  const rows = new Map<string, ItemRow>();

  function rowFor(foodId: string): ItemRow {
    let row = rows.get(foodId);
    if (row) {
      return row;
    }

    const nameSpan = el('span', {});
    const amountInput = el('input', {
      'data-testid': 'recipe-draft-amount', 'data-food-id': foodId, class: 'recipe-detail-amount',
      type: 'number', inputmode: 'decimal', step: 'any', min: '0',
    });
    amountInput.addEventListener('input', () => handlers.onRecipeDraftAmountChange(foodId, amountInput.value));
    const unitSpan = el('span', {});
    const calSpan = el('span', { 'data-testid': 'recipe-draft-item-cal' });

    const rowEl = el('div', { 'data-testid': 'recipe-draft-item', 'data-food-id': foodId, class: 'recipe-detail-row' }, [
      nameSpan, amountInput, unitSpan, calSpan,
    ]);

    row = { row: rowEl, nameSpan, amountInput, unitSpan, calSpan };
    rows.set(foodId, row);
    return row;
  }

  function render(vm: RecipeCardVm): void {
    const { recipe, draft, foodsById, detailId } = vm;

    node.id = detailId;
    node.setAttribute('data-recipe-id', recipe.id);
    node.setAttribute('aria-label', `Portions for ${recipe.name}`);

    const desired = recipe.items.map((item) => {
      const row = rowFor(item.foodId);
      const food = foodsById.get(item.foodId);
      const deleted = food === undefined || food.deletedAt !== null;
      const displayTitle = food ? foodTitle(food, [], []) : ['Unknown food'];
      const identityName = food ? foodLabel(food) : 'Unknown food';
      const titleChildren = deleted ? [...displayTitle, ' (deleted)'] : displayTitle;
      const ariaName = deleted ? `${identityName} (deleted)` : identityName;
      const amountStr = draft.amounts[item.foodId] ?? '';

      row.nameSpan.replaceChildren(...titleChildren);
      setInputValue(row.amountInput, amountStr);
      row.amountInput.setAttribute('aria-label', `Amount of ${ariaName}`);
      row.unitSpan.textContent = item.unit;
      row.calSpan.textContent = deleted ? '—' : itemCalText(item, amountStr, foodsById);

      return row.row;
    });

    reconcileChildren(node, [...desired, total]);

    const currentIds = new Set(recipe.items.map((i) => i.foodId));
    for (const id of rows.keys()) {
      if (!currentIds.has(id)) {
        rows.delete(id);
      }
    }

    const parsed = parseRecipeDraft(draft, recipe);
    if (parsed.kind === 'error') {
      total.textContent = 'Total —';
      return;
    }

    const live = parsed.portions.filter((p): p is Portion => p !== null && isLiveFood(p.foodId, foodsById));
    total.textContent = `Total ${formatMealHeaderTotal(scaleNutrition(sumNutrition(live, foodsById), parsed.servings))}`;
  }

  return { node, render };
}
