import { expect } from '@esm-bundle/chai';
import { cacheName, route, staleCaches } from '../../src/sw/routing.js';
import type { InstalledShell } from '../../src/sw/routing.js';

const ORIGIN = 'https://app.test';
const BASE = '/foodtracker/';
const SHELL: InstalledShell = {
  scope: `${ORIGIN}${BASE}`,
  precached: new Set([
    `${ORIGIN}/foodtracker/index.html`,
    `${ORIGIN}/foodtracker/assets/index-abc123.js`,
    `${ORIGIN}/foodtracker/icon-192.png`,
  ]),
};

function request(url: string, opts: { method?: string; mode?: string } = {}) {
  return { url, method: opts.method ?? 'GET', mode: opts.mode ?? 'cors' };
}

function navigation(url: string) {
  return request(url, { mode: 'navigate' });
}

describe('service worker routing', () => {
  it('serves a navigation to the scope itself from the shell', () => {
    expect(route(navigation(`${ORIGIN}/foodtracker/`), SHELL)).to.equal('shell');
    expect(route(navigation(`${ORIGIN}/foodtracker/?utm=1#log`), SHELL)).to.equal('shell');
    expect(route(navigation(`${ORIGIN}/foodtracker/index.html`), SHELL)).to.equal('shell');
  });

  it('passes a navigation deeper than the scope through to the network', () => {
    expect(route(navigation(`${ORIGIN}/foodtracker/pr-previews/pr-3/`), SHELL)).to.equal('network');
    expect(route(navigation(`${ORIGIN}/foodtracker/pr-previews/pr-3/index.html`), SHELL)).to.equal('network');
    expect(route(navigation(`${ORIGIN}/foodtracker/data/usda-v6/foods.json`), SHELL)).to.equal('network');
    expect(route(navigation(`${ORIGIN}/foodtracker/assets/index-other.js`), SHELL)).to.equal('network');
  });

  it('serves a precached file from the cache, ignoring the query string', () => {
    expect(route(request(`${ORIGIN}/foodtracker/assets/index-abc123.js`), SHELL)).to.equal('precached');
    expect(route(request(`${ORIGIN}/foodtracker/icon-192.png?v=2`), SHELL)).to.equal('precached');
    expect(route(navigation(`${ORIGIN}/foodtracker/icon-192.png`), SHELL)).to.equal('precached');
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
  it('names a cache by base path and build hash', () => {
    expect(cacheName(BASE, 'abcd1234')).to.equal('shell:/foodtracker/:abcd1234');
  });

  it('marks stale only the other builds of the same base', () => {
    const names = [
      'shell:/foodtracker/:old1',
      'shell:/foodtracker/:old2',
      cacheName(BASE, 'current'),
      'shell:/foodtracker/pr-previews/pr-3/:other',
      'shell:/:root',
      'unrelated',
    ];

    expect(staleCaches(names, BASE, 'current')).to.deep.equal(['shell:/foodtracker/:old1', 'shell:/foodtracker/:old2']);
  });

  it('a root base does not claim every deeper base as its own', () => {
    const names = ['shell:/:old', 'shell:/foodtracker/:other', 'shell:/:current'];

    expect(staleCaches(names, '/', 'current')).to.deep.equal(['shell:/:old']);
  });
});
