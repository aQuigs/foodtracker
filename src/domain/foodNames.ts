import { searchText } from './foodSources.js';

// Identity is name plus brand, compared case-insensitively: the picker/list
// shows names alone, so two live untagged items would be indistinguishable.
// A recipe carries no brand, so its identity is name alone — same as an
// untagged food. nameTaken is always checked against one collection (foods
// or recipes), so a food and a recipe may still share a name; the picker's
// `Recipe` tag tells them apart. Case-only by design — "Café" and "Cafe"
// read as different foods in the list. A soft-deleted item frees its
// identity.
export function foodIdentityKey(food: { name: string; source?: string }): string {
  return searchText(food.name, food.source).toLowerCase();
}

export function nameTaken(
  item: { name: string; source?: string },
  items: Array<{ id: string; name: string; deletedAt: string | null; source?: string }>,
  ignoreId: string | null = null,
): boolean {
  const key = foodIdentityKey(item);
  return items.some((x) => x.deletedAt === null && x.id !== ignoreId && foodIdentityKey(x) === key);
}
