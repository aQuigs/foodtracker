import { expect } from '@esm-bundle/chai';
import {
  BRANDS_VERSION, CATALOG_TIERS, FOOD_SOURCES, FOOD_SOURCE_META, STORE_BUNDLES,
  brandSource, brandedSearchKey, bundleSources, catalogVersions, datasetDir, defaultEnabledSources, expandLegacySources,
  brandEntry, isFoodSource, labelSearchKey, searchText, sourceLabel, sourceTier, storeBundle,
} from '../../src/domain/foodSources.js';
import type { BrandsIndex } from '../../src/domain/types.js';

describe('FOOD_SOURCES registry', () => {
  it('names exactly the two USDA tiers — every other source is a brand', () => {
    expect(Object.values(FOOD_SOURCES)).to.deep.equal(['usda', 'usda-full']);
  });

  it('describes every source exactly once, in registry order', () => {
    expect(Object.keys(FOOD_SOURCE_META)).to.deep.equal([...Object.values(FOOD_SOURCES)]);
  });

  it('pins a non-empty dataset version and a unique non-empty label for every source', () => {
    const labels = Object.values(FOOD_SOURCE_META).map((m) => m.label);
    for (const meta of Object.values(FOOD_SOURCE_META)) {
      expect(meta.version).to.not.equal('');
      expect(meta.label).to.not.equal('');
    }

    expect(new Set(labels).size).to.equal(labels.length);
  });

  it('pins a version for the brands dataset', () => {
    expect(BRANDS_VERSION).to.not.equal('');
  });
});

describe('catalogVersions()', () => {
  it('maps every static source to its pinned version', () => {
    const versions = catalogVersions();
    expect(Object.keys(versions)).to.deep.equal([...Object.values(FOOD_SOURCES)]);
    expect(versions[FOOD_SOURCES.USDA]).to.equal(FOOD_SOURCE_META[FOOD_SOURCES.USDA].version);
  });
});

describe('defaultEnabledSources()', () => {
  it('turns on both USDA tiers and no brand', () => {
    expect(defaultEnabledSources()).to.deep.equal([FOOD_SOURCES.USDA, FOOD_SOURCES.USDA_FULL]);
  });
});

describe('sourceTier()', () => {
  it('lists the everyday tier flat and everything else — the full tier, a brand, a stranger — behind a fold', () => {
    expect(sourceTier(FOOD_SOURCES.USDA)).to.equal(CATALOG_TIERS.CURATED);
    expect(sourceTier(FOOD_SOURCES.USDA_FULL)).to.equal(CATALOG_TIERS.DEEP);
    expect(sourceTier(brandSource('chobani'))).to.equal(CATALOG_TIERS.DEEP);
    expect(sourceTier('pantry')).to.equal(CATALOG_TIERS.DEEP);
  });
});

describe('sourceLabel()', () => {
  it('returns the registry label and falls back to the raw name for an unknown source', () => {
    expect(sourceLabel(FOOD_SOURCES.USDA)).to.equal('Everyday foods');
    expect(sourceLabel('pantry')).to.equal('pantry');
  });

  it('reads a brand source\'s id as capitalised words, the stand-in until the index names it', () => {
    expect(sourceLabel(brandSource('kirkland-signature'))).to.equal('Kirkland Signature');
    expect(sourceLabel(brandSource('365'))).to.equal('365');
    expect(sourceLabel(brandSource('m-ms'))).to.equal('M Ms');
  });
});

describe('brandEntry()', () => {
  const index: BrandsIndex = {
    source: 'brands', version: '1', generatedAt: '2026-09-15T00:00:00.000Z',
    brands: [['chobani', 'Chobani', 448, 3], ['nature-valley', 'Nature Valley', 460, 0]],
    shards: [{ sha256: 'a', itemCount: 1, bytes: 1 }, { sha256: 'b', itemCount: 1, bytes: 1 }, { sha256: 'c', itemCount: 1, bytes: 1 }, { sha256: 'd', itemCount: 1, bytes: 1 }],
  };

  it('finds an index entry by brand id and is undefined for an id the index lacks', () => {
    expect(brandEntry(index, 'nature-valley')).to.deep.equal(['nature-valley', 'Nature Valley', 460, 0]);
    expect(brandEntry(index, 'oikos')).to.equal(undefined);
  });

  it('answers the same for a second lookup on the same index', () => {
    expect(brandEntry(index, 'chobani')).to.equal(brandEntry(index, 'chobani'));
  });
});

describe('isFoodSource()', () => {
  it('accepts registered names and rejects brands and others', () => {
    expect(isFoodSource('usda')).to.equal(true);
    expect(isFoodSource(brandSource('chobani'))).to.equal(false);
    expect(isFoodSource('')).to.equal(false);
  });
});

