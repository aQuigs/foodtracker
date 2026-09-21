import type { SourcedFood } from '../domain/types.js';
import { DATA_PATHS, brandFileKey, brandFood, type BrandList } from '../domain/dataFiles.js';
import { brandSource } from '../domain/foodSources.js';
import { isBrandFileEntry, isBrandList } from '../domain/validate.js';
import type { BrandsProvider, FoodSourceProvider } from './foodSourceProvider.js';
import { dataUrl, fetchJson } from './fetchJson.js';

type HttpBrandsProviderConfig = {
  baseUrl: string;
};

export class HttpBrandsProvider implements BrandsProvider {
  readonly #baseUrl: string;

  constructor(config: HttpBrandsProviderConfig) {
    this.#baseUrl = config.baseUrl;
  }

  async fetchList(version: string): Promise<BrandList> {
    const url = dataUrl(this.#baseUrl, DATA_PATHS.brandList, version);
    const raw = await fetchJson(url, 'fetchList()');

    if (!isBrandList(raw)) {
      throw new Error(`fetchList(): brand list shape invalid at ${url}`);
    }

    return raw;
  }

  providerFor(brandId: string): FoodSourceProvider {
    return {
      name: brandSource(brandId),
      fetchRows: (version, onProgress) => this.#fetchBrand(brandId, version, onProgress),
    };
  }

  // A letter file holds every brand filed under its key; only this one's
  // entry is checked and decoded. A sibling brand fetched next reads the
  // same file from the HTTP cache.
  async #fetchBrand(brandId: string, version: string, onProgress?: (loaded: number) => void): Promise<SourcedFood[]> {
    const url = dataUrl(this.#baseUrl, DATA_PATHS.brandFile(brandFileKey(brandId)), version);
    const file = await fetchJson(url, 'fetchRows()', { onProgress });

    const holds = typeof file === 'object' && file !== null && !Array.isArray(file) && Object.hasOwn(file, brandId);
    if (!holds) {
      throw new Error(`fetchRows(): ${url} has no brand ${brandId}`);
    }

    const entry: unknown = (file as Record<string, unknown>)[brandId];
    if (!isBrandFileEntry(entry)) {
      throw new Error(`fetchRows(): brand ${brandId} at ${url} is malformed`);
    }

    return entry.rows.map((row) => brandFood(brandId, entry.label, row));
  }
}
