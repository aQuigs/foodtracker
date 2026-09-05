import type { Food } from './types.js';
import { searchText } from './foodSources.js';

// A food's identity is its name plus its brand, compared case-insensitively:
// the picker shows names alone, so two live untagged "Apple"s would be
// indistinguishable. Case-only by design — "Café" and "Cafe" read as
// different foods in the list. Two packs can each ship an "Almonds" and
// both coexist (tagged); a user-made food has no brand, so it still
// collides with a same-named USDA row (both untagged). A soft-deleted food
// frees its identity.
export function foodIdentityKey(food: { name: string; source?: string }): string {
  return searchText(food.name, food.source).toLowerCase();
}

export function nameTaken(
  food: { name: string; source?: string }, foods: Food[], ignoreId: string | null = null,
): boolean {
  const key = foodIdentityKey(food);
  return foods.some((f) => f.deletedAt === null && f.id !== ignoreId && foodIdentityKey(f) === key);
}
