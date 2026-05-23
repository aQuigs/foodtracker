import { expect } from '@esm-bundle/chai';
import { toGrams, isValidChips } from '../../src/domain/units.js';

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

describe('isValidChips', () => {
  it('null is valid (means use unit defaults)', () => {
    expect(isValidChips(null)).to.equal(true);
  });

  it('a 4-element array of positive finite numbers is valid', () => {
    expect(isValidChips([1, 2, 3, 4])).to.equal(true);
    expect(isValidChips([0.25, 0.5, 0.75, 1])).to.equal(true);
  });

  it('rejects arrays of length other than 4', () => {
    for (const chips of [[], [1], [1, 2, 3], [1, 2, 3, 4, 5]]) {
      expect(isValidChips(chips), `len=${chips.length}`).to.equal(false);
    }
  });

  it('rejects arrays containing non-positive, non-finite, or non-numeric values', () => {
    for (const chips of [[0, 1, 2, 3], [-1, 1, 2, 3], [1, NaN, 2, 3], [1, Infinity, 2, 3], [1, '2' as unknown as number, 3, 4]]) {
      expect(isValidChips(chips), `chips=${JSON.stringify(chips)}`).to.equal(false);
    }
  });

  it('rejects non-array, non-null inputs', () => {
    for (const input of [undefined, 'abc', 42, {}, true]) {
      expect(isValidChips(input), `input=${JSON.stringify(input)}`).to.equal(false);
    }
  });
});

