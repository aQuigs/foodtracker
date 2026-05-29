import type { SourcedFood, FoodSourceManifest } from '../domain/types.js';

export interface FoodSourceProvider {
  readonly name: string;
  fetchManifest(version: string): Promise<FoodSourceManifest>;
  fetchDataset(
    manifest: FoodSourceManifest,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<SourcedFood[]>;
}
