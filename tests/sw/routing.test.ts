import { expect } from '@esm-bundle/chai';
import { cacheName, route, staleCaches } from '../../src/sw/routing.js';

const ORIGIN = 'https://app.test';
const SCOPE = `${ORIGIN}/foodtracker/`;
const SHELL = new Set([
  `${ORIGIN}/foodtracker/index.html`,
  `${ORIGIN}/foodtracker/assets/index-abc123.js`,
  `${ORIGIN}/foodtracker/icon-192.png`,
]);

function request(url: string, opts: { method?: string; mode?: string } = {}) {
  return { url, method: opts.method ?? 'GET', mode: opts.mode ?? 'cors' };
}

describe('service worker routing', () => {
  it('serves a navigation from the shell', () => {
    expect(route(request(`${ORIGIN}/foodtracker/`, { mode: 'navigate' }), SHELL)).to.equal('shell');
    expect(route(request(`${ORIGIN}/foodtracker/?utm=1#log`, { mode: 'navigate' }), SHELL)).to.equal('shell');
  });

  it('serves a precached file from the cache, ignoring the query string', () => {
    expect(route(request(`${ORIGIN}/foodtracker/assets/index-abc123.js`), SHELL)).to.equal('precached');
    expect(route(request(`${ORIGIN}/foodtracker/icon-192.png?v=2`), SHELL)).to.equal('precached');
  });

  it('a navigation to index.html itself is a navigation, not a cache hit', () => {
    expect(route(request(`${ORIGIN}/foodtracker/index.html`, { mode: 'navigate' }), SHELL)).to.equal('shell');
  });

  it('leaves everything else to the network', () => {
    expect(route(request(`${ORIGIN}/foodtracker/data/usda-v6/foods.json`), SHELL)).to.equal('network');
    expect(route(request(`${ORIGIN}/foodtracker/assets/index-other.js`), SHELL)).to.equal('network');
    expect(route(request(`https://elsewhere.test/foodtracker/icon-192.png`), SHELL)).to.equal('network');
  });

  it('never answers a non-GET request', () => {
    expect(route(request(`${ORIGIN}/foodtracker/`, { mode: 'navigate', method: 'POST' }), SHELL)).to.equal('network');
    expect(route(request(`${ORIGIN}/foodtracker/icon-192.png`, { method: 'HEAD' }), SHELL)).to.equal('network');
  });
});

describe('service worker cache names', () => {
  it('names a cache by scope path and build hash', () => {
    expect(cacheName(SCOPE, 'abcd1234')).to.equal('shell:/foodtracker/:abcd1234');
  });

  it('marks stale only the other builds of the same scope', () => {
    const names = [
      'shell:/foodtracker/:old1',
      'shell:/foodtracker/:old2',
      cacheName(SCOPE, 'current'),
      'shell:/foodtracker/pr-previews/pr-3/:other',
      'shell:/:root',
      'unrelated',
    ];

    expect(staleCaches(names, SCOPE, 'current')).to.deep.equal(['shell:/foodtracker/:old1', 'shell:/foodtracker/:old2']);
  });

  it('a root scope does not claim every deeper scope as its own', () => {
    const names = ['shell:/:old', 'shell:/foodtracker/:other', 'shell:/:current'];

    expect(staleCaches(names, `${ORIGIN}/`, 'current')).to.deep.equal(['shell:/:old']);
  });
});
