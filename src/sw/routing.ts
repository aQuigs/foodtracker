// Pure rules the service worker applies; no worker globals so tests can drive them.

// What the build emits and the worker installs: the base path the site is
// served under, every shell URL path (base included) and one hash over their
// contents, so a changed shell is a new worker script and a new cache.
export type ShellManifest = {
  base: string;
  paths: string[];
  hash: string;
};

// The worker's view of its build at runtime: the absolute URL of the scope
// it serves and the absolute URLs (no query or fragment) in its cache.
export type InstalledShell = {
  scope: string;
  precached: ReadonlySet<string>;
};

export type Route = 'shell' | 'precached' | 'network';

type RequestLike = {
  url: string;
  method: string;
  mode: string;
};

// Only the scope's own document falls back to the cached shell. A deeper
// navigation — a PR preview under the site's scope, a dataset opened in a
// tab — passes through, so offline it shows an error rather than another
// build wearing its URL.
export function route(request: RequestLike, shell: InstalledShell): Route {
  if (request.method !== 'GET') {
    return 'network';
  }

  const url = new URL(request.url);
  const target = url.origin + url.pathname;

  if (request.mode === 'navigate' && (target === shell.scope || target === `${shell.scope}index.html`)) {
    return 'shell';
  }

  if (shell.precached.has(target)) {
    return 'precached';
  }

  return 'network';
}

// Named by base path so the site and each PR preview, which share an origin,
// only ever evict their own older builds.
export function cacheName(base: string, hash: string): string {
  return `shell:${base}:${hash}`;
}

export function staleCaches(names: string[], base: string, hash: string): string[] {
  const current = cacheName(base, hash);
  const own = cacheName(base, '');
  return names.filter((name) => name.startsWith(own) && name !== current);
}
