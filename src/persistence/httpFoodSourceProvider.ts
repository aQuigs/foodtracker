import type { SourcedFood, FoodSourceManifest } from '../domain/types.js';
import { isFoodSourceManifest, isSourcedFood } from '../domain/validate.js';
import { datasetDir } from '../domain/foodSources.js';
import type { FoodSourceProvider } from './foodSourceProvider.js';
import { fetchVerifiedJson } from './fetchBytes.js';

type HttpFoodSourceProviderConfig = {
  name: string;
  baseUrl: string;
};

export class HttpFoodSourceProvider implements FoodSourceProvider {
  readonly name: string;
  readonly #baseUrl: string;

  constructor(config: HttpFoodSourceProviderConfig) {
    this.name = config.name;
    this.#baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  #url(version: string, asset: string): string {
    return `${this.#baseUrl}/${datasetDir(this.name, version)}/${asset}`;
  }

  async fetchManifest(version: string): Promise<FoodSourceManifest> {
    const url = this.#url(version, 'manifest.json');
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`fetchManifest(): HTTP ${res.status} for ${url}`);
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch (e) {
      throw new Error(`fetchManifest(): invalid JSON at ${url}: ${(e as Error).message}`);
    }

    if (!isFoodSourceManifest(raw)) {
      throw new Error(`fetchManifest(): manifest shape invalid at ${url}`);
    }

    if (raw.source !== this.name) {
      throw new Error(`fetchManifest(): manifest.source=${raw.source} does not match provider name=${this.name}`);
    }

    if (raw.version !== version) {
      throw new Error(`fetchManifest(): manifest.version=${raw.version} does not match requested version=${version}`);
    }

    return raw;
  }

  async fetchDataset(
    manifest: FoodSourceManifest,
    onProgress?: (loaded: number) => void,
  ): Promise<SourcedFood[]> {
    if (manifest.source !== this.name) {
      throw new Error(`fetchDataset(): manifest.source=${manifest.source} does not match provider name=${this.name}`);
    }

    const url = this.#url(manifest.version, 'foods.json');
    const parsed = await fetchVerifiedJson(url, manifest.sha256, onProgress, 'fetchDataset()');

    if (!Array.isArray(parsed)) {
      throw new Error(`fetchDataset(): payload at ${url} is not an array`);
    }

    if (parsed.length !== manifest.itemCount) {
      throw new Error(`fetchDataset(): itemCount mismatch (manifest=${manifest.itemCount}, payload=${parsed.length})`);
    }

    for (let i = 0; i < parsed.length; i++) {
      if (!isSourcedFood(parsed[i])) {
        throw new Error(`fetchDataset(): item at index ${i} is not a valid SourcedFood`);
      }
    }

    return parsed as SourcedFood[];
  }
}
