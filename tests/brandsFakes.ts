import type { BrandsIndex, BrandsIndexEntry, FoodSourceManifest, SourcedFood } from '../src/domain/types.js';
import type { BrandsProvider, FoodSourceProvider } from '../src/persistence/foodSourceProvider.js';
import { brandIdOf, brandSource } from '../src/domain/foodSources.js';

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

// Builds an index over the given brands, one shard per brand unless
// `shardOf` says otherwise, so a test can put two brands in one shard.
export function fakeIndex(brands: FakeBrand[], version = '1', shardOf: Record<string, number> = {}): BrandsIndex {
  const shardCount = Math.max(brands.length, ...Object.values(shardOf).map((s) => s + 1), 1);
  const entries: BrandsIndexEntry[] = brands
    .map((b, i): BrandsIndexEntry => [b.id, b.label, b.rows.length, shardOf[b.id] ?? i])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));

  return {
    source: 'brands',
    version,
    generatedAt: '2026-09-15T00:00:00.000Z',
    brands: entries,
    shards: Array.from({ length: shardCount }, (_, i) => ({ sha256: `sha-${i}`, itemCount: 0, bytes: 0 })),
  };
}

export type FakeBrandsOptions = {
  version?: string;
  index?: BrandsIndex;
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

// In-memory BrandsProvider: the index is what the test says, and a brand's
// dataset is its rows from `brands`, so an app test drives the whole
// enable → index → shard → hydrate path without a network.
export function fakeBrandsProvider(opts: FakeBrandsOptions = {}): FakeBrandsProvider {
  const brands = opts.brands ?? [];
  const index = opts.index ?? fakeIndex(brands, opts.version ?? '1');
  const rowsById = new Map(brands.map((b) => [b.id, b.rows]));

  const provider: FakeBrandsProvider = {
    version: opts.version ?? '1',
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
      const entry = id === null ? undefined : idx.brands.find((e) => e[0] === id);
      if (entry === undefined) {
        return null;
      }

      return {
        name: source,
        async fetchManifest(version: string): Promise<FoodSourceManifest> {
          return { source, version, itemCount: entry[2], sha256: idx.shards[entry[3]]!.sha256, generatedAt: idx.generatedAt };
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

          return [...(rowsById.get(id!) ?? [])];
        },
      };
    },
  };

  return provider;
}
