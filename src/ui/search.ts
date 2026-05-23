import type { Food } from '../domain/types.js';

export function filterFoods(foods: Food[], query: string): Food[] {
  const q = query.trim().toLowerCase();
  const live = foods.filter((f) => f.deletedAt === null);
  if (q === '') {
    return live;
  }

  return live.filter((f) => f.name.toLowerCase().includes(q));
}
