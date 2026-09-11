# 0011 — Offline app shell: a hand-written service worker, network-first navigations

**Date:** 2026-09-10

## Context

The site is already installable — a web manifest and icons ship in `public/`. What an installed app still lacked was the other half of the promise: opened without a network, it showed the browser's error page. Everything the app needs to run is on the device already — user state in localStorage, every catalog source the user has turned on in IndexedDB — except the shell itself: `index.html`, one hashed JS file, one hashed CSS file, the icons and the manifest.

Three properties of the deployment shape the design. The app JS is gated at 100 KB gzipped. PR previews deploy under the same origin as the site (`/foodtracker/pr-previews/pr-N/`), and each push is checked in its preview on the first open. And GitHub Pages serves with a ten-minute HTTP cache lifetime.

## Decision

1. **A hand-written service worker, no workbox.** `src/sw/sw.ts` plus pure rules in `src/sw/routing.ts`, about seventy lines, type-checked under the WebWorker lib in its own tsconfig. A Vite plugin (`scripts/serviceWorkerPlugin.ts`) runs a second, single-file build after the app's and emits `dist/sw.js` with the shell list and a content hash defined as `__SHELL__`.
2. **The shell is index.html, the written bundle, and every top-level file in `public/`.** Source maps are dropped. Nothing under `data/` is ever cached by the worker: IndexedDB is the catalog cache, and the datasets are the large part of the site.
3. **A navigation to the scope's own document is network-first**, with four seconds for the whole document to arrive — a body that stalls after the headers counts as no answer, and the request is aborted — falling back to the cached `index.html`. Any deeper navigation (a PR preview under the site's scope, a dataset opened in a tab) passes through, so offline it shows the browser's error page rather than another build wearing its URL. An online launch always runs the live deploy; a preview shows the push it was opened for. There is no "update available" prompt and no automatic reload.
4. **Precached files are cache-first.** Their names carry their content hash, so a hit can never be stale.
5. **Everything else passes through** — catalog data, cross-origin requests, non-GET methods. The worker does not `respondWith` for them at all.
6. **One cache per build, named by base path:** `shell:<base>:<hash>`. The worker derives its scope, cache name and document URL from the manifest the build wrote, not from the registration, so they cannot disagree with what was built. Activation drops the same base's other builds only, so the site and each preview, sharing one origin, never evict each other's shell. Install is atomic (`addAll`), then `skipWaiting` and `clients.claim`. The build refuses to emit a worker whose shell lacks `index.html` or the app bundle, lists a path twice, or is not a single classic script.
7. **Precache fetches revalidate (`cache: 'no-cache'`)**, so an `index.html` the HTTP cache still holds from the previous deploy can never be stored beside this build's assets. **Cache lookups ignore the query string and `Vary`**: one representation per URL is stored, and a `Vary: Origin` or `Vary: Accept-Encoding` on the stored response must not make the page's request miss what the worker's own request stored.
8. **Only a production build registers the worker.** `npm run dev` has none; a worker in dev would shadow Vite's module server and hot reloads.

## Alternatives considered

- **`vite-plugin-pwa` with workbox** — battle-tested, but around a hundred packages of dev dependencies and a generated worker whose defaults are a cache-first shell with either an automatic reload on update (which discards whatever was being typed) or a prompt to build UI for. The routing here is three rules; owning them is less than configuring them. Rejected.
- **Cache-first shell, updated on the next launch** — the instant open every PWA guide promises, at the cost of running the previous deploy for one launch. The user opens each push in its preview, where that lag reads as "the change did not deploy", and a log kept open all day would lag one deploy behind. Rejected for network-first; the price is one round trip for a 1 KB HTML file per launch, the hashed assets stay cache hits.
- **Stale-while-revalidate for `index.html`** — instant open *and* fresh next time, but the old worker would store a newer `index.html` beside the older build's assets, and an offline launch would then load HTML naming files the cache does not hold. Rejected: `index.html` enters a cache only through that build's own install.
- **Caching `data/` too** — offline coverage for sources not yet turned on, at the cost of duplicating IndexedDB with up to 1.8 MB per source. Rejected.
- **A build timestamp as the cache key** — every deploy would re-download the shell and evict a good cache. Rejected for a content hash: a deploy that changes nothing installs nothing.
- **A "new version, reload?" toast** — extra UI for a lag that network-first already removes. Rejected.

## Consequences

- Offline, the app launches with the last shell that installed; catalog search covers every source already downloaded; turning on a new source offline fails its fetch and shows the existing banner. The very first visit still needs the network — nothing is installed before one successful load.
- Online, every launch runs the live deploy, after at most the four-second timeout on a dead link. A deploy takes effect at the next launch, never mid-session.
- On a connection that is up but stalled, before or during the response, the cached shell appears after four seconds.
- A preview opened for the first time while offline shows the browser's error page, never the site's build; once opened online it has its own worker and its own shell.
- `npm run build` runs a third `tsc` (the worker under the WebWorker lib) and a second `vite build`. `sw.js` and its map sit at the dist root, outside the app JS budget.
- Each closed preview leaves its shell cache behind under its own scope until site data is cleared — a few hundred KB each.
- A new shell file is a file dropped in `public/` at the top level; nothing registers it. A subdirectory under `public/` is deliberately not precached.
- iOS Safari honours `display: standalone` from the manifest, so a home-screen install gets the same worker and the same offline shell.
