import { expect } from '@esm-bundle/chai';
import { toGrams } from '../../src/domain/units.js';

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

