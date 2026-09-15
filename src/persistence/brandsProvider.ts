import type { BrandsIndex, FoodSourceManifest, SourcedFood } from '../domain/types.js';
import { isBrandsIndex } from '../domain/validate.js';
import { BRANDS_DATASET, brandEntry, brandIdOf, datasetDir, type BrandEntry } from '../domain/foodSources.js';
import type { BrandsProvider, FoodSourceProvider } from './foodSourceProvider.js';
import { fetchJson, fetchVerifiedRows } from './fetchBytes.js';

type HttpBrandsProviderConfig = {
  baseUrl: string;
  version: string;
};

export class HttpBrandsProvider implements BrandsProvider {
  readonly version: string;
  readonly #baseUrl: string;

  constructor(config: HttpBrandsProviderConfig) {
    this.version = config.version;
    this.#baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  #dir(): string {
    return `${this.#baseUrl}/${datasetDir(BRANDS_DATASET, this.version)}`;
  }

  async fetchIndex(): Promise<BrandsIndex> {
    // Revalidated on every load: a dataset rebuilt at the same version
    // rewrites the shards, and an index the HTTP cache still holds from
    // before would fail every one of their hashes.
    const url = `${this.#dir()}/index.json`;
    const raw = await fetchJson(url, 'fetchIndex()', { cache: 'no-cache' });

    if (!isBrandsIndex(raw)) {
      throw new Error(`fetchIndex(): index shape invalid at ${url}`);
    }

    if (raw.version !== this.version) {
      throw new Error(`fetchIndex(): index.version=${raw.version} does not match requested version=${this.version}`);
    }

    return raw;
  }

  providerFor(source: string, index: BrandsIndex): FoodSourceProvider | null {
    const id = brandIdOf(source);
    const entry = id === null ? undefined : brandEntry(index, id);
    return entry === undefined ? null : new BrandShardProvider(source, entry, index, this.#dir());
  }
}

// A brand's rows live in a shard shared with other brands: the manifest is
// derived from the index, the whole shard is verified, and only this
// brand's rows are handed back. Sibling brands in the same shard hit the
// HTTP cache.
class BrandShardProvider implements FoodSourceProvider {
  readonly name: string;
  readonly #entry: BrandEntry;
  readonly #index: BrandsIndex;
  readonly #dir: string;

  constructor(name: string, entry: BrandEntry, index: BrandsIndex, dir: string) {
    this.name = name;
    this.#entry = entry;
    this.#index = index;
    this.#dir = dir;
  }

  async fetchManifest(version: string): Promise<FoodSourceManifest> {
    if (version !== this.#index.version) {
      throw new Error(`fetchManifest(): index.version=${this.#index.version} does not match requested version=${version}`);
    }

    return {
      source: this.name,
      version,
      itemCount: this.#entry.count,
      sha256: this.#index.shards[this.#entry.shard]!.sha256,
      generatedAt: this.#index.generatedAt,
    };
  }

  async fetchDataset(manifest: FoodSourceManifest, onProgress?: (loaded: number) => void): Promise<SourcedFood[]> {
    if (manifest.source !== this.name) {
      throw new Error(`fetchDataset(): manifest.source=${manifest.source} does not match provider name=${this.name}`);
    }

    const shard = await fetchVerifiedRows(`${this.#dir}/shard-${this.#entry.shard}.json`, manifest.sha256, onProgress, 'fetchDataset()');
    const rows = shard.filter((f) => f.source === this.name);

    if (rows.length !== manifest.itemCount) {
      throw new Error(`fetchDataset(): itemCount mismatch (manifest=${manifest.itemCount}, shard=${rows.length})`);
    }

    return rows;
  }
}
