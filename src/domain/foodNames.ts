import { searchText } from './foodSources.js';

// Identity is name plus brand, compared case-insensitively: the picker/list
// shows names alone, so two live untagged items would be indistinguishable.
// The brand is the food's own field — a USDA row, a recipe and a user-made
// food carry none, so their identity is name alone. nameTaken is always
// checked against one collection (foods or recipes), so a food and a recipe
// may still share a name; the picker's `Recipe` tag tells them apart.
// Case-only by design — "Café" and "Cafe" read as different foods in the
// list. A soft-deleted item frees its identity.
export function foodIdentityKey(food: { name: string; brand?: string }): string {
  return searchText(food.name, food.brand).toLowerCase();
}

export function nameTaken(
  item: { name: string; brand?: string },
  items: Array<{ id: string; name: string; deletedAt: string | null; brand?: string }>,
  ignoreId: string | null = null,
): boolean {
  const key = foodIdentityKey(item);
  return items.some((x) => x.deletedAt === null && x.id !== ignoreId && foodIdentityKey(x) === key);
}
