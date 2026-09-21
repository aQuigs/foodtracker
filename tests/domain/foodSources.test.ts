import { expect } from '@esm-bundle/chai';
import {
  BRAND_SOURCE_PREFIX, CATALOG_TIERS, FOOD_SOURCES, FOOD_SOURCE_META, STORE_BUNDLES,
  brandIdOf, brandSource, brandedSearchKey, defaultEnabledSources, expandStores, houseBrandsAsStores,
  brandDirectory, isFoodSource, isHouseBrand, isStore, labelSearchKey, searchText, sourceLabel, sourceTier,
} from '../../src/domain/foodSources.js';
import type { BrandList } from '../../src/domain/dataFiles.js';

describe('FOOD_SOURCES registry', () => {
  it('names exactly the two USDA tiers — every other source is a brand', () => {
    expect(Object.values(FOOD_SOURCES)).to.deep.equal(['usda', 'usda-full']);
  });

  it('describes every source exactly once, in registry order', () => {
    expect(Object.keys(FOOD_SOURCE_META)).to.deep.equal([...Object.values(FOOD_SOURCES)]);
  });

  it('gives every source a unique non-empty label', () => {
    const labels = Object.values(FOOD_SOURCE_META).map((m) => m.label);
    for (const meta of Object.values(FOOD_SOURCE_META)) {
      expect(meta.label).to.not.equal('');
    }

    expect(new Set(labels).size).to.equal(labels.length);
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

  it('reads a brand source\'s id as capitalised words, the stand-in wherever neither its rows nor the brand list name it', () => {
    expect(sourceLabel(brandSource('kirkland-signature'))).to.equal('Kirkland Signature');
    expect(sourceLabel(brandSource('365'))).to.equal('365');
    expect(sourceLabel(brandSource('m-ms'))).to.equal('M Ms');
  });
});

const LIST: BrandList = {
  brands: [
    ['chobani', 'Chobani', 448, true],
    ['kirkland-signature', 'Kirkland Signature', 900, true],
    ['m-ms', "M&M's", 12, true],
    ['nature-valley', 'Nature Valley', 1, false],
  ],
};

describe('brandDirectory()', () => {
  it('decodes every list row by brand id, in list order', () => {
    const { byId } = brandDirectory(LIST);

    expect([...byId.keys()]).to.deep.equal(['chobani', 'kirkland-signature', 'm-ms', 'nature-valley']);
    expect(byId.get('chobani')).to.deep.equal({ id: 'chobani', label: 'Chobani', count: 448, included: true });
    expect(byId.get('nature-valley')).to.deep.equal({ id: 'nature-valley', label: 'Nature Valley', count: 1, included: false });
    expect(byId.get('oikos')).to.equal(undefined);
  });

  it('lists what a brand search walks — every brand but the house brands, each with the key its label matches on', () => {
    const { byId, searchable } = brandDirectory(LIST);

    expect(searchable.map(({ entry, matchKey }) => [entry.id, matchKey])).to.deep.equal([
      ['chobani', labelSearchKey('Chobani')],
      ['m-ms', labelSearchKey("M&M's")],
      ['nature-valley', labelSearchKey('Nature Valley')],
    ]);
    expect(searchable[0]!.entry).to.equal(byId.get('chobani'));
  });
});

describe('brand source names', () => {
  it('prefixes a brand id and reads it back', () => {
    expect(brandSource('chobani')).to.equal(`${BRAND_SOURCE_PREFIX}chobani`);
    expect(brandIdOf('brand:chobani')).to.equal('chobani');
  });

  it('reads null for a static source, a bare prefix, or an unrelated name', () => {
    expect(brandIdOf('usda')).to.equal(null);
    expect(brandIdOf('brand:')).to.equal(null);
    expect(brandIdOf('brands')).to.equal(null);
  });
});

describe('isFoodSource()', () => {
  it('accepts registered names and rejects brands and others', () => {
    expect(isFoodSource('usda')).to.equal(true);
    expect(isFoodSource(brandSource('chobani'))).to.equal(false);
    expect(isFoodSource('')).to.equal(false);
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

  it('lists brands by their brand id — lowercase words joined by hyphens, never a source name', () => {
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
    for (const name of ['constructor', '__proto__', 'toString']) {
      expect(isStore(name), name).to.equal(false);
      expect(isHouseBrand(name), name).to.equal(false);
    }

    expect(expandStores(['__proto__', 'toString', 'usda'])).to.deep.equal(['__proto__', 'toString', 'usda']);
  });
});

describe('isStore() / isHouseBrand()', () => {
  it('tells a store id and a store\'s house brand from everything else', () => {
    expect(isStore('costco')).to.equal(true);
    expect(isStore('usda')).to.equal(false);
    expect(isStore(brandSource('costco'))).to.equal(false);

    expect(isHouseBrand('kirkland-signature')).to.equal(true);
    expect(isHouseBrand('great-value')).to.equal(true);
    expect(isHouseBrand('chobani')).to.equal(false);
  });
});

describe('expandStores()', () => {
  it('turns a store into its house brands\' sources, in place, and passes everything else through', () => {
    expect(expandStores(['usda', 'costco', brandSource('chobani'), 'discontinued-source']))
      .to.deep.equal(['usda', ...STORE_BUNDLES.get('costco')!.brands.map(brandSource), brandSource('chobani'), 'discontinued-source']);
  });

  it('lists a source once however many names reach it', () => {
    const kirkland = brandSource('kirkland');
    const out = expandStores([kirkland, 'costco', 'costco']);
    expect(out.filter((s) => s === kirkland)).to.have.lengthOf(1);
    expect(out).to.have.lengthOf(STORE_BUNDLES.get('costco')!.brands.length);
  });

  it('returns [] for []', () => {
    expect(expandStores([])).to.deep.equal([]);
  });
});

describe('houseBrandsAsStores()', () => {
  it('turns a house brand on by itself into its store, in place and once', () => {
    expect(houseBrandsAsStores([
      'usda', brandSource('kirkland-signature'), brandSource('chobani'), brandSource('costco'), brandSource('great-value'),
    ])).to.deep.equal(['usda', 'costco', brandSource('chobani'), 'walmart']);
  });

  it('folds a house brand into its store when the store is already on', () => {
    expect(houseBrandsAsStores(['costco', brandSource('kirkland')])).to.deep.equal(['costco']);
  });

  it('leaves stores, other brands, static sources and unknown names as they are', () => {
    const enabled = ['usda', 'target', brandSource('chobani'), brandSource('__proto__'), 'discontinued-source'];
    expect(houseBrandsAsStores(enabled)).to.deep.equal(enabled);
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
