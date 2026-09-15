import { searchKey } from './searchKey.js';
import type { BrandsIndex } from './types.js';

// The static datasets: one directory each under public/data/. Every other
// source is a brand from the brands dataset below.
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

// label: picker rows, result folds, hydration banners.
// tier: curated rows list flat and first; deep rows fold behind the label.
// version: dataset the app expects; bumping it re-hydrates that source on
// next boot, and the directory it names must exist under public/data/
// (tests/data checks they agree).
// defaultOn: enabled for a fresh user.
export type FoodSourceMeta = {
  label: string;
  tier: CatalogTier;
  version: string;
  defaultOn: boolean;
};

// Registry order is picker order and fold order.
export const FOOD_SOURCE_META: Record<FoodSource, FoodSourceMeta> = {
  [FOOD_SOURCES.USDA]:      { label: 'Everyday foods', tier: CATALOG_TIERS.CURATED, version: '6', defaultOn: true },
  [FOOD_SOURCES.USDA_FULL]: { label: 'All USDA foods', tier: CATALOG_TIERS.DEEP,    version: '2', defaultOn: true },
};

export function isFoodSource(source: string): source is FoodSource {
  return Object.hasOwn(FOOD_SOURCE_META, source);
}

// A brand, or a source this build has never heard of, folds like the deep
// USDA tier.
export function sourceTier(source: string): CatalogTier {
  return isFoodSource(source) ? FOOD_SOURCE_META[source].tier : CATALOG_TIERS.DEEP;
}

// A static source is labelled by the registry; a brand by the index, or —
// until that has loaded, or for a brand it no longer lists — by its id read
// as words ("kirkland-signature" → "Kirkland Signature").
export function sourceLabel(source: string, index?: BrandsIndex): string {
  if (isFoodSource(source)) {
    return FOOD_SOURCE_META[source].label;
  }

  const id = brandIdOf(source);
  if (id === null) {
    return source;
  }

  const entry = index === undefined ? undefined : brandEntry(index, id);
  return entry === undefined ? idAsWords(id) : entry.label;
}

