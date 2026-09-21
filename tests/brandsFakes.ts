import type { SourcedFood } from '../src/domain/types.js';
import type { BrandList, BrandListEntry } from '../src/domain/dataFiles.js';
import type { BrandsProvider, FoodSourceProvider } from '../src/persistence/foodSourceProvider.js';
import { brandSource } from '../src/domain/foodSources.js';

export function brandRow(brandId: string, label: string, sourceId: string, name: string, calories = 100): SourcedFood {
  return {
    id: `${brandSource(brandId)}:${sourceId}`,
    name,
    brand: label,
    nutritionFacts: { calories, protein: 5, carbs: 10, fat: 2 },
    servingSize: 100,
    servingUnit: 'g',
    source: brandSource(brandId),
    sourceId,
    tags: [],
  };
}

// listedOnly: the build listed the brand but shipped no rows for it.
export type FakeBrand = { id: string; label: string; rows: SourcedFood[]; listedOnly?: boolean };

export function fakeBrandList(brands: FakeBrand[]): BrandList {
  const entries = brands
    .map((b): BrandListEntry => [b.id, b.label, b.rows.length, !b.listedOnly])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));

  return { brands: entries };
}

export type FakeBrandsOptions = {
  brands?: FakeBrand[];
  fetchListThrows?: string;
  fetchRowsThrows?: string;
  holdListUntil?: Promise<void>;
  holdRowsUntil?: Promise<void>;
};

export type FakeBrandsProvider = BrandsProvider & {
  listFetches: string[];
  rowFetches: string[];
};

// An in-memory BrandsProvider: the list names `brands`, and a brand's rows
// are its `rows`, so an app test drives the whole enable → letter file →
// hydrate path without a network. Both record the version they were asked
// for.
export function fakeBrandsProvider(opts: FakeBrandsOptions = {}): FakeBrandsProvider {
  const brands = opts.brands ?? [];
  const list = fakeBrandList(brands);

  const provider: FakeBrandsProvider = {
    listFetches: [],
    rowFetches: [],

    async fetchList(version: string): Promise<BrandList> {
      provider.listFetches.push(version);
      if (opts.fetchListThrows) {
        throw new Error(opts.fetchListThrows);
      }

      if (opts.holdListUntil) {
        await opts.holdListUntil;
      }

      return list;
    },

    providerFor(brandId: string): FoodSourceProvider {
      const source = brandSource(brandId);

      return {
        name: source,
        // Progress, then the hold, then any failure: a test can untick a
        // source mid-download and see what a late progress tick or failure
        // does to its banner.
        async fetchRows(_version, onProgress): Promise<SourcedFood[]> {
          provider.rowFetches.push(source);
          onProgress?.(2048);

          if (opts.holdRowsUntil) {
            await opts.holdRowsUntil;
          }

          if (opts.fetchRowsThrows) {
            throw new Error(opts.fetchRowsThrows);
          }

          const brand = brands.find((b) => b.id === brandId && !b.listedOnly);
          if (!brand) {
            throw new Error(`no brand ${brandId}`);
          }

          return [...brand.rows];
        },
      };
    },
  };

  return provider;
}
