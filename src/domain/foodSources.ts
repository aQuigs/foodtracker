export const FOOD_SOURCES = {
  USDA: 'usda',
} as const;

export type FoodSourceName = typeof FOOD_SOURCES[keyof typeof FOOD_SOURCES];
