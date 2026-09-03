import { expect } from '@esm-bundle/chai';
import {
  CATALOG_TIERS, FOOD_SOURCES, FOOD_SOURCE_META,
  catalogVersions, datasetDir, defaultEnabledSources, isFoodSource, sourceLabel, sourceTier,
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
