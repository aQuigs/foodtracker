import type { BrandsIndex, SourcedFood, FoodSourceManifest } from '../domain/types.js';

export interface FoodSourceProvider {
  readonly name: string;
  fetchManifest(version: string): Promise<FoodSourceManifest>;
  // onProgress reports bytes received so far; there is no reliable total
  // because transport compression makes Content-Length a different unit.
  fetchDataset(manifest: FoodSourceManifest, onProgress?: (loaded: number) => void): Promise<SourcedFood[]>;
}

// Every brand is a source, but there are tens of thousands of them, so they
// are declared by one index rather than registered one by one: the index
// names each brand and the shard holding its rows, and providerFor turns a
// `brand:<id>` source into a FoodSourceProvider over that shard.
export interface BrandsProvider {
  readonly version: string;
  fetchIndex(): Promise<BrandsIndex>;
  // null when the source is not a brand or the index does not list it.
  providerFor(source: string, index: BrandsIndex): FoodSourceProvider | null;
}
