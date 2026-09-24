import type { SourcedFood } from '../domain/types.js';
import { DATA_PATHS, brandFileKey, brandFood, type BrandList } from '../domain/dataFiles.js';
import { brandSource } from '../domain/foodSources.js';
import { isBrandFileEntry, isBrandFileObject, isBrandList } from '../domain/validate.js';
import type { BrandProviders, BrandsProvider } from './foodSourceProvider.js';
import { dataUrl, fetchJson } from './fetchJson.js';

type HttpBrandsProviderConfig = {
  baseUrl: string;
};

// One batch's letter files, by URL, so by letter and build.
type LetterFiles = Map<string, Promise<Record<string, unknown>>>;

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

  // A store's house brands often share a letter, so a batch downloads and
  // parses each file once for all of them. The largest file parses to about
  // 11 MB of heap and a store's files together to tens of megabytes, so none
  // outlives its batch.
  async batch<T>(run: (providerFor: BrandProviders) => Promise<T>): Promise<T> {
    const files: LetterFiles = new Map();

    try {
      return await run((brandId) => ({
        name: brandSource(brandId),
        fetchRows: (version, onProgress) => this.#fetchBrand(files, brandId, version, onProgress),
      }));
    } finally {
      files.clear();
    }
  }

  // Only the brand that starts a download hears its progress, so brands
  // sharing a file count its bytes once between them. A failed fetch is
  // dropped so the next brand to ask tries again.
  #letterFile(files: LetterFiles, url: string, onProgress?: (loaded: number) => void): Promise<Record<string, unknown>> {
    const kept = files.get(url);
    if (kept) {
      return kept;
    }

    const loading = fetchJson(url, 'fetchRows()', { onProgress }).then((raw) => {
      if (!isBrandFileObject(raw)) {
        throw new Error(`fetchRows(): letter file at ${url} is not an object of brands`);
      }

      return raw;
    });
    files.set(url, loading);
    loading.catch(() => {
      if (files.get(url) === loading) {
        files.delete(url);
      }
    });

    return loading;
  }

  // A brand its letter file does not hold — one this build lists without
  // rows, or one it no longer has — has no rows at this build: an empty
  // partition, not a failure to retry on every boot. Only this brand's entry
  // is checked and decoded.
  async #fetchBrand(
    files: LetterFiles, brandId: string, version: string, onProgress?: (loaded: number) => void,
  ): Promise<SourcedFood[]> {
    const url = dataUrl(this.#baseUrl, DATA_PATHS.brandFile(brandFileKey(brandId)), version);
    const file = await this.#letterFile(files, url, onProgress);

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
