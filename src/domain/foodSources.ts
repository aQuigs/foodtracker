export const FOOD_SOURCES = {
  USDA: 'usda',
  USDA_FULL: 'usda-full',
} as const;

export type FoodSource = typeof FOOD_SOURCES[keyof typeof FOOD_SOURCES];

// Dataset version the app expects per source. Bumping one re-hydrates that
// source on next boot; the directory it names must be committed under
// public/data/ (tests/data checks the two agree).
export const CATALOG_VERSIONS: Record<FoodSource, string> = {
  [FOOD_SOURCES.USDA]: '5',
  [FOOD_SOURCES.USDA_FULL]: '1',
};

// The one definition of the `<source>-v<version>` layout under public/data/,
// shared by the build script that writes it and the provider that fetches it.
export function datasetDir(source: string, version: string): string {
  return `${source}-v${version}`;
}
