import { expect } from '@esm-bundle/chai';
import { FOOD_SOURCES, type FoodSourceName } from '../../src/domain/foodSources.js';

describe('FOOD_SOURCES registry', () => {
  it('contains the usda source', () => {
    expect(FOOD_SOURCES.USDA).to.equal('usda');
  });

  it('values are usable as FoodSourceName at the type level', () => {
    const name: FoodSourceName = FOOD_SOURCES.USDA;
    expect(name).to.equal('usda');
  });

  it('all entries map to unique values', () => {
    const values = Object.values(FOOD_SOURCES);
    expect(new Set(values).size).to.equal(values.length);
    expect(values.length).to.be.greaterThan(0);
  });
});
