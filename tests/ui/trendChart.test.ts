import { expect } from '@esm-bundle/chai';
import { chartLayout, niceTicks } from '../../src/ui/trendChart.js';

describe('trend chart geometry', () => {
  it('scales the axis chrome by the box height while it fits the width', () => {
    const l = chartLayout(600, 200, 30);
    expect(l.scale).to.equal(1);
    expect(l.pad.left).to.equal(44);
    expect(l.plotW).to.equal(600 - 44 - 20);
    expect(l.slot).to.be.closeTo(l.plotW / 30, 0.001);
  });

  it('shrinks the chrome rather than inverting the plot when the box is too small for it', () => {
    const l = chartLayout(111, 600, 30);
    expect(l.scale).to.be.below(3);
    expect(l.pad.left + l.pad.right).to.be.at.most(111 / 2);
    expect(l.plotW).to.be.at.least(111 / 2);
    expect(l.plotH).to.be.at.least(600 / 2);
    expect(l.slot).to.be.above(0);
  });

  it('drops to a single x label when the plot has room for one', () => {
    expect(chartLayout(120, 600, 30).labelEvery).to.equal(30);
  });

  it('spaces x labels across a wide plot, never more than six', () => {
    expect(chartLayout(1000, 200, 30).labelEvery).to.equal(5);
    expect(chartLayout(4000, 200, 30).labelEvery).to.equal(5);
  });
});

describe('niceTicks', () => {
  it('starts at zero and reaches the tallest value in a round step', () => {
    expect(niceTicks(178)).to.deep.equal([0, 50, 100, 150, 200]);
  });

  it('keeps at most four intervals however tall the tallest value is', () => {
    for (const max of [178, 2400, 884000, 9e9]) {
      const ticks = niceTicks(max);
      expect(ticks.length, String(max)).to.be.at.most(5);
      expect(ticks[0], String(max)).to.equal(0);
      expect(ticks[ticks.length - 1], String(max)).to.be.at.least(max);
    }
  });

  it('gives a usable axis for a day that logs nothing but zeroes', () => {
    expect(niceTicks(0)).to.deep.equal([0, 50]);
  });
});
