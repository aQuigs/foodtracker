// Keeps the app shell available offline. Navigations go to the network first
// so an online launch always runs the latest deploy, and fall back to the
// cached shell; hashed assets are immutable and come straight from the cache.
// Catalog data under data/ is never cached here: IndexedDB already holds every
// dataset the user has turned on.
import { cacheName, route, staleCaches } from './routing.js';
import type { ShellManifest } from './routing.js';

declare const self: ServiceWorkerGlobalScope;
declare const __SHELL__: ShellManifest;

const SHELL = __SHELL__;
const CACHE = cacheName(self.registration.scope, SHELL.hash);
const PRECACHED = new Set(SHELL.paths.map((path) => new URL(path, self.location.href).href));
const INDEX = new URL('index.html', self.registration.scope).href;
const NETWORK_TIMEOUT_MS = 4000;
// One representation per URL is stored, so a Vary header on the response
// (Origin from a CORS-enabled server, Accept-Encoding from a CDN) must not
// make a page's request miss what the worker's own request stored.
const MATCH: CacheQueryOptions = { ignoreSearch: true, ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(dropStaleCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const kind = route(event.request, PRECACHED);

  if (kind === 'shell') {
    event.respondWith(networkFirst(event.request));
  } else if (kind === 'precached') {
    event.respondWith(cacheFirst(event.request));
  }
});

async function precache(): Promise<void> {
  const cache = await caches.open(CACHE);
  // Revalidate so an index.html the HTTP cache still holds from the previous
  // deploy can never be stored beside this build's assets.
  await cache.addAll(SHELL.paths.map((path) => new Request(path, { cache: 'no-cache' })));
}

async function dropStaleCaches(): Promise<void> {
  const stale = staleCaches(await caches.keys(), self.registration.scope, SHELL.hash);
  await Promise.all(stale.map((name) => caches.delete(name)));
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  return (await cache.match(request, MATCH)) ?? fetch(request);
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    return await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
  } catch (error) {
    const cache = await caches.open(CACHE);
    const shell = await cache.match(INDEX, MATCH);

    if (!shell) {
      throw error;
    }

    return shell;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no response within ${ms}ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
