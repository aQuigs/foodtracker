import type { SourcedFood, FoodSourceManifest } from '../domain/types.js';
import { isFoodSourceManifest, isSourcedFood } from '../domain/validate.js';
import type { FoodSourceProvider } from './foodSourceProvider.js';

export type GithubReleasesFoodSourceProviderConfig = {
  name: string;
  baseUrl: string;
  tagPrefix: string;
};

export class GithubReleasesFoodSourceProvider implements FoodSourceProvider {
  readonly name: string;
  readonly #baseUrl: string;
  readonly #tagPrefix: string;

  constructor(config: GithubReleasesFoodSourceProviderConfig) {
    this.name = config.name;
    this.#baseUrl = config.baseUrl.replace(/\/$/, '');
    this.#tagPrefix = config.tagPrefix;
  }

  #url(version: string, asset: string): string {
    return `${this.#baseUrl}/${this.#tagPrefix}${version}/${asset}`;
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
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<SourcedFood[]> {
    if (manifest.source !== this.name) {
      throw new Error(`fetchDataset(): manifest.source=${manifest.source} does not match provider name=${this.name}`);
    }

    const url = this.#url(manifest.version, 'foods.json.gz');
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`fetchDataset(): HTTP ${res.status} for ${url}`);
    }

    const gz = await readWithProgress(res, onProgress);
    const actualSha = await sha256Hex(gz);

    if (actualSha !== manifest.sha256) {
      throw new Error(`fetchDataset(): SHA-256 mismatch (expected ${manifest.sha256}, got ${actualSha})`);
    }

    let json: string;
    try {
      json = await gunzipToString(gz);
    } catch (e) {
      throw new Error(`fetchDataset(): gzip decode failed at ${url}: ${(e as Error).message}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
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
  onProgress?: (loaded: number, total: number) => void,
): Promise<Uint8Array> {
  const total = parseContentLength(res.headers.get('Content-Length'));

  if (!onProgress || !res.body || total === 0) {
    const buf = await res.arrayBuffer();
    onProgress?.(buf.byteLength, buf.byteLength);
    return new Uint8Array(buf);
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
    onProgress(loaded, total);
  }

  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }

  return out;
}

async function gunzipToString(gz: Uint8Array): Promise<string> {
  const blob = new Blob([toArrayBuffer(gz)]);
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buf);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

function parseContentLength(raw: string | null): number {
  if (raw === null) {
    return 0;
  }

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
