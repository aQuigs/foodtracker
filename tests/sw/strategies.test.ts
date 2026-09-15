import { expect } from '@esm-bundle/chai';
import { fetchWhole, networkFirst } from '../../src/sw/strategies.js';
import type { Fetcher } from '../../src/sw/strategies.js';
import { rejectionOf } from '../promises.js';

const DOC_URL = 'https://app.test/foodtracker/';
const TIMEOUT_MS = 30;

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// A fetch whose headers arrive at once and whose body stalls after the first
// chunk until the request is aborted, the way a real fetch errors its body
// stream on abort.
function stalledBody(): { fetcher: Fetcher; signals: AbortSignal[] } {
  const signals: AbortSignal[] = [];
  const fetcher: Fetcher = async (_url, init) => {
    signals.push(init.signal);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes('<!doctype html>'));
        init.signal.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
      },
    });

    return new Response(body, { status: 200 });
  };

  return { fetcher, signals };
}

function neverAnswers(): { fetcher: Fetcher; signals: AbortSignal[] } {
  const signals: AbortSignal[] = [];
  const fetcher: Fetcher = (_url, init) => {
    signals.push(init.signal);
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  };

  return { fetcher, signals };
}

describe('fetchWhole', () => {
  it('forwards the URL and cache mode, leaves redirects to the browser, and resolves with the response', async () => {
    let seen: { url: string; cache: RequestCache; redirect: RequestRedirect } | null = null;
    const fetcher: Fetcher = async (url, init) => {
      seen = { url, cache: init.cache, redirect: init.redirect };
      return new Response('<!doctype html>', { status: 200 });
    };

    const response = await fetchWhole(DOC_URL, 'no-cache', TIMEOUT_MS, fetcher);

    expect(seen).to.deep.equal({ url: DOC_URL, cache: 'no-cache', redirect: 'manual' });
    expect(await response.text()).to.equal('<!doctype html>');
  });

  it('resolves a response without a body, as an opaque redirect is', async () => {
    // The constructor cannot build a status-0 response; a 204 has the same null body.
    const response = await fetchWhole(DOC_URL, 'default', TIMEOUT_MS, async () => new Response(null, { status: 204 }));

    expect(response.status).to.equal(204);
    expect(response.body).to.equal(null);
  });

  it('rejects and aborts when the headers arrive but the body stalls past the timeout', async () => {
    const { fetcher, signals } = stalledBody();

    await rejectionOf(fetchWhole(DOC_URL, 'default', TIMEOUT_MS, fetcher));

    expect(signals[0]?.aborted).to.equal(true);
  });

  it('rejects and aborts when nothing answers within the timeout', async () => {
    const { fetcher, signals } = neverAnswers();

    await rejectionOf(fetchWhole(DOC_URL, 'default', TIMEOUT_MS, fetcher));

    expect(signals[0]?.aborted).to.equal(true);
  });

  it('does not abort a response that completed in time', async () => {
    const seen: { signal?: AbortSignal } = {};
    const fetcher: Fetcher = async (_url, init) => {
      seen.signal = init.signal;
      return new Response('ok');
    };

    await fetchWhole(DOC_URL, 'default', TIMEOUT_MS, fetcher);
    await new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS * 2));

    expect(seen.signal?.aborted).to.equal(false);
  });
});

describe('networkFirst', () => {
  const fresh = () => Promise.resolve(new Response('fresh'));
  const cached = () => Promise.resolve(new Response('cached'));
  const nothing = () => Promise.resolve(undefined);
  const unreadable = () => Promise.reject(new Error('cache storage failed'));
  const down = () => Promise.reject(new TypeError('Failed to fetch'));
  const unavailable = () => Promise.resolve(new Response('unavailable', { status: 503 }));
  const throttled = () => Promise.resolve(new Response('throttled', { status: 429 }));
  const gone = () => Promise.resolve(new Response('gone', { status: 404 }));
  // The one status-0 response the platform lets a test build; an opaque redirect shares its status.
  const opaque = () => Promise.resolve(Response.error());

  it('returns the network response when it arrives', async () => {
    expect(await (await networkFirst(fresh, cached)).text()).to.equal('fresh');
  });

  it('falls back to the cached response when the network fails', async () => {
    expect(await (await networkFirst(down, cached)).text()).to.equal('cached');
  });

  it('falls back to the cached response when the server answers with an error', async () => {
    expect(await (await networkFirst(unavailable, cached)).text()).to.equal('cached');
  });

  it('falls back to the cached response when the server answers 429', async () => {
    expect(await (await networkFirst(throttled, cached)).text()).to.equal('cached');
  });

  it('returns the server error itself when there is nothing cached', async () => {
    expect((await networkFirst(unavailable, nothing)).status).to.equal(503);
  });

  it('returns the server error itself when the cache cannot be read', async () => {
    expect((await networkFirst(unavailable, unreadable)).status).to.equal(503);
  });

  it('returns a client error as-is even when something is cached', async () => {
    expect(await (await networkFirst(gone, cached)).text()).to.equal('gone');
  });

  it('returns a status-0 response as-is even when something is cached', async () => {
    expect((await networkFirst(opaque, cached)).status).to.equal(0);
  });

  it('rethrows the network error when there is nothing cached', async () => {
    const error = await rejectionOf(networkFirst(down, nothing));

    expect(error).to.be.instanceOf(TypeError);
  });
});
