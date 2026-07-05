export const FOOD_SOURCES = {
  USDA: 'usda',
  USDA_FULL: 'usda-full',
} as const;

export type FoodSourceName = typeof FOOD_SOURCES[keyof typeof FOOD_SOURCES];
