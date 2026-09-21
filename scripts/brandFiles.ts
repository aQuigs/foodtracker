import { NUTRIENT_KEYS, type SourcedFood } from '../src/domain/types.js';
import { STORE_BUNDLES, brandSource, type StoreBundle } from '../src/domain/foodSources.js';
import type { BrandDataset } from './brandedMapper.js';

// A brand with fewer items is listed by name and count but ships no rows:
// single-item brands are the dump's long tail, over a third of all brands
// for a few percent of the rows.
export const MIN_BRAND_ITEMS = 2;

// One brand row on the wire, in this order. Nutrition goes last, in
// NUTRIENT_KEYS order, so a new nutrient appends a column. Every other
// SourcedFood field is the same for all of a brand's rows, so it is left
// out and rebuilt from the brand.
export type BrandRow = [fdcId: number, name: string, category: string, ...nutrition: number[]];

// file: the key of the file holding the brand's rows, or null for a brand
// listed without them.
export type BrandListEntry = [id: string, label: string, count: number, file: string | null];

export type StoreEntry = {
  id: string;
  label: string;
  brands: string[];
};

export type BrandList = {
  brands: BrandListEntry[];
  stores: StoreEntry[];
};

export type BrandFile = Record<string, BrandRow[]>;

export type BrandOutput = {
  list: BrandList;
  files: Map<string, BrandFile>;
};

const NON_LETTER_KEY = '0-9';

const BRAND_SERVING = { servingSize: 100, servingUnit: 'g' } as const;

export function brandFileKey(id: string): string {
  const first = id.charAt(0);
  return /^[a-z]$/.test(first) ? first : NON_LETTER_KEY;
}

function fixedFields(brand: BrandDataset, sourceId: string): Record<string, unknown> {
  const source = brandSource(brand.id);
  return { id: `${source}:${sourceId}`, brand: brand.label, ...BRAND_SERVING, source, sourceId };
}

// Throws rather than drop anything the row has no column for, so a change
// to what the collector emits cannot silently vanish from the files.
export function brandRow(brand: BrandDataset, food: SourcedFood): BrandRow {
  const { name, nutritionFacts, tags = [], ...rest } = food;
  const fixed: Record<string, unknown> = rest;
  const fdcId = Number(food.sourceId);
  const expected = fixedFields(brand, String(fdcId));

  const fits = Number.isInteger(fdcId)
    && tags.length <= 1
    && Object.keys(fixed).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => fixed[key] === value);

  if (!fits) {
    throw new Error(`${brand.id}: a row does not fit the brand row layout: ${JSON.stringify(food)}`);
  }

  return [fdcId, name, tags[0] ?? '', ...NUTRIENT_KEYS.map((key) => nutritionFacts[key])];
}

function byId(a: BrandDataset, b: BrandDataset): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// A store naming a brand the dump no longer has fails the build: USDA
// renaming a house brand must surface, not quietly shrink the store.
function assertStoreBrandsExist(brands: BrandDataset[], stores: ReadonlyMap<string, StoreBundle>): void {
  const produced = new Set(brands.map((b) => b.id));
  const missing = [...stores].flatMap(([store, bundle]) =>
    bundle.brands.filter((id) => !produced.has(id)).map((id) => `${store}: ${id}`));

  if (missing.length > 0) {
    throw new Error(`store brands missing from the USDA dump: ${missing.join(', ')}`);
  }
}

export function brandOutput(brands: BrandDataset[], stores: ReadonlyMap<string, StoreBundle> = STORE_BUNDLES): BrandOutput {
  assertStoreBrandsExist(brands, stores);

  const houseBrands = new Set([...stores.values()].flatMap((bundle) => bundle.brands));
  const files = new Map<string, BrandFile>();

  const entries = [...brands].sort(byId).map((brand): BrandListEntry => {
    const count = brand.foods.length;

    if (count < MIN_BRAND_ITEMS && !houseBrands.has(brand.id)) {
      return [brand.id, brand.label, count, null];
    }

    const key = brandFileKey(brand.id);
    const file = files.get(key) ?? {};
    file[brand.id] = brand.foods.map((food) => brandRow(brand, food));
    files.set(key, file);

    return [brand.id, brand.label, count, key];
  });

  const storeEntries = [...stores].map(([id, bundle]) => ({ id, label: bundle.label, brands: [...bundle.brands] }));

  return { list: { brands: entries, stores: storeEntries }, files };
}
