import { expect } from '@esm-bundle/chai';
import { compatibleUnits, defaultPortion, defaultUnit, entryServings, sameAxis, servingsFor, toGrams } from '../../src/domain/units.js';
import type { Entry, Food, Pieces, Unit } from '../../src/domain/types.js';

const food = (servingUnit: Unit, servingSize = 100, pieces?: Pieces): Food => ({
  id: 'f', name: 'F',
  nutritionFacts: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  servingSize, servingUnit,
  createdAt: 'x', deletedAt: null,
  ...(pieces === undefined ? {} : { pieces }),
});

const entry = (amount: number, unit: Unit, foodId = 'f'): Entry => ({
  id: 'e', date: '2026-05-23', foodId, amount, unit, loggedAt: '2026-05-23T10:00:00Z',
});

describe('toGrams', () => {
  it('returns the same number for grams', () => {
    expect(toGrams(150, 'g')).to.equal(150);
  });

  it('converts ounces to grams (1 oz = 28.3495 g)', () => {
    expect(toGrams(1, 'oz')).to.be.closeTo(28.3495, 1e-4);
    expect(toGrams(4, 'oz')).to.be.closeTo(113.398, 1e-3);
  });

  it('converts pounds to grams (1 lb = 453.592 g)', () => {
    expect(toGrams(1, 'lb')).to.be.closeTo(453.592, 1e-3);
    expect(toGrams(0.25, 'lb')).to.be.closeTo(113.398, 1e-3);
  });

  it('returns null for count (count has no fixed weight)', () => {
    expect(toGrams(2, 'count')).to.equal(null);
  });
});

describe('compatibleUnits', () => {
  it('returns weight units when servingUnit is g/oz/lb', () => {
    for (const u of ['g', 'oz', 'lb'] as const) {
      expect(compatibleUnits(food(u))).to.deep.equal(['g', 'oz', 'lb']);
    }
  });

  it('returns [count] only when servingUnit is count', () => {
    expect(compatibleUnits(food('count', 1))).to.deep.equal(['count']);
  });
});

describe('entryServings', () => {
  it('divides amount by servingSize when units match (count)', () => {
    expect(entryServings(entry(2, 'count'), food('count', 1))).to.equal(2);
    expect(entryServings(entry(3, 'count'), food('count', 2))).to.equal(1.5);
  });

  it('divides amount by servingSize when units match (g)', () => {
    expect(entryServings(entry(150, 'g'), food('g', 100))).to.equal(1.5);
  });

  it('converts both sides to grams when units differ but both are weight', () => {
    // 1 oz vs 100g serving: 28.3495g / 100g ≈ 0.283
    const s = entryServings(entry(1, 'oz'), food('g', 100));
    expect(s).to.not.equal(null);
    expect(s!).to.be.closeTo(0.283495, 1e-5);
  });

  it('returns null when count entry meets non-count serving (no weight bridge)', () => {
    expect(entryServings(entry(2, 'count'), food('g', 100))).to.equal(null);
  });

  it('returns null when weight entry meets count serving', () => {
    expect(entryServings(entry(100, 'g'), food('count', 1))).to.equal(null);
  });
});

describe('volume units', () => {
  it('returns [ml] only when servingUnit is ml', () => {
    expect(compatibleUnits(food('ml', 100))).to.deep.equal(['ml']);
  });

  it('returns null for ml (volume has no fixed weight)', () => {
    expect(toGrams(100, 'ml')).to.equal(null);
  });

  it('divides amount by servingSize when units match (ml)', () => {
    expect(entryServings(entry(200, 'ml'), food('ml', 100))).to.equal(2);
  });

  it('returns null when a weight entry meets a volume serving', () => {
    expect(entryServings(entry(100, 'g'), food('ml', 100))).to.equal(null);
  });

  it('returns null when a volume entry meets a weight serving', () => {
    expect(entryServings(entry(100, 'ml'), food('g', 100))).to.equal(null);
  });
});

describe('compatibleUnits with pieces', () => {
  it('adds count to a weight or volume food that has pieces, keeping UNITS order', () => {
    expect(compatibleUnits(food('g', 30, { perServing: 8, noun: 'cookies' }))).to.deep.equal(['g', 'oz', 'lb', 'count']);
    expect(compatibleUnits(food('ml', 296, { perServing: 1, noun: 'bottle' }))).to.deep.equal(['count', 'ml']);
  });
});

describe('defaultUnit', () => {
  it('is the first unit on the food\'s own axis when it has no pieces', () => {
    expect(defaultUnit(food('oz'))).to.equal('g');
    expect(defaultUnit(food('lb'))).to.equal('g');
    expect(defaultUnit(food('ml'))).to.equal('ml');
    expect(defaultUnit(food('count', 1))).to.equal('count');
  });

  it('is count when the food has pieces, regardless of its own axis', () => {
    expect(defaultUnit(food('g', 30, { perServing: 8, noun: 'cookies' }))).to.equal('count');
    expect(defaultUnit(food('ml', 296, { perServing: 1, noun: 'bottle' }))).to.equal('count');
  });
});

describe('servingsFor with pieces', () => {
  it('divides a count amount by pieces.perServing, and still converts the food\'s own unit', () => {
    const cookies = food('g', 30, { perServing: 8, noun: 'cookies' });
    expect(servingsFor(4, 'count', cookies)).to.equal(0.5);
    expect(servingsFor(60, 'g', cookies)).to.equal(2);
  });
});

describe('defaultPortion', () => {
  it('is one serving, in the food\'s own unit, when it has no pieces', () => {
    expect(defaultPortion(food('oz', 8))).to.deep.equal({ amount: 8, unit: 'oz' });
  });

  it('is pieces.perServing in count when the food has pieces', () => {
    const cookies = food('g', 30, { perServing: 8, noun: 'cookies' });
    expect(defaultPortion(cookies)).to.deep.equal({ amount: 8, unit: 'count' });
  });
});

describe('sameAxis', () => {
  it('is true for two units on one axis', () => {
    expect(sameAxis('g', 'lb')).to.equal(true);
    expect(sameAxis('ml', 'ml')).to.equal(true);
  });

  it('is false across axes', () => {
    expect(sameAxis('g', 'ml')).to.equal(false);
    expect(sameAxis('count', 'g')).to.equal(false);
  });
});
