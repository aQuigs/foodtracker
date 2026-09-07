import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { loadStyles } from '../_helpers.js';

describe('layout test plumbing', () => {
  before(loadStyles);
  before(() => setViewport({ width: 375, height: 800 }));

  it('runs at phone width with the real stylesheet applied', () => {
    expect(window.innerWidth).to.equal(375);
    expect(getComputedStyle(document.body).paddingLeft).to.equal('32px');
  });
});
