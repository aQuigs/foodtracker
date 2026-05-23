import { expect } from '@esm-bundle/chai';
import { defaultClock } from '../src/app.js';

describe('defaultClock', () => {
  it('today() returns a YYYY-MM-DD string', () => {
    expect(defaultClock.today()).to.match(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('today() agrees with the local calendar date', () => {
    const now = new Date();
    const expected = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    expect(defaultClock.today()).to.equal(expected);
  });

  it('newId() returns a non-empty unique string each call', () => {
    const a = defaultClock.newId();
    const b = defaultClock.newId();
    expect(a).to.be.a('string').and.have.length.greaterThan(0);
    expect(a).to.not.equal(b);
  });
});
