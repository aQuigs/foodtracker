import { expect } from '@esm-bundle/chai';
import { compatibleUnits, toGrams } from '../../src/domain/units.js';
import type { Food } from '../../src/domain/types.js';

const food = (primaryUnit: Food['primaryUnit'], weightPerUnit = 100): Food => ({
  id: 'f', name: 'F',
  nutritionFacts: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  primaryUnit, weightPerUnit,
  createdAt: 'x', deletedAt: null,
});

describe('toGrams', () => {
  it('returns the same number for grams', () => {
    expect(toGrams(150, 'g', 100)).to.equal(150);
  });

  it('converts ounces to grams (1 oz = 28.3495 g)', () => {
    expect(toGrams(1, 'oz', 100)).to.be.closeTo(28.3495, 1e-4);
    expect(toGrams(4, 'oz', 100)).to.be.closeTo(113.398, 1e-3);
  });

  it('converts pounds to grams (1 lb = 453.592 g)', () => {
    expect(toGrams(1, 'lb', 100)).to.be.closeTo(453.592, 1e-3);
    expect(toGrams(0.25, 'lb', 100)).to.be.closeTo(113.398, 1e-3);
  });

  it('count multiplies amount by weightPerUnit', () => {
    expect(toGrams(2, 'count', 50)).to.equal(100);
    expect(toGrams(1, 'count', 150)).to.equal(150);
  });

  it('ignores weightPerUnit for non-count units', () => {
    expect(toGrams(100, 'g', 999)).to.equal(100);
    expect(toGrams(1, 'lb', 999)).to.be.closeTo(453.592, 1e-3);
  });
});

describe('compatibleUnits', () => {
  it('returns weight units (no count) when primaryUnit is g/oz/lb', () => {
    for (const u of ['g', 'oz', 'lb'] as const) {
      expect(compatibleUnits(food(u))).to.deep.equal(['g', 'oz', 'lb']);
    }
  });

  it('returns [count, g] when primaryUnit is count', () => {
    expect(compatibleUnits(food('count', 50))).to.deep.equal(['count', 'g']);
  });
});
