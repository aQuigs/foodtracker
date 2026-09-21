import type { SourcedFood } from '../domain/types.js';
import type { FoodSource } from '../domain/foodSources.js';
import { DATA_PATHS, type CatalogManifest } from '../domain/dataFiles.js';
import { isCatalogManifest, isSourcedFood } from '../domain/validate.js';
import type { FoodSourceProvider } from './foodSourceProvider.js';
import { dataUrl, fetchJson } from './fetchJson.js';

// Revalidated with the server on every load: it is the one data file whose
// URL is the same for every build.
export async function fetchCatalogManifest(baseUrl: string): Promise<CatalogManifest> {
  const url = dataUrl(baseUrl, DATA_PATHS.manifest);
  const raw = await fetchJson(url, 'fetchManifest()', { init: { cache: 'no-cache' } });

  if (!isCatalogManifest(raw)) {
    throw new Error(`fetchManifest(): manifest shape invalid at ${url}`);
  }

  return raw;
}

type HttpFoodSourceProviderConfig = {
  name: FoodSource;
  baseUrl: string;
};

export class HttpFoodSourceProvider implements FoodSourceProvider {
  readonly name: FoodSource;
  readonly #baseUrl: string;

  constructor(config: HttpFoodSourceProviderConfig) {
    this.name = config.name;
    this.#baseUrl = config.baseUrl;
  }

  async fetchRows(version: string, onProgress?: (loaded: number) => void): Promise<SourcedFood[]> {
    const url = dataUrl(this.#baseUrl, DATA_PATHS.source(this.name), version);
    const rows = await fetchJson(url, 'fetchRows()', { onProgress });

    if (!Array.isArray(rows)) {
      throw new Error(`fetchRows(): payload at ${url} is not an array`);
    }

    const bad = rows.findIndex((row) => !isSourcedFood(row));
    if (bad !== -1) {
      throw new Error(`fetchRows(): item at index ${bad} of ${url} is not a valid SourcedFood`);
    }

    return rows as SourcedFood[];
  }
}
