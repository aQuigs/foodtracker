import { expect } from '@esm-bundle/chai';
import { amountUnitLabel, getChipsForUnit, unitPlural } from '../../src/ui/chips.js';

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

  it('returns [100, 200, 250, 500] for ml', () => {
    expect(getChipsForUnit('ml')).to.deep.equal([100, 200, 250, 500]);
  });

  it('returns [4, 8, 12, 16] for fl oz', () => {
    expect(getChipsForUnit('fl oz')).to.deep.equal([4, 8, 12, 16]);
  });
});

// A screen reader spells fl oz out, the same way oz reads as "ounces".
describe('fl oz naming', () => {
  it('uses "fluid ounce(s)" for the chip row and chip aria-labels', () => {
    expect(unitPlural('fl oz')).to.equal('fluid ounces');
    expect(amountUnitLabel(1, 'fl oz')).to.equal('1 fluid ounce');
    expect(amountUnitLabel(8, 'fl oz')).to.equal('8 fluid ounces');
  });
});
