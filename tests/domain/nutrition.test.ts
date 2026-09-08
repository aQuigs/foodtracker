import { expect } from '@esm-bundle/chai';
import { macroPctOfCalories, macroSharePct, type NutritionFacts } from '../../src/domain/types.js';

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

describe('macroSharePct()', () => {
  it('normalises each macro over the macro-calorie total, not the stated calorie line', () => {
    const facts: NutritionFacts = { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 };
    expect(macroSharePct(facts)).to.deep.equal({ protein: 4, carbs: 93, fat: 3 });
  });

  it('allocates the rounding remainder so the shares sum to exactly 100', () => {
    const facts: NutritionFacts = { calories: 120, protein: 10, carbs: 10, fat: 4.444 };
    const shares = macroSharePct(facts);
    expect(Object.values(shares).reduce((sum, v) => sum + v, 0)).to.equal(100);
    expect(shares).to.deep.equal({ protein: 34, carbs: 33, fat: 33 });
  });

  it('returns an empty object when no macro contributes calories', () => {
    expect(macroSharePct({ calories: 200, protein: 0, carbs: 0, fat: 0 })).to.deep.equal({});
    expect(macroSharePct({ calories: 200, protein: NaN, carbs: 1, fat: 1 })).to.deep.equal({});
  });
});
