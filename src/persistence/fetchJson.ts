// A file under the data directory. `?v=` gives each build's copy its own
// URL: GitHub Pages lets browsers reuse a file for ten minutes, and without
// it a copy from the previous build could answer for the new one.
export function dataUrl(baseUrl: string, path: string, version?: string): string {
  const url = `${baseUrl.replace(/\/$/, '')}/${path}`;
  return version === undefined ? url : `${url}?v=${encodeURIComponent(version)}`;
}

type FetchJsonOptions = {
  init?: RequestInit;
  onProgress?: ((loaded: number) => void) | undefined;
};

// `label` prefixes every error so a caller's messages read as its own.
export async function fetchJson(url: string, label: string, opts: FetchJsonOptions = {}): Promise<unknown> {
  const res = await fetch(url, opts.init);

  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} for ${url}`);
  }

  const body = await readWithProgress(res, opts.onProgress);

  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch (e) {
    throw new Error(`${label}: invalid JSON at ${url}: ${(e as Error).message}`);
  }
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
