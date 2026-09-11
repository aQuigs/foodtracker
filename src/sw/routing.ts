// Pure rules the service worker applies; no worker globals so tests can drive them.

// What the build emits and the worker installs: every shell URL path (base
// included) and one hash over their contents, so a changed shell is a new
// worker script and a new cache.
export type ShellManifest = {
  paths: string[];
  hash: string;
};

export type Route = 'shell' | 'precached' | 'network';

type RequestLike = {
  url: string;
  method: string;
  mode: string;
};

// `precached` holds absolute URLs without query or fragment.
export function route(request: RequestLike, precached: ReadonlySet<string>): Route {
  if (request.method !== 'GET') {
    return 'network';
  }

  if (request.mode === 'navigate') {
    return 'shell';
  }

  const url = new URL(request.url);
  if (precached.has(url.origin + url.pathname)) {
    return 'precached';
  }

  return 'network';
}

// Scoped by path so the site and each PR preview, which share an origin,
// only ever evict their own older builds.
export function cacheName(scope: string, hash: string): string {
  return `shell:${new URL(scope).pathname}:${hash}`;
}

export function staleCaches(names: string[], scope: string, hash: string): string[] {
  const current = cacheName(scope, hash);
  const own = cacheName(scope, '');
  return names.filter((name) => name.startsWith(own) && name !== current);
}