describe('datasetDir()', () => {
  it('joins source and version as <source>-v<version>', () => {
    expect(datasetDir('usda', '5')).to.equal('usda-v5');
    expect(datasetDir('brands', '1')).to.equal('brands-v1');
  });
});

describe('STORE_BUNDLES', () => {
  const ids = Object.keys(STORE_BUNDLES);

  it('names a store by an id that is not a static source, with a unique label and at least one brand', () => {
    const labels = ids.map((id) => STORE_BUNDLES[id]!.label);
    expect(ids.length).to.be.greaterThan(0);
    expect(new Set(labels).size).to.equal(labels.length);

    for (const id of ids) {
      expect(isFoodSource(id), id).to.equal(false);
      expect(STORE_BUNDLES[id]!.label).to.not.equal('');
      expect(STORE_BUNDLES[id]!.brands.length, id).to.be.greaterThan(0);
    }
  });

  it('lists brands by their index id — lowercase words joined by hyphens, never a source name', () => {
    for (const id of ids) {
      for (const brand of STORE_BUNDLES[id]!.brands) {
        expect(brand, `${id}: ${brand}`).to.match(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
    }
  });

  it('keeps the house brands the store packs were built from', () => {
    expect(STORE_BUNDLES['costco']!.brands).to.include('kirkland-signature');
    expect(STORE_BUNDLES['walmart']!.brands).to.include('great-value');
    expect(STORE_BUNDLES['target']!.brands).to.include('good-gather');
    expect(STORE_BUNDLES['whole-foods']!.brands).to.include('365-whole-foods-market');
  });
});

describe('storeBundle()', () => {
  it('finds a store by id and is undefined for any other name, including one an object inherits', () => {
    expect(storeBundle('costco')?.label).to.equal('Costco');
    expect(storeBundle('pantry')).to.equal(undefined);
    expect(storeBundle('constructor')).to.equal(undefined);
    expect(storeBundle('__proto__')).to.equal(undefined);
  });

  it('keeps bundleSources() and expandLegacySources() honest about an inherited name in a stored blob', () => {
    expect(bundleSources('constructor')).to.deep.equal([]);
    expect(expandLegacySources(['__proto__', 'toString', 'usda'])).to.deep.equal(['__proto__', 'toString', 'usda']);
  });
});

describe('bundleSources()', () => {
  it('turns a store\'s brand ids into brand sources, in bundle order', () => {
    expect(bundleSources('costco')).to.deep.equal(STORE_BUNDLES['costco']!.brands.map(brandSource));
  });

  it('is empty for a name that is not a store', () => {
    expect(bundleSources('usda')).to.deep.equal([]);
    expect(bundleSources('brand:costco')).to.deep.equal([]);
  });
});

describe('expandLegacySources()', () => {
  it('replaces a store pack name with its bundle\'s brand sources, in place', () => {
    expect(expandLegacySources(['usda', 'costco', 'usda-full']))
      .to.deep.equal(['usda', ...bundleSources('costco'), 'usda-full']);
  });

  it('keeps brand sources, static sources and unknown names as they are', () => {
    const enabled = ['usda', brandSource('chobani'), 'discontinued-source'];
    expect(expandLegacySources(enabled)).to.deep.equal(enabled);
  });

  it('never lists a brand twice when a bundle repeats one already on', () => {
    const kirkland = brandSource('kirkland-signature');
    const out = expandLegacySources([kirkland, 'costco']);
    expect(out.filter((s) => s === kirkland)).to.have.lengthOf(1);
    expect(out[0]).to.equal(kirkland);
  });

  it('returns [] for []', () => {
    expect(expandLegacySources([])).to.deep.equal([]);
  });
});

describe('labelSearchKey()', () => {
  it('removes intra-word punctuation before folding, so a typed token survives', () => {
    expect(labelSearchKey("Sam's Club")).to.equal('sams club');
    expect(labelSearchKey('H-E-B')).to.equal('heb');
    expect(labelSearchKey("Trader Joe's")).to.equal('trader joes');
    expect(labelSearchKey('Safeway & Albertsons')).to.equal('safeway albertsons');
  });
});

describe('brandedSearchKey()', () => {
  it('joins the folded name and the folded brand for a tagged food', () => {
    expect(brandedSearchKey("Sam's Choice cola", "Sam's Club")).to.equal('sam s choice cola sams club');
  });

  it('is the folded name alone without a brand, or with one that folds to nothing', () => {
    expect(brandedSearchKey('Jalapeños (canned)')).to.equal('jalapenos canned');
    expect(brandedSearchKey('Jalapeños (canned)', '™')).to.equal('jalapenos canned');
  });
});

describe('searchText()', () => {
  it('appends the brand for a tagged food and is the name alone otherwise', () => {
    expect(searchText('Almonds', 'Kirkland Signature')).to.equal('Almonds Kirkland Signature');
    expect(searchText('Almonds')).to.equal('Almonds');
    expect(searchText('Almonds', '')).to.equal('Almonds');
  });
});
