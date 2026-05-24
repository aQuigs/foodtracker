import { expect } from '@esm-bundle/chai';
import { macros, type NutritionFacts } from '../../src/domain/types.js';

describe('macros()', () => {
  it('returns macro-kind nutrients with their values, excluding energy', () => {
    const facts: NutritionFacts = { calories: 250, protein: 10, carbs: 30, fat: 5 };
    expect(macros(facts)).to.deep.equal({ protein: 10, carbs: 30, fat: 5 });
  });

  it('preserves zero values', () => {
    const zeroFat: NutritionFacts = { calories: 100, protein: 25, carbs: 0, fat: 0 };
    expect(macros(zeroFat)).to.deep.equal({ protein: 25, carbs: 0, fat: 0 });
  });
});
