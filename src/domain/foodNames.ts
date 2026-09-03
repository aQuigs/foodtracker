import type { Food } from './types.js';

// Live food names are unique, case-insensitively: the picker shows names
// alone, so two live "Apple"s would be indistinguishable. Case-only by
// design — "Café" and "Cafe" read as different foods in the list. A
// soft-deleted food frees its name.
export function foodNameKey(name: string): string {
  return name.toLowerCase();
}

export function nameTaken(name: string, foods: Food[], ignoreId: string | null = null): boolean {
  const key = foodNameKey(name);
  return foods.some((f) => f.deletedAt === null && f.id !== ignoreId && foodNameKey(f.name) === key);
}
