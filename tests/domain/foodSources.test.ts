import { expect } from '@esm-bundle/chai';
import { CATALOG_TIERS, CATALOG_VERSIONS, FOOD_SOURCES, SOURCE_TIER, datasetDir, sourceTier } from '../../src/domain/foodSources.js';

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

  it('pins a dataset version for every source', () => {
    expect(Object.keys(CATALOG_VERSIONS).sort()).to.deep.equal([...Object.values(FOOD_SOURCES)].sort());
  });
});

describe('sourceTier()', () => {
  it('classifies every registered source into a catalog tier', () => {
    expect(Object.keys(SOURCE_TIER).sort()).to.deep.equal([...Object.values(FOOD_SOURCES)].sort());
    expect(sourceTier(FOOD_SOURCES.USDA)).to.equal(CATALOG_TIERS.CURATED);
    expect(sourceTier(FOOD_SOURCES.USDA_FULL)).to.equal(CATALOG_TIERS.DEEP);
  });

  it('sends a source it has never heard of to the deep tier rather than dropping it', () => {
    expect(sourceTier('pantry')).to.equal(CATALOG_TIERS.DEEP);
  });
});

describe('datasetDir()', () => {
  it('joins source and version as <source>-v<version>', () => {
    expect(datasetDir('usda', '5')).to.equal('usda-v5');
    expect(datasetDir('usda-full', '1')).to.equal('usda-full-v1');
  });
});
