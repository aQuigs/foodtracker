import { NUTRIENT_KEYS, type NutritionFacts, type SourcedFood } from './types.js';
import { brandSource, type FoodSource } from './foodSources.js';

// What the data build writes under public/data/ and the app reads back,
// relative to that directory.
export const DATA_PATHS = {
  manifest: 'manifest.json',
  source: (source: FoodSource): string => `${source}.json`,
  brandList: 'brands/index.json',
  brandFile: (key: string): string => `brands/${key}.json`,
};

// One build of every file. `version` changes whenever any file does, so a
// source cached at another version is out of date. The file carries more
// (the USDA releases, counts); the app reads only this.
export type CatalogManifest = { version: string };

const NON_LETTER_KEY = '0-9';

export function brandFileKey(id: string): string {
  const first = id.charAt(0);
  return /^[a-z]$/.test(first) ? first : NON_LETTER_KEY;
}

// file: the key of the letter file holding the brand's rows, or null for a
// brand listed without them.
export type BrandListEntry = [id: string, label: string, count: number, file: string | null];

// Every brand, for the picker and for labels. Hydrating a brand never needs it.
export type BrandList = { brands: BrandListEntry[] };

// The list names no build, so the catalog cache keeps its copy beside the
// version it came from.
export type BrandListCopy = { version: string; list: BrandList };

// One brand row on the wire, in this order. Nutrition goes last, in
// NUTRIENT_KEYS order, so a new nutrient appends a column. Every other
// SourcedFood field is the same for all of a brand's rows, so it is left
// out and rebuilt by brandFood().
export type BrandRow = [fdcId: number, name: string, category: string, ...nutrition: number[]];

export const BRAND_ROW_LENGTH = 3 + NUTRIENT_KEYS.length;

// A letter file holds every brand whose id starts with its key, each with
// the label its rows are tagged with.
export type BrandFileEntry = { label: string; rows: BrandRow[] };

export type BrandFile = Record<string, BrandFileEntry>;

export function brandFood(brandId: string, label: string, row: BrandRow): SourcedFood {
  const [fdcId, name, category, ...nutrition] = row;
  const source = brandSource(brandId);
  const sourceId = String(fdcId);
  const nutritionFacts = Object.fromEntries(NUTRIENT_KEYS.map((key, i) => [key, nutrition[i]])) as NutritionFacts;

  return {
    id: `${source}:${sourceId}`,
    name,
    brand: label,
    nutritionFacts,
    servingSize: 100,
    servingUnit: 'g',
    source,
    sourceId,
    tags: category === '' ? [] : [category],
  };
}
