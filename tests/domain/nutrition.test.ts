import { expect } from '@esm-bundle/chai';
import { macros, macroPctOfCalories, type NutritionFacts } from '../../src/domain/types.js';

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

describe('macroPctOfCalories()', () => {
  it('computes Atwater percentages (protein 4, carbs 4, fat 9) over total calories', () => {
    const facts: NutritionFacts = { calories: 425, protein: 25, carbs: 25, fat: 25 };
    const pcts = macroPctOfCalories(facts);
    expect(pcts.protein).to.be.closeTo(23.529, 0.01);
    expect(pcts.carbs).to.be.closeTo(23.529, 0.01);
    expect(pcts.fat).to.be.closeTo(52.941, 0.01);
  });

  it('returns an empty object when calories is zero', () => {
    const facts: NutritionFacts = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    expect(macroPctOfCalories(facts)).to.deep.equal({});
  });

  it('returns an empty object when calories is negative or non-finite', () => {
    expect(macroPctOfCalories({ calories: -1, protein: 1, carbs: 1, fat: 1 })).to.deep.equal({});
    expect(macroPctOfCalories({ calories: NaN, protein: 1, carbs: 1, fat: 1 })).to.deep.equal({});
  });
});
