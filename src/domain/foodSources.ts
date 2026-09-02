export const FOOD_SOURCES = {
  USDA: 'usda',
  USDA_FULL: 'usda-full',
} as const;

export type FoodSource = typeof FOOD_SOURCES[keyof typeof FOOD_SOURCES];

export const CATALOG_TIERS = {
  CURATED: 'curated',
  DEEP: 'deep',
} as const;

export type CatalogTier = typeof CATALOG_TIERS[keyof typeof CATALOG_TIERS];

// Which tier a source's hits render in: curated rows list first, deep rows
// fold behind "More results". A new source must be classified here or the
// build fails; an unknown one reads as deep rather than vanishing.
export const SOURCE_TIER: Record<FoodSource, CatalogTier> = {
  [FOOD_SOURCES.USDA]: CATALOG_TIERS.CURATED,
  [FOOD_SOURCES.USDA_FULL]: CATALOG_TIERS.DEEP,
};

export function sourceTier(source: string): CatalogTier {
  return Object.hasOwn(SOURCE_TIER, source) ? SOURCE_TIER[source as FoodSource] : CATALOG_TIERS.DEEP;
}

// Dataset version the app expects per source. Bumping one re-hydrates that
// source on next boot; the directory it names must be committed under
// public/data/ (tests/data checks the two agree).
export const CATALOG_VERSIONS: Record<FoodSource, string> = {
  [FOOD_SOURCES.USDA]: '6',
  [FOOD_SOURCES.USDA_FULL]: '2',
};

// The one definition of the `<source>-v<version>` layout under public/data/,
// shared by the build script that writes it and the provider that fetches it.
export function datasetDir(source: string, version: string): string {
  return `${source}-v${version}`;
}
