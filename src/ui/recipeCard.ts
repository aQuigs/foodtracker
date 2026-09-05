import type { Food, Portion, Recipe } from '../domain/types.js';
import { scaleNutrition, sumNutrition } from '../domain/calc.js';
import { parseRecipeDraft } from './recipeIntents.js';
import type { RecipeDraft } from './recipeIntents.js';
import { formatTotals } from './nutritionFormat.js';
import { foodLabel, foodTitle } from './foodTitle.js';
import { keyedRows } from './keyedRows.js';
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

// Rows are created once and reused across renders, keyed by foodId, so an
// amount input keeps focus and caret position across the re-render every
// keystroke causes.
export function createRecipeCard(handlers: RecipeCardHandlers): RecipeCard {
  const total = el('div', { 'data-testid': 'recipe-draft-total', class: 'recipe-detail-total' });
  const node = el('li', { 'data-testid': 'recipe-detail', class: 'recipe-detail', role: 'region' }, [total]);

  const rows = keyedRows<ItemRow>((foodId) => {
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

    return { row: rowEl, nameSpan, amountInput, unitSpan, calSpan };
  });

  function render(vm: RecipeCardVm): void {
    const { recipe, draft, foodsById, detailId } = vm;

    node.id = detailId;
    node.setAttribute('data-recipe-id', recipe.id);
    node.setAttribute('aria-label', `Portions for ${recipe.name}`);

    const desired = recipe.items.map((item) => {
      const row = rows.get(item.foodId);
      const food = foodsById.get(item.foodId);
      const deleted = food === undefined || food.deletedAt !== null;
      const suffix = deleted ? ' (deleted)' : '';
      const title = food ? foodTitle(food, [], []) : ['Unknown food'];
      const ariaName = (food ? foodLabel(food) : 'Unknown food') + suffix;
      const amountStr = draft.amounts[item.foodId] ?? '';

      row.nameSpan.replaceChildren(...title, suffix);
      setInputValue(row.amountInput, amountStr);
      row.amountInput.setAttribute('aria-label', `Amount of ${ariaName}`);
      row.unitSpan.textContent = item.unit;
      row.calSpan.textContent = deleted ? '—' : itemCalText(item, amountStr, foodsById);

      return row.row;
    });

    reconcileChildren(node, [...desired, total]);
    rows.prune(recipe.items.map((i) => i.foodId));

    const parsed = parseRecipeDraft(draft, recipe);
    if (parsed.kind === 'error') {
      total.textContent = 'Total —';
      return;
    }

    const live = parsed.portions.filter((p): p is Portion => p !== null && isLiveFood(p.foodId, foodsById));
    total.textContent = `Total ${formatTotals(scaleNutrition(sumNutrition(live, foodsById), parsed.servings))}`;
  }

  return { node, render };
}
