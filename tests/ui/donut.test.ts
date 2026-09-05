import { expect } from '@esm-bundle/chai';
import { donutSlices } from '../../src/ui/donut.js';
import { MACRO_KEYS } from '../../src/domain/types.js';
import { sharesOf } from '../_helpers.js';

const TOP_TO_BOTTOM = 'M 50.000 4.000 A 46 46 0 0 1 50.000 96.000 L 50.000 76.000 A 26 26 0 0 0 50.000 24.000 Z';
const BOTTOM_TO_TOP = 'M 50.000 96.000 A 46 46 0 0 1 50.000 4.000 L 50.000 24.000 A 26 26 0 0 0 50.000 76.000 Z';

describe('donutSlices', () => {
  it('returns no slices when nothing was logged', () => {
    expect(donutSlices(sharesOf(0, 0, 0))).to.deep.equal([]);
  });

  it('returns one slice per macro, in macro order', () => {
    expect(donutSlices(sharesOf(50, 50, 0)).map((s) => s.key)).to.deep.equal(MACRO_KEYS);
  });

  it('lays slices clockwise from the top, each spanning its share, and leaves a zero share empty', () => {
    expect(donutSlices(sharesOf(50, 50, 0)).map((s) => s.d)).to.deep.equal([TOP_TO_BOTTOM, BOTTOM_TO_TOP, '']);
  });

  it('scales shares to whatever they sum to, since macro percentages of calories rarely total 100', () => {
    expect(donutSlices(sharesOf(60, 60, 0)).map((s) => s.d)).to.deep.equal([TOP_TO_BOTTOM, BOTTOM_TO_TOP, '']);
  });

  it('takes the long way round for a share past half the ring', () => {
    expect(donutSlices(sharesOf(75, 25, 0)).map((s) => s.d)).to.deep.equal([
      'M 50.000 4.000 A 46 46 0 1 1 4.000 50.000 L 24.000 50.000 A 26 26 0 1 0 50.000 24.000 Z',
      'M 4.000 50.000 A 46 46 0 0 1 50.000 4.000 L 50.000 24.000 A 26 26 0 0 0 24.000 50.000 Z',
      '',
    ]);
  });

  it('draws a single macro as a full ring in two halves, since one arc cannot close on itself', () => {
    expect(donutSlices(sharesOf(100, 0, 0)).map((s) => s.d)).to.deep.equal([`${TOP_TO_BOTTOM} ${BOTTOM_TO_TOP}`, '', '']);
  });
});