function idAsWords(id: string): string {
  return id.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// The token matcher requires each query word as a literal substring, and
// searchKey turns intra-word punctuation into a space — "Sam's Club" would
// fold to "sam s club", losing the "sams" a user types. Removing it first
// instead of spacing it keeps the label one word where a person expects it:
// "Sam's Club" → "sams club", "H-E-B" → "heb".
export function labelSearchKey(label: string): string {
  return searchKey(label.replace(/['’.-]/g, ''));
}

// What a food's name should be matched against: its brand joins in so
// `chobani greek yogurt` can find a Chobani row, while an untagged food
// searches by name alone.
export function searchText(name: string, brand?: string): string {
  return brand ? `${name} ${brand}` : name;
}

// What a food is matched on: the folded name, plus the folded brand for a
// tagged food. The one recipe the repositories index by and every search
// surface offers rows on, so a catalog search and a picker never disagree
// about whether a row is a hit. Persisted as the IndexedDB `name_key`, so
// changing it needs a SCHEMA_VERSION bump in indexedDbFoodSource.ts.
export function brandedSearchKey(name: string, brand?: string): string {
  const nameKey = searchKey(name);
  const brandKey = brand === undefined ? '' : labelSearchKey(brand);
  // Falsy, not just defined: a brand that folds to nothing (all punctuation)
  // must not leave a trailing space in the key.
  return brandKey ? `${nameKey} ${brandKey}` : nameKey;
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

// The brands dataset: every brand in USDA Branded Foods, one partition each,
// described by public/data/brands-v<version>/index.json and held in the
// shards beside it. One version covers the whole dataset; bumping it
// re-hydrates every brand the user has on.
export const BRANDS_DATASET = 'brands';
export const BRANDS_VERSION = '1';

export const BRAND_SOURCE_PREFIX = 'brand:';

export function brandSource(id: string): string {
  return `${BRAND_SOURCE_PREFIX}${id}`;
}

export function brandIdOf(source: string): string | null {
  if (!source.startsWith(BRAND_SOURCE_PREFIX)) {
    return null;
  }

  const id = source.slice(BRAND_SOURCE_PREFIX.length);
  return id === '' ? null : id;
}

// One index row, decoded from the `[id, label, count, shard]` tuple the
// file carries.
export type BrandEntry = { id: string; label: string; count: number; shard: number };

// Decoded once per index object: the index lists tens of thousands of
// brands and is read by id from the picker, the result folds and the
// provider, all on every render or toggle.
const entriesByIndex = new WeakMap<BrandsIndex, Map<string, BrandEntry>>();

function entriesOf(index: BrandsIndex): Map<string, BrandEntry> {
  let byId = entriesByIndex.get(index);
  if (byId === undefined) {
    byId = new Map(index.brands.map(([id, label, count, shard]) => [id, { id, label, count, shard }]));
    entriesByIndex.set(index, byId);
  }

  return byId;
}

export function brandEntry(index: BrandsIndex, id: string): BrandEntry | undefined {
  return entriesOf(index).get(id);
}

export function brandEntries(index: BrandsIndex): BrandEntry[] {
  return [...entriesOf(index).values()];
}

// A store is a shortcut over the brands it owns: one picker checkbox that
// turns them on together. Nothing about a store is persisted — the blob
// lists brands — except that a blob from before brands were sources may
// still name a store, and a food added then carries the store's name as its
// `source`; both are read through this table. Keys are the source names
// those store packs had; labels are the tags their foods still show. A Map,
// not an object: a stored name is untrusted, and a bare object index would
// hand back an Object.prototype member for "constructor" or "__proto__".
export type StoreBundle = {
  label: string;
  brands: string[];
};

export const STORE_BUNDLES: ReadonlyMap<string, StoreBundle> = new Map(Object.entries({
  'costco':      { label: 'Costco',              brands: ['kirkland-signature', 'kirkland', 'costco'] },
  'heb':         { label: 'H-E-B',               brands: ['heb', 'hill-country-fare', 'central-market'] },
  'kroger':      { label: 'Kroger',              brands: ['kroger', 'simple-truth', 'simple-truth-organic', 'private-selection', 'psst', 'fred-meyer', 'king-soopers', 'heritage-farm', 'bakery-fresh-goodness', 'big-k', 'smart-way', 'fresh-foods-market', 'mountain-dairy'] },
  'meijer':      { label: 'Meijer',              brands: ['meijer', 'markets-of-meijer', 'purple-cow', 'penny-smart'] },
  'publix':      { label: 'Publix',              brands: ['publix', 'greenwise', 'publix-deli', 'publix-bakery', 'publix-premium'] },
  'safeway':     { label: 'Safeway & Albertsons', brands: ['signature-select', 'o-organics', 'lucerne', 'lucerne-dairy-farms', 'signature-farms', 'signature-cafe', 'signature-kitchens', 'signature-reserve', 'open-nature', 'safeway', 'albertsons', 'waterfront-bistro', 'primo-taglio', 'value-corner', 'refreshe', 'soleil', 'safeway-kitchens', 'safeway-select'] },
  'sams-club':   { label: "Sam's Club",          brands: ['members-mark'] },
  'target':      { label: 'Target',              brands: ['good-gather', 'market-pantry', 'archer-farms', 'favorite-day', 'simply-balanced', 'wondershop', 'wondershop-at-target', 'target', 'hyde-and-eek-boutique', 'tabitha-brown'] },
  'trader-joes': { label: "Trader Joe's",        brands: ['trader-joes'] },
  'walmart':     { label: 'Walmart',             brands: ['great-value', 'sams-choice', 'walmart', 'marketside', 'walmart-deli'] },
  'wegmans':     { label: 'Wegmans',             brands: ['wegmans', 'wegmans-organic', 'wegmans-food-mkts'] },
  'whole-foods': { label: 'Whole Foods',         brands: ['365-whole-foods-market', '365-everyday-value', '365', 'whole-foods-market', 'engine-2', 'whole-catch'] },
}));

export function bundleSources(storeId: string): string[] {
  return STORE_BUNDLES.get(storeId)?.brands.map(brandSource) ?? [];
}

// A stored enabled list may still name a store pack from before brands
// were sources; it means "that store's brands". Everything else — a static
// source, a brand, a name this build no longer knows — passes through.
export function expandLegacySources(enabled: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const name of enabled) {
    const expanded = STORE_BUNDLES.has(name) ? bundleSources(name) : [name];
    for (const source of expanded) {
      if (!seen.has(source)) {
        seen.add(source);
        out.push(source);
      }
    }
  }

  return out;
}
