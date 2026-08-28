import type { SourcedFood, FoodSourceManifest } from '../domain/types.js';
import { isFoodSourceManifest, isSourcedFood } from '../domain/validate.js';
import { datasetDir } from '../domain/foodSources.js';
import type { FoodSourceProvider } from './foodSourceProvider.js';

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

    // Served as plain JSON: the manifest sha256 is over these exact bytes, so
    // transport compression (which servers apply and browsers strip invisibly)
    // cannot break integrity checking the way a pre-gzipped artifact would.
    const url = this.#url(manifest.version, 'foods.json');
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`fetchDataset(): HTTP ${res.status} for ${url}`);
    }

    const body = await readWithProgress(res, onProgress);
    const actualSha = await sha256Hex(body);

    if (actualSha !== manifest.sha256) {
      throw new Error(`fetchDataset(): SHA-256 mismatch (expected ${manifest.sha256}, got ${actualSha})`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(body));
    } catch (e) {
      throw new Error(`fetchDataset(): invalid JSON payload at ${url}: ${(e as Error).message}`);
    }

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

async function readWithProgress(
  res: Response,
  onProgress?: (loaded: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!onProgress || !res.body) {
    return new Uint8Array(await res.arrayBuffer());
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    loaded += value.length;
    onProgress(loaded);
  }

  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }

  return out;
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
