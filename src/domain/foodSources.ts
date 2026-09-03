export const FOOD_SOURCES = {
  USDA: 'usda',
  USDA_FULL: 'usda-full',
  COSTCO: 'costco',
  HEB: 'heb',
  KROGER: 'kroger',
  MEIJER: 'meijer',
  PUBLIX: 'publix',
  SAFEWAY: 'safeway',
  SAMS_CLUB: 'sams-club',
  TARGET: 'target',
  TRADER_JOES: 'trader-joes',
  WALMART: 'walmart',
  WEGMANS: 'wegmans',
  WHOLE_FOODS: 'whole-foods',
} as const;

export type FoodSource = typeof FOOD_SOURCES[keyof typeof FOOD_SOURCES];

export const CATALOG_TIERS = {
  CURATED: 'curated',
  DEEP: 'deep',
} as const;

export type CatalogTier = typeof CATALOG_TIERS[keyof typeof CATALOG_TIERS];

// label: picker rows, result folds, hydration banners.
// tier: curated rows list flat and first; deep rows fold behind the label.
// version: dataset the app expects; bumping it re-hydrates that source on
// next boot, and the directory it names must exist under public/data/
// (tests/data checks they agree).
// defaultOn: enabled for a fresh user. Packs are opt-in.
export type FoodSourceMeta = {
  label: string;
  tier: CatalogTier;
  version: string;
  defaultOn: boolean;
};

// Registry order is picker order and fold order. A source missing here fails
// the build; an unknown one at runtime reads as deep and shows its own name.
export const FOOD_SOURCE_META: Record<FoodSource, FoodSourceMeta> = {
  [FOOD_SOURCES.USDA]:        { label: 'Everyday foods',       tier: CATALOG_TIERS.CURATED, version: '6', defaultOn: true },
  [FOOD_SOURCES.USDA_FULL]:   { label: 'All USDA foods',       tier: CATALOG_TIERS.DEEP,    version: '2', defaultOn: true },
  [FOOD_SOURCES.COSTCO]:      { label: 'Costco',               tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.HEB]:         { label: 'H-E-B',                tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.KROGER]:      { label: 'Kroger',               tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.MEIJER]:      { label: 'Meijer',               tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.PUBLIX]:      { label: 'Publix',               tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.SAFEWAY]:     { label: 'Safeway & Albertsons', tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.SAMS_CLUB]:   { label: "Sam's Club",           tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.TARGET]:      { label: 'Target',               tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.TRADER_JOES]: { label: "Trader Joe's",         tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.WALMART]:     { label: 'Walmart',              tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.WEGMANS]:     { label: 'Wegmans',              tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.WHOLE_FOODS]: { label: 'Whole Foods',          tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
};

export function isFoodSource(source: string): source is FoodSource {
  return Object.hasOwn(FOOD_SOURCE_META, source);
}

export function sourceTier(source: string): CatalogTier {
  return isFoodSource(source) ? FOOD_SOURCE_META[source].tier : CATALOG_TIERS.DEEP;
}

export function sourceLabel(source: string): string {
  return isFoodSource(source) ? FOOD_SOURCE_META[source].label : source;
}

export function catalogVersions(): Record<FoodSource, string> {
  return Object.fromEntries(
    Object.entries(FOOD_SOURCE_META).map(([source, meta]) => [source, meta.version]),
  ) as Record<FoodSource, string>;
}

export function defaultEnabledSources(): FoodSource[] {
  return (Object.keys(FOOD_SOURCE_META) as FoodSource[]).filter((s) => FOOD_SOURCE_META[s].defaultOn);
}

// The one definition of the `<source>-v<version>` layout under public/data/,
// shared by the build script that writes it and the provider that fetches it.
export function datasetDir(source: string, version: string): string {
  return `${source}-v${version}`;
}
