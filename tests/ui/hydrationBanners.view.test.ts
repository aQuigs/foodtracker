import { expect } from '@esm-bundle/chai';
import { render, type SourceHydration, type ViewModel } from '../../src/ui/view.js';
import { baseVm, makeContainer, noopHandlers } from '../_helpers.js';
import { STORE_BUNDLES, brandDirectory, brandSource } from '../../src/domain/foodSources.js';
import type { Food } from '../../src/domain/types.js';
import { brandRow, fakeBrandList } from '../brandsFakes.js';

const MMS = brandSource('m-ms');
const SAFEWAY_SOURCES = STORE_BUNDLES.get('safeway')!.brands.map(brandSource);

function each(sources: string[], status: SourceHydration): Record<string, SourceHydration> {
  return Object.fromEntries(sources.map((source) => [source, status]));
}

function banners(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-testid="hydration-banner"]')];
}

function errors(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-testid="hydration-error"]')];
}

describe('view — hydration banners', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  describe('a brand', () => {
    const downloading: ViewModel = { ...baseVm, enabledSources: [...baseVm.enabledSources, MMS], hydration: { sources: { [MMS]: { kind: 'fetching', loaded: 51200 } } } };

    it('reads the brand list\'s label once the list is loaded', () => {
      render(container, {
        ...downloading,
        brandList: { kind: 'ready', brands: brandDirectory(fakeBrandList([{ id: 'm-ms', label: "M&M's", rows: [] }])) },
      }, noopHandlers);

      expect(banners(container).map((b) => b.textContent)).to.deep.equal(["M&M's: downloading… 50 KB"]);
      expect(banners(container)[0]!.getAttribute('data-source')).to.equal(MMS);
    });

    it('reads the label its rows carry while the list is not loaded: a catalog hit\'s, or a food added from one', () => {
      const row = brandRow('m-ms', "M&M's", '1', 'Peanut');
      render(container, {
        ...downloading,
        catalogHits: { query: 'peanut', rows: [{ food: row, tier: 0, indices: [], brandIndices: [] }], alreadyAdded: 0 },
      }, noopHandlers);
      expect(banners(container)[0]!.textContent).to.equal("M&M's: downloading… 50 KB");

      const added: Food = { ...row, createdAt: '2026-01-01T00:00:00.000Z', deletedAt: null };
      render(container, { ...downloading, state: { ...baseVm.state, foods: [...baseVm.state.foods, added] } }, noopHandlers);
      expect(banners(container)[0]!.textContent).to.equal("M&M's: downloading… 50 KB");
    });

    it('reads its id as words with neither at hand', () => {
      render(container, downloading, noopHandlers);

      expect(banners(container)[0]!.textContent).to.equal('M Ms: downloading… 50 KB');
    });
  });

  describe('a store', () => {
    const on = [...baseVm.enabledSources, 'safeway'];

    it('downloads behind one line under its own label, its house brands\' bytes summed', () => {
      render(container, {
        ...baseVm,
        enabledSources: on,
        hydration: { sources: {
          [SAFEWAY_SOURCES[0]!]: { kind: 'fetching', loaded: 10240 },
          [SAFEWAY_SOURCES[1]!]: { kind: 'fetching', loaded: 20480 },
          [SAFEWAY_SOURCES[2]!]: { kind: 'fetching', loaded: 0 },
        } },
      }, noopHandlers);

      expect(banners(container).map((b) => b.textContent)).to.deep.equal(['Safeway & Albertsons: downloading… 30 KB']);
      expect(banners(container)[0]!.getAttribute('data-source')).to.equal('safeway');
    });

    it('fails with one alert under its own label, not one per house brand', () => {
      render(container, {
        ...baseVm,
        enabledSources: on,
        hydration: { sources: each(SAFEWAY_SOURCES, { kind: 'failed', cachedVersion: null, message: 'HTTP 503' }) },
      }, noopHandlers);

      expect(container.querySelectorAll('[role="alert"]')).to.have.lengthOf(1);
      const [error] = errors(container);
      expect(error!.textContent).to.equal("Safeway & Albertsons: couldn't load. Reload to retry.");
      expect(error!.getAttribute('data-source')).to.equal('safeway');
      expect(error!.getAttribute('title')).to.equal('HTTP 503');
    });

    it('offers the cached copy only when every house brand that failed has one', () => {
      const cached: SourceHydration = { kind: 'failed', cachedVersion: 'v0', message: 'offline' };
      const vm = { ...baseVm, enabledSources: on };

      render(container, { ...vm, hydration: { sources: each(SAFEWAY_SOURCES, cached) } }, noopHandlers);
      expect(errors(container).map((e) => e.textContent)).to.deep.equal(["Safeway & Albertsons: couldn't update. Using the cached copy."]);

      render(container, { ...vm, hydration: { sources: {
        ...each(SAFEWAY_SOURCES, cached),
        [SAFEWAY_SOURCES[0]!]: { kind: 'failed', cachedVersion: null, message: 'HTTP 404' },
      } } }, noopHandlers);
      expect(errors(container).map((e) => e.textContent)).to.deep.equal(["Safeway & Albertsons: couldn't load. Reload to retry."]);
      expect(errors(container)[0]!.getAttribute('title')).to.equal('HTTP 404\noffline');
    });

    it('shows one line of each while some house brands still download and others have failed', () => {
      render(container, {
        ...baseVm,
        enabledSources: on,
        hydration: { sources: {
          ...each(SAFEWAY_SOURCES.slice(1), { kind: 'failed', cachedVersion: null, message: 'HTTP 503' }),
          [SAFEWAY_SOURCES[0]!]: { kind: 'fetching', loaded: 2048 },
        } },
      }, noopHandlers);

      expect(banners(container).map((b) => b.textContent)).to.deep.equal(['Safeway & Albertsons: downloading… 2 KB']);
      expect(errors(container).map((e) => e.textContent)).to.deep.equal(["Safeway & Albertsons: couldn't load. Reload to retry."]);
    });
  });

  it('folds several picks downloading at once into one line, counting picks and summing bytes, and keeps each failure on its own line', () => {
    const costco = STORE_BUNDLES.get('costco')!.brands.map(brandSource);
    render(container, {
      ...baseVm,
      enabledSources: [...baseVm.enabledSources, 'costco', brandSource('chobani')],
      hydration: { sources: {
        ...each(costco, { kind: 'fetching', loaded: 10240 }),
        [brandSource('chobani')]: { kind: 'fetching', loaded: 20480 },
        usda: { kind: 'failed', cachedVersion: null, message: 'boom' },
      } },
    }, noopHandlers);

    expect(banners(container).map((b) => b.textContent)).to.deep.equal(['2 sources: downloading… 50 KB']);
    expect(banners(container)[0]!.getAttribute('data-sources')).to.equal('2');
    expect(banners(container)[0]!.hasAttribute('data-source')).to.equal(false);

    expect(errors(container).map((e) => e.textContent)).to.deep.equal(["Everyday foods: couldn't load. Reload to retry."]);
    expect(errors(container)[0]!.getAttribute('title')).to.equal('boom');
  });

  it('shows nothing for a source no pick that is on reaches, whatever its download does', () => {
    render(container, {
      ...baseVm,
      hydration: { sources: {
        [MMS]: { kind: 'fetching', loaded: 51200 },
        [SAFEWAY_SOURCES[0]!]: { kind: 'failed', cachedVersion: null, message: 'HTTP 503' },
      } },
    }, noopHandlers);

    expect(banners(container)).to.have.lengthOf(0);
    expect(errors(container)).to.have.lengthOf(0);
  });

  it('offers a cached copy on a failed update without naming its build', () => {
    render(container, {
      ...baseVm,
      hydration: { sources: { usda: { kind: 'failed', cachedVersion: '30a277f32682', message: 'offline' } } },
    }, noopHandlers);

    expect(errors(container)[0]!.textContent).to.equal("Everyday foods: couldn't update. Using the cached copy.");
  });
});
