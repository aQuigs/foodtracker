import { expect } from '@esm-bundle/chai';
import { macroDistribution } from '../../src/domain/calc.js';
import type { Totals } from '../../src/domain/types.js';

function totals(kcal: number, protein: number, carbs: number, fat: number): Totals {
  return { kcal, protein, carbs, fat };
}

describe('macroDistribution', () => {
  it('returns all zeros when kcal is 0', () => {
    const result = macroDistribution(totals(0, 0, 0, 0));
    expect(result.protein).to.deep.equal({ percent: 0, calories: 0 });
    expect(result.carbs).to.deep.equal({ percent: 0, calories: 0 });
    expect(result.fat).to.deep.equal({ percent: 0, calories: 0 });
  });

  it('returns all zeros when kcal is 0 even if macro grams are non-zero', () => {
    // Edge: kcal=0 is the sentinel; macro grams are ignored in that case
    const result = macroDistribution(totals(0, 10, 10, 10));
    expect(result.protein).to.deep.equal({ percent: 0, calories: 0 });
    expect(result.carbs).to.deep.equal({ percent: 0, calories: 0 });
    expect(result.fat).to.deep.equal({ percent: 0, calories: 0 });
  });

  it('protein-only day: protein is 100%, carbs and fat are 0%', () => {
    // 50g protein × 4 = 200 cal
    const result = macroDistribution(totals(200, 50, 0, 0));
    expect(result.protein.percent).to.equal(100);
    expect(result.protein.calories).to.equal(200);
    expect(result.carbs.percent).to.equal(0);
    expect(result.carbs.calories).to.equal(0);
    expect(result.fat.percent).to.equal(0);
    expect(result.fat.calories).to.equal(0);
  });

  it('carbs-only day: carbs is 100%, others are 0%', () => {
    // 75g carbs × 4 = 300 cal
    const result = macroDistribution(totals(300, 0, 75, 0));
    expect(result.carbs.percent).to.equal(100);
    expect(result.carbs.calories).to.equal(300);
    expect(result.protein.percent).to.equal(0);
    expect(result.fat.percent).to.equal(0);
  });

  it('fat-only day: fat is 100%, others are 0%', () => {
    // 20g fat × 9 = 180 cal
    const result = macroDistribution(totals(180, 0, 0, 20));
    expect(result.fat.percent).to.equal(100);
    expect(result.fat.calories).to.equal(180);
    expect(result.protein.percent).to.equal(0);
    expect(result.carbs.percent).to.equal(0);
  });

  it('mixed day: percentages are proportional and sum to 100', () => {
    // 30g protein (120 cal), 50g carbs (200 cal), 10g fat (90 cal) → total 410 cal
    const result = macroDistribution(totals(500, 30, 50, 10));
    const total = 120 + 200 + 90; // 410
    expect(result.protein.calories).to.equal(120);
    expect(result.carbs.calories).to.equal(200);
    expect(result.fat.calories).to.equal(90);
    const sum = result.protein.percent + result.carbs.percent + result.fat.percent;
    expect(sum).to.equal(100);
    // Protein: 120/410 ≈ 29.3%
    expect(result.protein.percent).to.be.closeTo(29.3, 0.2);
    // Carbs: 200/410 ≈ 48.8%
    expect(result.carbs.percent).to.be.closeTo(48.8, 0.2);
    // Fat: 90/410 ≈ 22.0%
    expect(result.fat.percent).to.be.closeTo(22.0, 0.2);
  });

  it('percentages always sum to exactly 100.0 (rounding correction applied)', () => {
    // Use values that are likely to produce floating-point rounding drift
    const result = macroDistribution(totals(1000, 33, 33, 11));
    const sum = result.protein.percent + result.carbs.percent + result.fat.percent;
    expect(sum).to.equal(100);
  });

  it('rounding: inputs where raw sum would be 99.9 are corrected to 100.0', () => {
    // Craft macros so that naive rounding gives 99.9%
    // 100g protein (400 cal) + 100g carbs (400 cal) + 33.333...g fat (300 cal) = 1100 cal
    // protein: 400/1100 = 36.363...% → rounds to 36.4%
    // carbs:   400/1100 = 36.363...% → rounds to 36.4%
    // fat:     300/1100 = 27.272...% → rounds to 27.3%
    // Sum: 36.4 + 36.4 + 27.3 = 100.1 → must be corrected to 100.0
    const result = macroDistribution(totals(1200, 100, 100, 100 / 3));
    const sum = result.protein.percent + result.carbs.percent + result.fat.percent;
    expect(sum).to.equal(100);
  });
});
