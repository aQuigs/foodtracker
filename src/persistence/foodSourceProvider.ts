import type { SourcedFood } from '../domain/types.js';
import type { BrandList } from '../domain/dataFiles.js';

export interface FoodSourceProvider {
  readonly name: string;
  // The rows of `version`, the build the catalog manifest names. onProgress
  // reports bytes received so far; there is no reliable total because
  // transport compression makes Content-Length a different unit.
  fetchRows(version: string, onProgress?: (loaded: number) => void): Promise<SourcedFood[]>;
}

export type BrandProviders = (brandId: string) => FoodSourceProvider;

// Every brand is a source, but there are tens of thousands of them, so they
// are not registered one by one: any brand id has a provider over its letter
// file, and the list names them all for the picker.
export interface BrandsProvider {
  fetchList(version: string): Promise<BrandList>;
  // The brands hydrated inside one `run` share one download and parse of
  // each letter file, and the parsed files are let go once `run` settles.
  batch<T>(run: (providerFor: BrandProviders) => Promise<T>): Promise<T>;
}
