import { expect } from '@esm-bundle/chai';
import {
  BRANDS_VERSION, CATALOG_TIERS, FOOD_SOURCES, FOOD_SOURCE_META, STORE_BUNDLES,
  brandSource, brandedSearchKey, bundleSources, catalogVersions, datasetDir, defaultEnabledSources, expandLegacySources,
  brandEntries, brandEntry, isFoodSource, labelSearchKey, searchText, sourceLabel, sourceTier,
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

  it('names a brand from the index when given one, and falls back for a brand it lacks', () => {
    expect(sourceLabel(brandSource('m-ms'), INDEX)).to.equal("M&M's");
    expect(sourceLabel(brandSource('oikos'), INDEX)).to.equal('Oikos');
    expect(sourceLabel('usda', INDEX)).to.equal('Everyday foods');
  });
});

const INDEX: BrandsIndex = {
  source: 'brands', version: '1', generatedAt: '2026-09-15T00:00:00.000Z',
  brands: [['chobani', 'Chobani', 448, 3], ['m-ms', "M&M's", 12, 1], ['nature-valley', 'Nature Valley', 460, 0]],
  shards: [{ sha256: 'a', itemCount: 1, bytes: 1 }, { sha256: 'b', itemCount: 1, bytes: 1 }, { sha256: 'c', itemCount: 1, bytes: 1 }, { sha256: 'd', itemCount: 1, bytes: 1 }],
};

describe('brandEntry()', () => {
  it('decodes an index row by brand id and is undefined for an id the index lacks', () => {
    expect(brandEntry(INDEX, 'nature-valley')).to.deep.equal({ id: 'nature-valley', label: 'Nature Valley', count: 460, shard: 0 });
    expect(brandEntry(INDEX, 'oikos')).to.equal(undefined);
  });

  it('answers the same object for a second lookup on the same index', () => {
    expect(brandEntry(INDEX, 'chobani')).to.equal(brandEntry(INDEX, 'chobani'));
  });
});

describe('brandEntries()', () => {
  it('lists every row decoded, in index order', () => {
    expect(brandEntries(INDEX).map((e) => e.id)).to.deep.equal(['chobani', 'm-ms', 'nature-valley']);
    expect(brandEntries(INDEX)[1]).to.equal(brandEntry(INDEX, 'm-ms'));
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
  it('names a store by an id that is not a static source, with a unique label and at least one brand', () => {
    const labels = [...STORE_BUNDLES.values()].map((bundle) => bundle.label);
    expect(STORE_BUNDLES.size).to.be.greaterThan(0);
    expect(new Set(labels).size).to.equal(labels.length);

    for (const [id, bundle] of STORE_BUNDLES) {
      expect(isFoodSource(id), id).to.equal(false);
      expect(bundle.label).to.not.equal('');
      expect(bundle.brands.length, id).to.be.greaterThan(0);
    }
  });

  it('lists brands by their index id — lowercase words joined by hyphens, never a source name', () => {
    for (const [id, bundle] of STORE_BUNDLES) {
      for (const brand of bundle.brands) {
        expect(brand, `${id}: ${brand}`).to.match(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
    }
  });

  it('keeps the house brands the store packs were built from', () => {
    expect(STORE_BUNDLES.get('costco')!.brands).to.include('kirkland-signature');
    expect(STORE_BUNDLES.get('walmart')!.brands).to.include('great-value');
    expect(STORE_BUNDLES.get('target')!.brands).to.include('good-gather');
    expect(STORE_BUNDLES.get('whole-foods')!.brands).to.include('365-whole-foods-market');
  });

  it('holds no store under a name an object would inherit, so a stored blob cannot name one', () => {
    expect(STORE_BUNDLES.get('constructor')).to.equal(undefined);
    expect(bundleSources('__proto__')).to.deep.equal([]);
    expect(expandLegacySources(['__proto__', 'toString', 'usda'])).to.deep.equal(['__proto__', 'toString', 'usda']);
  });
});

describe('bundleSources()', () => {
  it('turns a store\'s brand ids into brand sources, in bundle order', () => {
    expect(bundleSources('costco')).to.deep.equal(STORE_BUNDLES.get('costco')!.brands.map(brandSource));
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
