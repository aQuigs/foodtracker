import { NUTRIENT_KEYS, type SourcedFood } from '../src/domain/types.js';
import { STORE_BUNDLES, type StoreBundle } from '../src/domain/foodSources.js';
import { brandFileKey, brandFood, type BrandFile, type BrandList, type BrandListEntry, type BrandRow } from '../src/domain/dataFiles.js';
import { isBrandFileEntry, isBrandList } from '../src/domain/validate.js';
import type { BrandDataset } from './brandedMapper.js';

// A brand with fewer items is listed by name and count but ships no rows:
// single-item brands are the dump's long tail, over a third of all brands
// for a few percent of the rows.
export const MIN_BRAND_ITEMS = 2;

export type BrandOutput = {
  list: BrandList;
  files: Map<string, BrandFile>;
};

// Object keys sorted at every level, so two values that differ only in key
// order compare equal.
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v
  ));
}

// Throws rather than ship a row the app would decode into anything but the
// food it came from, so a change to what the collector emits cannot
// silently vanish from the files.
export function brandRow(brand: BrandDataset, food: SourcedFood): BrandRow {
  const tags = food.tags ?? [];
  const row: BrandRow = [Number(food.sourceId), food.name, tags[0] ?? '', ...NUTRIENT_KEYS.map((key) => food.nutritionFacts[key])];

  if (canonicalJson(brandFood(brand.id, brand.label, row)) !== canonicalJson(food)) {
    throw new Error(`${brand.id}: a row does not fit the brand row layout: ${JSON.stringify(food)}`);
  }

  return row;
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

// Nothing checks the files after this build, so each is held to the
// validator the app reads it through.
export function brandOutput(brands: BrandDataset[], stores: ReadonlyMap<string, StoreBundle> = STORE_BUNDLES): BrandOutput {
  assertStoreBrandsExist(brands, stores);

  const houseBrands = new Set([...stores.values()].flatMap((bundle) => bundle.brands));
  const files = new Map<string, BrandFile>();

  const entries = [...brands].sort(byId).map((brand): BrandListEntry => {
    const count = brand.foods.length;

    if (count < MIN_BRAND_ITEMS && !houseBrands.has(brand.id)) {
      return [brand.id, brand.label, count, null];
    }

    const entry = { label: brand.label, rows: brand.foods.map((food) => brandRow(brand, food)) };
    if (!isBrandFileEntry(entry)) {
      throw new Error(`${brand.id}: the app would refuse this brand's rows`);
    }

    const key = brandFileKey(brand.id);
    const file = files.get(key) ?? {};
    file[brand.id] = entry;
    files.set(key, file);

    return [brand.id, brand.label, count, key];
  });

  const list = { brands: entries };
  if (!isBrandList(list)) {
    throw new Error('the app would refuse the brand list');
  }

  return { list, files };
}
