import type { SourcedFood } from '../domain/types.js';
import { isSourcedFood } from '../domain/validate.js';

// The HTTP and JSON half of reading a small dataset file — a manifest, the
// brands index. `label` prefixes every error so a caller's messages read as
// its own.
export async function fetchJson(url: string, label: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);

  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} for ${url}`);
  }

  try {
    return await res.json();
  } catch (e) {
    throw new Error(`${label}: invalid JSON at ${url}: ${(e as Error).message}`);
  }
}

// A dataset file: verified against its SHA-256 over the exact bytes
// received, then every row checked. Served as plain JSON: the hash is over
// these bytes, so transport compression (which servers apply and browsers
// strip invisibly) cannot break integrity checking the way a pre-gzipped
// artifact would.
export async function fetchVerifiedRows(
  url: string,
  expectedSha256: string,
  onProgress: ((loaded: number) => void) | undefined,
  label: string,
): Promise<SourcedFood[]> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} for ${url}`);
  }

  const body = await readWithProgress(res, onProgress);
  const actualSha = await sha256Hex(body);

  if (actualSha !== expectedSha256) {
    throw new Error(`${label}: SHA-256 mismatch (expected ${expectedSha256}, got ${actualSha})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch (e) {
    throw new Error(`${label}: invalid JSON payload at ${url}: ${(e as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${label}: payload at ${url} is not an array`);
  }

  for (let i = 0; i < parsed.length; i++) {
    if (!isSourcedFood(parsed[i])) {
      throw new Error(`${label}: item at index ${i} is not a valid SourcedFood`);
    }
  }

  return parsed as SourcedFood[];
}

// onProgress reports bytes received so far; there is no reliable total
// because transport compression makes Content-Length a different unit.
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
