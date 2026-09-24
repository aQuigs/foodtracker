import type { Food, Portion, State } from './types.js';
import { indexFoodsById } from './calc.js';
import { resolvePickerAmount } from './units.js';

// A stored row must never read 'count' against a food's current pieces —
// only new input does that (see resolvePickerAmount). Anything that reaches
// this shape converts once, here, to its own frozen physical amount.
function needsMigration(row: Portion, foodById: Map<string, Food>): boolean {
  const food = foodById.get(row.foodId);
  return row.unit === 'count' && food !== undefined && food.pieces !== undefined && food.servingUnit !== 'count';
}

function migrated<T extends Portion>(row: T, foodById: Map<string, Food>): T {
  const food = foodById.get(row.foodId);
  if (row.unit !== 'count' || food === undefined) {
    return row;
  }

  return { ...row, ...resolvePickerAmount(row.amount, 'count', food) };
}

export function migrateCountEntries(state: State): State {
  const foodById = indexFoodsById(state);
  const any = state.entries.some((e) => needsMigration(e, foodById))
    || state.recipes.some((r) => r.items.some((i) => needsMigration(i, foodById)));

  if (!any) {
    return state;
  }

  return {
    ...state,
    entries: state.entries.map((e) => migrated(e, foodById)),
    recipes: state.recipes.map((r) => ({ ...r, items: r.items.map((i) => migrated(i, foodById)) })),
  };
}
