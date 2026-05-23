import type { Food, State } from './types.js';

const seedAt = '2026-01-01T00:00:00.000Z';

const seedFoods: Food[] = [
  { id: 'seed-oats',     name: 'Oats',            kcalPer100g: 379, proteinPer100g: 13.2, carbsPer100g: 67.7, fatPer100g: 6.5,  primaryUnit: 'g', weightPerUnit: 100, createdAt: seedAt, deletedAt: null },
  { id: 'seed-banana',   name: 'Banana',          kcalPer100g: 89,  proteinPer100g: 1.1,  carbsPer100g: 22.8, fatPer100g: 0.3,  primaryUnit: 'g', weightPerUnit: 100, createdAt: seedAt, deletedAt: null },
  { id: 'seed-chicken',  name: 'Chicken breast',  kcalPer100g: 165, proteinPer100g: 31,   carbsPer100g: 0,    fatPer100g: 3.6,  primaryUnit: 'g', weightPerUnit: 100, createdAt: seedAt, deletedAt: null },
  { id: 'seed-rice',     name: 'White rice (cooked)', kcalPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, primaryUnit: 'g', weightPerUnit: 100, createdAt: seedAt, deletedAt: null },
  { id: 'seed-egg',      name: 'Egg',             kcalPer100g: 155, proteinPer100g: 13,   carbsPer100g: 1.1,  fatPer100g: 11,   primaryUnit: 'count', weightPerUnit: 50, createdAt: seedAt, deletedAt: null },
  { id: 'seed-yogurt',   name: 'Greek yogurt',    kcalPer100g: 59,  proteinPer100g: 10,   carbsPer100g: 3.6,  fatPer100g: 0.4,  primaryUnit: 'g', weightPerUnit: 100, createdAt: seedAt, deletedAt: null },
  { id: 'seed-almonds',  name: 'Almonds',         kcalPer100g: 579, proteinPer100g: 21,   carbsPer100g: 22,   fatPer100g: 50,   primaryUnit: 'g', weightPerUnit: 100, createdAt: seedAt, deletedAt: null },
  { id: 'seed-broccoli', name: 'Broccoli',        kcalPer100g: 34,  proteinPer100g: 2.8,  carbsPer100g: 7,    fatPer100g: 0.4,  primaryUnit: 'g', weightPerUnit: 100, createdAt: seedAt, deletedAt: null },
  { id: 'seed-salmon',   name: 'Salmon',          kcalPer100g: 208, proteinPer100g: 20,   carbsPer100g: 0,    fatPer100g: 13,   primaryUnit: 'g', weightPerUnit: 100, createdAt: seedAt, deletedAt: null },
  { id: 'seed-olive-oil', name: 'Olive oil',      kcalPer100g: 884, proteinPer100g: 0,    carbsPer100g: 0,    fatPer100g: 100,  primaryUnit: 'g', weightPerUnit: 100, createdAt: seedAt, deletedAt: null },
];

export function freshState(): State {
  return { version: 2, foods: seedFoods.map((f) => ({ ...f })), entries: [] };
}
