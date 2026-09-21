import type { SourcedFood } from '../domain/types.js';
import { DATA_PATHS, brandFileKey, brandFood, type BrandList } from '../domain/dataFiles.js';
import { brandSource } from '../domain/foodSources.js';
import { isBrandFileEntry, isBrandFileObject, isBrandList } from '../domain/validate.js';
import type { BrandsProvider, FoodSourceProvider } from './foodSourceProvider.js';
import { dataUrl, fetchJson } from './fetchJson.js';

type HttpBrandsProviderConfig = {
  baseUrl: string;
};

export class HttpBrandsProvider implements BrandsProvider {
  readonly #baseUrl: string;
  // By URL, so by letter and build: a store's house brands often share a
  // letter, and each file is downloaded and parsed once for all of them. A
  // failed fetch is dropped so the next brand to ask tries again.
  readonly #letterFiles = new Map<string, Promise<Record<string, unknown>>>();

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

  // Only the brand that starts a download hears its progress, so brands
  // sharing a file count its bytes once between them.
  #letterFile(url: string, onProgress?: (loaded: number) => void): Promise<Record<string, unknown>> {
    const kept = this.#letterFiles.get(url);
    if (kept) {
      return kept;
    }

    const loading = fetchJson(url, 'fetchRows()', { onProgress }).then((raw) => {
      if (!isBrandFileObject(raw)) {
        throw new Error(`fetchRows(): letter file at ${url} is not an object of brands`);
      }

      return raw;
    });
    this.#letterFiles.set(url, loading);
    loading.catch(() => {
      if (this.#letterFiles.get(url) === loading) {
        this.#letterFiles.delete(url);
      }
    });

    return loading;
  }

  // A brand its letter file does not hold — one this build lists without
  // rows, or one it no longer has — has no rows at this build: an empty
  // partition, not a failure to retry on every boot. Only this brand's entry
  // is checked and decoded.
  async #fetchBrand(brandId: string, version: string, onProgress?: (loaded: number) => void): Promise<SourcedFood[]> {
    const url = dataUrl(this.#baseUrl, DATA_PATHS.brandFile(brandFileKey(brandId)), version);
    const file = await this.#letterFile(url, onProgress);

    if (!Object.hasOwn(file, brandId)) {
      return [];
    }

    const entry = file[brandId];
    if (!isBrandFileEntry(entry)) {
      throw new Error(`fetchRows(): brand ${brandId} at ${url} is malformed`);
    }

    return entry.rows.map((row) => brandFood(brandId, entry.label, row));
  }
}
