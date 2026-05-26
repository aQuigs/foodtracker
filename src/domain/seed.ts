import type { Food, State } from './types.js';

const seedAt = '2026-01-01T00:00:00.000Z';

const seedFoods: Food[] = [
  { id: 'seed-oats',      name: 'Oats',                nutritionFacts: { calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5 }, servingSize: 100, servingUnit: 'g',     createdAt: seedAt, deletedAt: null },
  { id: 'seed-banana',    name: 'Banana',              nutritionFacts: { calories: 89,  protein: 1.1,  carbs: 22.8, fat: 0.3 }, servingSize: 100, servingUnit: 'g',     createdAt: seedAt, deletedAt: null },
  { id: 'seed-chicken',   name: 'Chicken breast',      nutritionFacts: { calories: 165, protein: 31,   carbs: 0,    fat: 3.6 }, servingSize: 100, servingUnit: 'g',     createdAt: seedAt, deletedAt: null },
  { id: 'seed-rice',      name: 'White rice (cooked)', nutritionFacts: { calories: 130, protein: 2.7,  carbs: 28,   fat: 0.3 }, servingSize: 100, servingUnit: 'g',     createdAt: seedAt, deletedAt: null },
  { id: 'seed-egg',       name: 'Egg',                 nutritionFacts: { calories: 78,  protein: 6.5,  carbs: 0.6,  fat: 5.5 }, servingSize: 1,   servingUnit: 'count', createdAt: seedAt, deletedAt: null },
  { id: 'seed-yogurt',    name: 'Greek yogurt',        nutritionFacts: { calories: 59,  protein: 10,   carbs: 3.6,  fat: 0.4 }, servingSize: 100, servingUnit: 'g',     createdAt: seedAt, deletedAt: null },
  { id: 'seed-almonds',   name: 'Almonds',             nutritionFacts: { calories: 579, protein: 21,   carbs: 22,   fat: 50  }, servingSize: 100, servingUnit: 'g',     createdAt: seedAt, deletedAt: null },
  { id: 'seed-broccoli',  name: 'Broccoli',            nutritionFacts: { calories: 34,  protein: 2.8,  carbs: 7,    fat: 0.4 }, servingSize: 100, servingUnit: 'g',     createdAt: seedAt, deletedAt: null },
  { id: 'seed-salmon',    name: 'Salmon',              nutritionFacts: { calories: 208, protein: 20,   carbs: 0,    fat: 13  }, servingSize: 100, servingUnit: 'g',     createdAt: seedAt, deletedAt: null },
  { id: 'seed-olive-oil', name: 'Olive oil',           nutritionFacts: { calories: 884, protein: 0,    carbs: 0,    fat: 100 }, servingSize: 100, servingUnit: 'g',     createdAt: seedAt, deletedAt: null },
];

export function freshState(): State {
  return { version: 1, foods: structuredClone(seedFoods), entries: [] };
}
