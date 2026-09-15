import type { BrandsIndex, BrandsIndexEntry, FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import type { BrandsProvider, FoodSourceProvider } from '../src/persistence/foodSourceProvider.js';
import { BRANDS_DATASET, brandEntry, brandIdOf, brandSource } from '../src/domain/foodSources.js';

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

export type FakeBrand = { id: string; label: string; rows: SourcedFood[] };

// An index over the given brands, one shard each.
export function fakeIndex(brands: FakeBrand[], version = '1'): BrandsIndex {
  const entries: BrandsIndexEntry[] = brands
    .map((b, i): BrandsIndexEntry => [b.id, b.label, b.rows.length, i])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));

  return {
    source: BRANDS_DATASET,
    version,
    generatedAt: '2026-09-15T00:00:00.000Z',
    brands: entries,
    shards: brands.map((_, i) => ({ sha256: `sha-${i}`, itemCount: 0, bytes: 0 })),
  };
}

export type FakeBrandsOptions = {
  brands?: FakeBrand[];
  fetchIndexThrows?: string;
  fetchDatasetThrows?: string;
  holdIndexUntil?: Promise<void>;
  holdDatasetUntil?: Promise<void>;
};

export type FakeBrandsProvider = BrandsProvider & {
  indexFetches: number;
  datasetFetches: string[];
};

// In-memory BrandsProvider at version 1: the index lists `brands`, and a
// brand's dataset is its rows, so an app test drives the whole
// enable → index → shard → hydrate path without a network.
export function fakeBrandsProvider(opts: FakeBrandsOptions = {}): FakeBrandsProvider {
  const brands = opts.brands ?? [];
  const index = fakeIndex(brands);
  const rowsById = new Map(brands.map((b) => [b.id, b.rows]));

  const provider: FakeBrandsProvider = {
    version: index.version,
    indexFetches: 0,
    datasetFetches: [],

    async fetchIndex(): Promise<BrandsIndex> {
      provider.indexFetches++;
      if (opts.fetchIndexThrows) {
        throw new Error(opts.fetchIndexThrows);
      }

      if (opts.holdIndexUntil) {
        await opts.holdIndexUntil;
      }

      return index;
    },

    providerFor(source: string, idx: BrandsIndex): FoodSourceProvider | null {
      const id = brandIdOf(source);
      const entry = id === null ? undefined : brandEntry(idx, id);
      if (entry === undefined) {
        return null;
      }

      return {
        name: source,
        async fetchManifest(version: string): Promise<FoodSourceManifest> {
          return { source, version, itemCount: entry.count, sha256: idx.shards[entry.shard]!.sha256, generatedAt: idx.generatedAt };
        },
        // Progress, then the hold, then any failure: a test can untick a
        // source mid-download and see what a late progress tick or failure
        // does to its banner.
        async fetchDataset(_manifest, onProgress): Promise<SourcedFood[]> {
          provider.datasetFetches.push(source);
          onProgress?.(2048);

          if (opts.holdDatasetUntil) {
            await opts.holdDatasetUntil;
          }

          if (opts.fetchDatasetThrows) {
            throw new Error(opts.fetchDatasetThrows);
          }

          return [...(rowsById.get(entry.id) ?? [])];
        },
      };
    },
  };

  return provider;
}
