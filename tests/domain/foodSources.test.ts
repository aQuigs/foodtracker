import { expect } from '@esm-bundle/chai';
import {
  CATALOG_TIERS, FOOD_SOURCES, FOOD_SOURCE_META, SOURCE_KINDS,
  brandSearchKey, catalogVersions, datasetDir, defaultEnabledSources, isFoodSource, searchText, sourceBrand, sourceLabel, sourceTier,
} from '../../src/domain/foodSources.js';

describe('FOOD_SOURCES registry', () => {
  it('names the curated and full USDA sources', () => {
    expect(FOOD_SOURCES.USDA).to.equal('usda');
    expect(FOOD_SOURCES.USDA_FULL).to.equal('usda-full');
  });

  it('all entries map to unique values', () => {
    const values = Object.values(FOOD_SOURCES);
    expect(new Set(values).size).to.equal(values.length);
    expect(values.length).to.be.greaterThan(0);
  });

  it('describes every source exactly once, in registry order', () => {
    expect(Object.keys(FOOD_SOURCE_META)).to.deep.equal([...Object.values(FOOD_SOURCES)]);
  });

  it('pins a non-empty dataset version and a non-empty label for every source', () => {
    for (const meta of Object.values(FOOD_SOURCE_META)) {
      expect(meta.version).to.not.equal('');
      expect(meta.label).to.not.equal('');
    }
  });

  it('labels are unique so the picker never shows two identical rows', () => {
    const labels = Object.values(FOOD_SOURCE_META).map((m) => m.label);
    expect(new Set(labels).size).to.equal(labels.length);
  });
});

describe('catalogVersions()', () => {
  it('maps every source to its pinned version', () => {
    const versions = catalogVersions();
    expect(Object.keys(versions)).to.deep.equal([...Object.values(FOOD_SOURCES)]);
    expect(versions[FOOD_SOURCES.USDA]).to.equal(FOOD_SOURCE_META[FOOD_SOURCES.USDA].version);
  });
});

describe('defaultEnabledSources()', () => {
  it('turns on both USDA tiers and no pack', () => {
    expect(defaultEnabledSources()).to.deep.equal([FOOD_SOURCES.USDA, FOOD_SOURCES.USDA_FULL]);
  });
});

describe('sourceTier()', () => {
  it('lists the everyday tier flat and everything else behind a fold', () => {
    expect(sourceTier(FOOD_SOURCES.USDA)).to.equal(CATALOG_TIERS.CURATED);
    expect(sourceTier(FOOD_SOURCES.USDA_FULL)).to.equal(CATALOG_TIERS.DEEP);
    expect(sourceTier(FOOD_SOURCES.COSTCO)).to.equal(CATALOG_TIERS.DEEP);
  });

  it('sends a source it has never heard of to the deep tier rather than dropping it', () => {
    expect(sourceTier('pantry')).to.equal(CATALOG_TIERS.DEEP);
  });
});

describe('sourceLabel()', () => {
  it('returns the registry label', () => {
    expect(sourceLabel(FOOD_SOURCES.COSTCO)).to.equal('Costco');
  });

  it('falls back to the raw name for an unknown source', () => {
    expect(sourceLabel('pantry')).to.equal('pantry');
  });
});

describe('isFoodSource()', () => {
  it('accepts registered names and rejects others', () => {
    expect(isFoodSource('usda')).to.equal(true);
    expect(isFoodSource('pantry')).to.equal(false);
    expect(isFoodSource('')).to.equal(false);
  });
});

describe('datasetDir()', () => {
  it('joins source and version as <source>-v<version>', () => {
    expect(datasetDir('usda', '5')).to.equal('usda-v5');
    expect(datasetDir('usda-full', '1')).to.equal('usda-full-v1');
  });
});

describe('SOURCE_KINDS', () => {
  it('gives every registered source a kind', () => {
    for (const meta of Object.values(FOOD_SOURCE_META)) {
      expect(Object.values(SOURCE_KINDS)).to.include(meta.kind);
    }
  });

  it('marks both USDA tiers reference and every pack brand', () => {
    expect(FOOD_SOURCE_META[FOOD_SOURCES.USDA].kind).to.equal(SOURCE_KINDS.REFERENCE);
    expect(FOOD_SOURCE_META[FOOD_SOURCES.USDA_FULL].kind).to.equal(SOURCE_KINDS.REFERENCE);

    const packs = Object.values(FOOD_SOURCES).filter(
      (s) => s !== FOOD_SOURCES.USDA && s !== FOOD_SOURCES.USDA_FULL,
    );
    expect(packs.length).to.be.greaterThan(0);
    for (const source of packs) {
      expect(FOOD_SOURCE_META[source].kind).to.equal(SOURCE_KINDS.BRAND);
    }
  });
});

describe('sourceBrand()', () => {
  it('returns the label for a registered brand source', () => {
    expect(sourceBrand(FOOD_SOURCES.COSTCO)).to.equal('Costco');
  });

  it('returns null for a reference source', () => {
    expect(sourceBrand(FOOD_SOURCES.USDA)).to.equal(null);
  });

  it('returns null for an unregistered source and for undefined', () => {
    expect(sourceBrand('pantry')).to.equal(null);
    expect(sourceBrand(undefined)).to.equal(null);
  });
});

describe('brandSearchKey()', () => {
  it('removes intra-word punctuation before folding, so a typed token survives', () => {
    expect(brandSearchKey(FOOD_SOURCES.SAMS_CLUB)).to.equal('sams club');
    expect(brandSearchKey(FOOD_SOURCES.HEB)).to.equal('heb');
    expect(brandSearchKey(FOOD_SOURCES.TRADER_JOES)).to.equal('trader joes');
    expect(brandSearchKey(FOOD_SOURCES.SAFEWAY)).to.equal('safeway albertsons');
  });

  it('returns null for a reference source, an unregistered one, or undefined', () => {
    expect(brandSearchKey(FOOD_SOURCES.USDA)).to.equal(null);
    expect(brandSearchKey('pantry')).to.equal(null);
    expect(brandSearchKey(undefined)).to.equal(null);
  });
});

describe('searchText()', () => {
  it('appends the brand label for a brand source', () => {
    expect(searchText('Almonds', FOOD_SOURCES.COSTCO)).to.equal('Almonds Costco');
  });

  it('returns the name alone for a reference source or no source', () => {
    expect(searchText('Almonds', FOOD_SOURCES.USDA)).to.equal('Almonds');
    expect(searchText('Almonds')).to.equal('Almonds');
  });
});
