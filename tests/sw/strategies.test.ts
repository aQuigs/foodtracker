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
  it('resolves with the response once the whole body has arrived, passing the cache mode through', async () => {
    let seen: { url: string; cache: RequestCache } | null = null;
    const fetcher: Fetcher = async (url, init) => {
      seen = { url, cache: init.cache };
      return new Response('<!doctype html>', { status: 200 });
    };

    const response = await fetchWhole(DOC_URL, 'no-cache', TIMEOUT_MS, fetcher);

    expect(seen).to.deep.equal({ url: DOC_URL, cache: 'no-cache' });
    expect(await response.text()).to.equal('<!doctype html>');
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
  const down = () => Promise.reject(new TypeError('Failed to fetch'));

  it('returns the network response when it arrives', async () => {
    expect(await (await networkFirst(fresh, cached)).text()).to.equal('fresh');
  });

  it('falls back to the cached response when the network fails', async () => {
    expect(await (await networkFirst(down, cached)).text()).to.equal('cached');
  });

  it('rethrows the network error when there is nothing cached', async () => {
    const error = await rejectionOf(networkFirst(down, nothing));

    expect(error).to.be.instanceOf(TypeError);
  });
});
