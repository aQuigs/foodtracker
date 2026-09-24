import type { Food, Recipe, Shown, State, Unit } from './types.js';
import { compatibleUnits, type UnitFood } from './units.js';
import { liveRecipes } from './recipes.js';

export type UnitLock =
  | { kind: 'entries'; unit: Unit; shown?: Shown }
  | { kind: 'recipe'; unit: Unit; shown?: Shown; recipe: Recipe };

// Whether `current` has an entry or live recipe portion in a unit this edit
// would newly strand — one already incompatible before the edit doesn't count.
export function unitLock(state: State, current: Food, next: UnitFood): UnitLock | null {
  const was = compatibleUnits(current);
  const now = compatibleUnits(next);
  const strands = (unit: Unit): boolean => was.includes(unit) && !now.includes(unit);

  const entry = state.entries.find((e) => e.foodId === current.id && strands(e.unit));
  if (entry !== undefined) {
    return { kind: 'entries', unit: entry.unit, ...(entry.shown === undefined ? {} : { shown: entry.shown }) };
  }

  for (const recipe of liveRecipes(state.recipes)) {
    const item = recipe.items.find((i) => i.foodId === current.id && strands(i.unit));
    if (item !== undefined) {
      return { kind: 'recipe', unit: item.unit, recipe, ...(item.shown === undefined ? {} : { shown: item.shown }) };
    }
  }

  return null;
}
