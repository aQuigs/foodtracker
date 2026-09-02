import { expect } from '@esm-bundle/chai';
import { searchKey } from '../../src/domain/searchKey.js';

describe('searchKey()', () => {
  it('lowercases', () => {
    expect(searchKey('Greek Yogurt')).to.equal('greek yogurt');
  });

  it('strips diacritics so a plain keyboard can reach accented names', () => {
    expect(searchKey('Jalapeños (canned)')).to.equal('jalapenos (canned)');
    expect(searchKey('Gruyère cheese')).to.equal('gruyere cheese');
    expect(searchKey('Chicken liver pâté')).to.equal('chicken liver pate');
  });

  it('keeps whitespace and punctuation so tokenising is unaffected', () => {
    expect(searchKey("  Potatoes O'Brien ")).to.equal("  potatoes o'brien ");
  });
});
