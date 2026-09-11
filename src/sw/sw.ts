// Keeps the app shell available offline. The scope's own document goes to
// the network first so an online launch always runs the latest deploy, and
// falls back to the cached shell; hashed assets are immutable and come
// straight from the cache. Catalog data under data/ is never cached here:
// IndexedDB already holds every dataset the user has turned on.
import { cacheName, indexUrl, route, staleCaches } from './routing.js';
import type { InstalledShell, ShellManifest } from './routing.js';
import { fetchWhole, networkFirst } from './strategies.js';

declare const self: ServiceWorkerGlobalScope;
declare const __SHELL__: ShellManifest;

// define() pastes the whole manifest at every __SHELL__; bind it once.
const SHELL = __SHELL__;
const CACHE = cacheName(SHELL.base, SHELL.hash);
// Everything is derived from the build's base, not from registration.scope:
// the two agree only while the worker sits at its default scope, and the
// shell is defined by what was built.
const SCOPE = new URL(SHELL.base, self.location.href).href;
const INDEX = indexUrl(SCOPE);
const INSTALLED: InstalledShell = {
  scope: SCOPE,
  precached: new Set(SHELL.paths.map((path) => new URL(path, self.location.href).href)),
};
const NETWORK_TIMEOUT_MS = 4000;
// One representation per URL is stored, so a Vary header on the response
// (Origin from a CORS-enabled server, Accept-Encoding from a CDN) must not
// make a page's request miss what the worker's own request stored.
const MATCH: MultiCacheQueryOptions = { cacheName: CACHE, ignoreSearch: true, ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(dropStaleCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const kind = route(event.request, INSTALLED);

  if (kind === 'shell') {
    const { url, cache } = event.request;
    event.respondWith(networkFirst(() => fetchWhole(url, cache, NETWORK_TIMEOUT_MS), () => caches.match(INDEX, MATCH)));
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
  const stale = staleCaches(await caches.keys(), SHELL.base, SHELL.hash);
  await Promise.all(stale.map((name) => caches.delete(name)));
}

async function cacheFirst(request: Request): Promise<Response> {
  return (await caches.match(request, MATCH)) ?? fetch(request);
}
