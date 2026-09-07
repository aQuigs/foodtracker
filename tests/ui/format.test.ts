import { expect } from '@esm-bundle/chai';
import { formatInteger, roundedCalories } from '../../src/ui/format.js';

describe('integer formatting', () => {
  it('groups thousands in a calorie figure', () => {
    expect(roundedCalories(2137.4)).to.equal('2,137 cal');
  });

  it('groups every thousands boundary of a large integer', () => {
    expect(formatInteger(999999000105)).to.equal('999,999,000,105');
  });
});
