import { expect } from '@esm-bundle/chai';
import { parsePositive } from '../../src/ui/parsePositive.js';

describe('parsePositive', () => {
  it('parses a positive number, ignoring surrounding whitespace', () => {
    expect(parsePositive('3')).to.equal(3);
    expect(parsePositive(' 2.5 ')).to.equal(2.5);
    expect(parsePositive('1e3')).to.equal(1000);
  });

  it('returns null for blank, zero, negative, non-numeric or infinite text', () => {
    for (const text of ['', '   ', '0', '-1', 'abc', 'Infinity', '1e999']) {
      expect(parsePositive(text), text).to.equal(null);
    }
  });
});
