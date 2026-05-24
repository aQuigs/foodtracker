import type { Food, State } from './types.js';

const seedAt = '2026-01-01T00:00:00.000Z';

const seedFoods: Food[] = [
  { id: 'seed-oats',      name: 'Oats',                per100g: { calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5 }, createdAt: seedAt, deletedAt: null },
  { id: 'seed-banana',    name: 'Banana',              per100g: { calories: 89,  protein: 1.1,  carbs: 22.8, fat: 0.3 }, createdAt: seedAt, deletedAt: null },
  { id: 'seed-chicken',   name: 'Chicken breast',      per100g: { calories: 165, protein: 31,   carbs: 0,    fat: 3.6 }, createdAt: seedAt, deletedAt: null },
  { id: 'seed-rice',      name: 'White rice (cooked)', per100g: { calories: 130, protein: 2.7,  carbs: 28,   fat: 0.3 }, createdAt: seedAt, deletedAt: null },
  { id: 'seed-egg',       name: 'Egg',                 per100g: { calories: 155, protein: 13,   carbs: 1.1,  fat: 11  }, createdAt: seedAt, deletedAt: null },
  { id: 'seed-yogurt',    name: 'Greek yogurt',        per100g: { calories: 59,  protein: 10,   carbs: 3.6,  fat: 0.4 }, createdAt: seedAt, deletedAt: null },
  { id: 'seed-almonds',   name: 'Almonds',             per100g: { calories: 579, protein: 21,   carbs: 22,   fat: 50  }, createdAt: seedAt, deletedAt: null },
  { id: 'seed-broccoli',  name: 'Broccoli',            per100g: { calories: 34,  protein: 2.8,  carbs: 7,    fat: 0.4 }, createdAt: seedAt, deletedAt: null },
  { id: 'seed-salmon',    name: 'Salmon',              per100g: { calories: 208, protein: 20,   carbs: 0,    fat: 13  }, createdAt: seedAt, deletedAt: null },
  { id: 'seed-olive-oil', name: 'Olive oil',           per100g: { calories: 884, protein: 0,    carbs: 0,    fat: 100 }, createdAt: seedAt, deletedAt: null },
];

export function freshState(): State {
  return { version: 1, foods: seedFoods.map((f) => ({ ...f, per100g: { ...f.per100g } })), entries: [] };
}
