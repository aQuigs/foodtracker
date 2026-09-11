// Fetch strategies the worker applies, with the fetch injected so tests can
// drive them without a worker.

export type Fetcher = (url: string, init: { signal: AbortSignal; cache: RequestCache }) => Promise<Response>;

// Resolves only once the whole response has arrived: a body that stalls
// after the headers counts as a connection that never answered, and the
// request is aborted rather than left holding a socket. The document is
// fetched by URL, not by re-issuing the navigation request, because a
// navigate-mode Request does not take an abort signal in every browser.
export async function fetchWhole(url: string, cache: RequestCache, timeoutMs: number, fetcher: Fetcher = fetch): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, { signal: controller.signal, cache });
    // Reading a clone to the end leaves the original body fully buffered.
    await response.clone().arrayBuffer();
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function networkFirst(load: () => Promise<Response>, fallback: () => Promise<Response | undefined>): Promise<Response> {
  try {
    return await load();
  } catch (error) {
    const cached = await fallback();

    if (!cached) {
      throw error;
    }

    return cached;
  }
}
