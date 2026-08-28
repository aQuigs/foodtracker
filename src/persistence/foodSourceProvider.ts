import type { SourcedFood, FoodSourceManifest } from '../domain/types.js';

export interface FoodSourceProvider {
  readonly name: string;
  fetchManifest(version: string): Promise<FoodSourceManifest>;
  // onProgress reports bytes received so far; there is no reliable total
  // because transport compression makes Content-Length a different unit.
  fetchDataset(manifest: FoodSourceManifest, onProgress?: (loaded: number) => void): Promise<SourcedFood[]>;
}
