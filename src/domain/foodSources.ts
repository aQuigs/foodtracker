import { searchKey } from './searchKey.js';
import type { BrandList } from './dataFiles.js';

// The static sources, one file each under public/data/. Every other source
// is a brand.
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
// defaultOn: enabled for a fresh user.
export type FoodSourceMeta = {
  label: string;
  tier: CatalogTier;
  defaultOn: boolean;
};

// Registry order is picker order and fold order.
export const FOOD_SOURCE_META: Record<FoodSource, FoodSourceMeta> = {
  [FOOD_SOURCES.USDA]:      { label: 'Everyday foods', tier: CATALOG_TIERS.CURATED, defaultOn: true },
  [FOOD_SOURCES.USDA_FULL]: { label: 'All USDA foods', tier: CATALOG_TIERS.DEEP,    defaultOn: true },
};

export function isFoodSource(source: string): source is FoodSource {
  return Object.hasOwn(FOOD_SOURCE_META, source);
}

// A brand, or a source this build has never heard of, folds like the deep
// USDA tier.
export function sourceTier(source: string): CatalogTier {
  return isFoodSource(source) ? FOOD_SOURCE_META[source].tier : CATALOG_TIERS.DEEP;
}

// A static source is labelled by the registry; a brand by the brand list,
// or — until that has loaded, or for a brand it no longer lists — by its id
// read as words ("kirkland-signature" → "Kirkland Signature").
export function sourceLabel(source: string, list?: BrandList): string {
  if (isFoodSource(source)) {
    return FOOD_SOURCE_META[source].label;
  }

  const id = brandIdOf(source);
  if (id === null) {
    return source;
  }

  const entry = list === undefined ? undefined : brandEntry(list, id);
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

export function defaultEnabledSources(): FoodSource[] {
  return (Object.keys(FOOD_SOURCE_META) as FoodSource[]).filter((s) => FOOD_SOURCE_META[s].defaultOn);
}

// Every brand in USDA Branded Foods is a source of its own, one partition
// each.
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

// One brand-list row, decoded from the `[id, label, count, file]` tuple the
// file carries.
export type BrandEntry = { id: string; label: string; count: number; file: string | null };

// Decoded once per list object: the list names tens of thousands of brands
// and is read by id from the picker and the result folds on every render.
const entriesByList = new WeakMap<BrandList, Map<string, BrandEntry>>();

function entriesOf(list: BrandList): Map<string, BrandEntry> {
  let byId = entriesByList.get(list);
  if (byId === undefined) {
    byId = new Map(list.brands.map(([id, label, count, file]) => [id, { id, label, count, file }]));
    entriesByList.set(list, byId);
  }

  return byId;
}

export function brandEntry(list: BrandList, id: string): BrandEntry | undefined {
  return entriesOf(list).get(id);
}

export function brandEntries(list: BrandList): BrandEntry[] {
  return [...entriesOf(list).values()];
}

// A store is one picker checkbox that turns on the brands it owns, its
// house brands. The enabled list names it by its own id — the source name
// the store packs had, which a food added from one still carries as its
// `source`, shown under the store's label — and only search and hydration,
// which need concrete sources, expand it. A house brand is reached through
// its store alone, never on by itself. A Map, not an object: a stored name
// is untrusted, and a bare object index would hand back an Object.prototype
// member for "constructor" or "__proto__".
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

const STORE_OF_HOUSE_BRAND: ReadonlyMap<string, string> = new Map(
  [...STORE_BUNDLES].flatMap(([store, bundle]) => bundle.brands.map((id) => [id, store] as const)),
);

export function isStore(name: string): boolean {
  return STORE_BUNDLES.has(name);
}

export function isHouseBrand(id: string): boolean {
  return STORE_OF_HOUSE_BRAND.has(id);
}

// The concrete sources an enabled list reaches: a store stands for its
// house brands' sources; everything else — a static source, a brand, a name
// this build no longer knows — stands for itself. Each source once.
export function expandStores(enabled: string[]): string[] {
  const expanded = enabled.flatMap((name) => STORE_BUNDLES.get(name)?.brands.map(brandSource) ?? [name]);
  return [...new Set(expanded)];
}

// A house brand on by itself becomes its store, so a list that reached one
// brand-by-brand keeps reaching it through the only checkbox that shows it.
export function houseBrandsAsStores(enabled: string[]): string[] {
  const named = enabled.map((name) => {
    const id = brandIdOf(name);
    return (id === null ? undefined : STORE_OF_HOUSE_BRAND.get(id)) ?? name;
  });

  return [...new Set(named)];
}
