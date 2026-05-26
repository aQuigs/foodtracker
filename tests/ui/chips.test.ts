import { expect } from '@esm-bundle/chai';
import { getChipsForUnit } from '../../src/ui/chips.js';

describe('getChipsForUnit', () => {
  it('returns [50, 100, 150, 200] for g', () => {
    expect(getChipsForUnit('g')).to.deep.equal([50, 100, 150, 200]);
  });

  it('returns [1, 2, 4, 8] for oz', () => {
    expect(getChipsForUnit('oz')).to.deep.equal([1, 2, 4, 8]);
  });

  it('returns [0.25, 0.5, 0.75, 1] for lb', () => {
    expect(getChipsForUnit('lb')).to.deep.equal([0.25, 0.5, 0.75, 1]);
  });

  it('returns [1, 2, 3, 4] for count', () => {
    expect(getChipsForUnit('count')).to.deep.equal([1, 2, 3, 4]);
  });
});
