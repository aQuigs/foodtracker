import { expect } from '@esm-bundle/chai';
import { formatServings } from '../../src/ui/formatServings.js';

describe('formatServings', () => {
  it('keeps whole numbers whole', () => {
    expect(formatServings(2)).to.equal('2');
  });

  it('keeps up to two decimals', () => {
    expect(formatServings(2.5)).to.equal('2.5');
    expect(formatServings(2.125)).to.equal('2.13');
  });

  it('collapses float noise', () => {
    expect(formatServings(1.999999999999)).to.equal('2');
    expect(formatServings(1.004)).to.equal('1');
  });
});
