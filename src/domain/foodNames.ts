import type { Food } from './types.js';

// Live food names are unique, case-insensitively: the picker shows names
// alone, so two live "Apple"s would be indistinguishable. A soft-deleted
// food frees its name.
export function nameTaken(name: string, foods: Food[], ignoreId: string | null = null): boolean {
  const key = name.toLowerCase();
  return foods.some((f) => f.deletedAt === null && f.id !== ignoreId && f.name.toLowerCase() === key);
}
