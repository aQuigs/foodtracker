import type { BrandsIndex, BrandsIndexEntry, FoodSourceManifest, SourcedFood } from '../domain/types.js';
import { isBrandsIndex, isSourcedFood } from '../domain/validate.js';
import { BRANDS_DATASET, brandEntry, brandIdOf, datasetDir } from '../domain/foodSources.js';
import type { BrandsProvider, FoodSourceProvider } from './foodSourceProvider.js';
import { fetchVerifiedJson } from './fetchBytes.js';

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
    const res = await fetch(url, { cache: 'no-cache' });

    if (!res.ok) {
      throw new Error(`fetchIndex(): HTTP ${res.status} for ${url}`);
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch (e) {
      throw new Error(`fetchIndex(): invalid JSON at ${url}: ${(e as Error).message}`);
    }

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
  readonly #entry: BrandsIndexEntry;
  readonly #index: BrandsIndex;
  readonly #dir: string;

  constructor(name: string, entry: BrandsIndexEntry, index: BrandsIndex, dir: string) {
    this.name = name;
    this.#entry = entry;
    this.#index = index;
    this.#dir = dir;
  }

  async fetchManifest(version: string): Promise<FoodSourceManifest> {
    if (version !== this.#index.version) {
      throw new Error(`fetchManifest(): index.version=${this.#index.version} does not match requested version=${version}`);
    }

    const [, , count, shard] = this.#entry;
    return {
      source: this.name,
      version,
      itemCount: count,
      sha256: this.#index.shards[shard]!.sha256,
      generatedAt: this.#index.generatedAt,
    };
  }

  async fetchDataset(manifest: FoodSourceManifest, onProgress?: (loaded: number) => void): Promise<SourcedFood[]> {
    if (manifest.source !== this.name) {
      throw new Error(`fetchDataset(): manifest.source=${manifest.source} does not match provider name=${this.name}`);
    }

    const url = `${this.#dir}/shard-${this.#entry[3]}.json`;
    const parsed = await fetchVerifiedJson(url, manifest.sha256, onProgress, 'fetchDataset()');

    if (!Array.isArray(parsed)) {
      throw new Error(`fetchDataset(): payload at ${url} is not an array`);
    }

    for (let i = 0; i < parsed.length; i++) {
      if (!isSourcedFood(parsed[i])) {
        throw new Error(`fetchDataset(): item at index ${i} is not a valid SourcedFood`);
      }
    }

    const rows = (parsed as SourcedFood[]).filter((f) => f.source === this.name);
    if (rows.length !== manifest.itemCount) {
      throw new Error(`fetchDataset(): itemCount mismatch (manifest=${manifest.itemCount}, shard=${rows.length})`);
    }

    return rows;
  }
}
