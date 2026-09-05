import { searchKey } from './searchKey.js';

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

// reference: the USDA tiers, searched by name alone. brand: a store pack,
// whose label joins the food's search text and shows as a tag wherever the
// food is rendered — see sourceBrand/searchText below.
export const SOURCE_KINDS = {
  REFERENCE: 'reference',
  BRAND: 'brand',
} as const;

export type SourceKind = typeof SOURCE_KINDS[keyof typeof SOURCE_KINDS];

// label: picker rows, result folds, hydration banners.
// tier: curated rows list flat and first; deep rows fold behind the label.
// version: dataset the app expects; bumping it re-hydrates that source on
// next boot, and the directory it names must exist under public/data/
// (tests/data checks they agree).
// defaultOn: enabled for a fresh user. Packs are opt-in.
export type FoodSourceMeta = {
  label: string;
  kind: SourceKind;
  tier: CatalogTier;
  version: string;
  defaultOn: boolean;
};

// Registry order is picker order and fold order. A source missing here fails
// the build; an unknown one at runtime reads as deep and shows its own name.
export const FOOD_SOURCE_META: Record<FoodSource, FoodSourceMeta> = {
  [FOOD_SOURCES.USDA]:        { label: 'Everyday foods',       kind: SOURCE_KINDS.REFERENCE, tier: CATALOG_TIERS.CURATED, version: '6', defaultOn: true },
  [FOOD_SOURCES.USDA_FULL]:   { label: 'All USDA foods',       kind: SOURCE_KINDS.REFERENCE, tier: CATALOG_TIERS.DEEP,    version: '2', defaultOn: true },
  [FOOD_SOURCES.COSTCO]:      { label: 'Costco',               kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.HEB]:         { label: 'H-E-B',                kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.KROGER]:      { label: 'Kroger',               kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.MEIJER]:      { label: 'Meijer',               kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.PUBLIX]:      { label: 'Publix',               kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.SAFEWAY]:     { label: 'Safeway & Albertsons', kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.SAMS_CLUB]:   { label: "Sam's Club",           kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.TARGET]:      { label: 'Target',               kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.TRADER_JOES]: { label: "Trader Joe's",         kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.WALMART]:     { label: 'Walmart',              kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.WEGMANS]:     { label: 'Wegmans',              kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
  [FOOD_SOURCES.WHOLE_FOODS]: { label: 'Whole Foods',          kind: SOURCE_KINDS.BRAND,     tier: CATALOG_TIERS.DEEP,    version: '1', defaultOn: false },
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

// The pack label when `source` is a registered brand source, else null — the
// single check every brand-tag render and brand-search decision goes through.
export function sourceBrand(source?: string): string | null {
  if (source === undefined || !isFoodSource(source)) {
    return null;
  }

  const meta = FOOD_SOURCE_META[source];
  return meta.kind === SOURCE_KINDS.BRAND ? meta.label : null;
}

// What a food's name should be matched against: the pack label joins in for
// a brand source so `costco almonds` can find a Costco row, but a reference
// source (or no source at all) searches by name alone.
export function searchText(name: string, source?: string): string {
  const brand = sourceBrand(source);
  return brand === null ? name : `${name} ${brand}`;
}

// The repositories' token matcher requires each query word as a literal
// substring, and searchKey turns intra-word punctuation into a space —
// "Sam's Club" would fold to "sam s club", losing the "sams" a user types.
// Removing it first instead of spacing it keeps the label one word where a
// person expects it: "Sam's Club" → "sams club", "H-E-B" → "heb".
export function brandSearchKey(source?: string): string | null {
  const brand = sourceBrand(source);
  return brand === null ? null : searchKey(brand.replace(/['’.-]/g, ''));
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
