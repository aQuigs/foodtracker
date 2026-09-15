// Fetch strategies the worker applies, with the fetch injected so tests can
// drive them without a worker.

export type Fetcher = (url: string, init: { signal: AbortSignal; cache: RequestCache; redirect: RequestRedirect }) => Promise<Response>;

// Resolves only once the whole response has arrived: a body that stalls
// after the headers counts as a connection that never answered, and the
// request is aborted rather than left holding a socket. The document is
// fetched by URL, not by re-issuing the navigation request, because a
// navigate-mode Request does not take an abort signal in every browser.
// Redirects are not followed here: a followed redirect is refused as the
// answer to a navigation, while an opaque one lets the browser follow it.
export async function fetchWhole(url: string, cache: RequestCache, timeoutMs: number, fetcher: Fetcher = fetch): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, { signal: controller.signal, cache, redirect: 'manual' });
    // Reading a clone to the end leaves the original body fully buffered.
    await response.clone().arrayBuffer();
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// The cached response stands in when the network gives no answer: a fetch
// that threw, or a status saying the server could not serve the document
// now. A cache that cannot be read holds nothing.
export async function networkFirst(load: () => Promise<Response>, fallback: () => Promise<Response | undefined>): Promise<Response> {
  const [outcome] = await Promise.allSettled([load()]);

  if (outcome.status === 'fulfilled' && !noAnswer(outcome.value)) {
    return outcome.value;
  }

  const cached = await fallback().catch(() => undefined);

  if (cached) {
    return cached;
  }

  if (outcome.status === 'fulfilled') {
    return outcome.value;
  }

  throw outcome.reason;
}

// 408 and 429 are the 4xx that mean "not now" rather than "not here"; any
// other 4xx is an answer, so a deleted preview reads as gone rather than as
// the last build cached for it. An opaque redirect has status 0 and is an
// answer too: the browser follows it.
function noAnswer(response: Response): boolean {
  return response.status === 408 || response.status === 429 || response.status >= 500;
}
