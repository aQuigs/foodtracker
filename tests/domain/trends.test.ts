import { expect } from '@esm-bundle/chai';
import { totalsByDate } from '../../src/domain/calc.js';
import { shiftDate } from '../../src/domain/date.js';
import { TREND_RANGES, TREND_RANGE_KEYS, trendData } from '../../src/domain/trends.js';
import { entryOn as entry, seedTestState, stateWithEntries as stateWith } from '../_helpers.js';

const TODAY = '2026-03-03';
const BANANA_CAL = 89;

describe('totalsByDate', () => {
  it('lists only dates that have an entry, summed per date', () => {
    const state = stateWith([entry('a', '2026-03-01'), entry('b', '2026-03-01', 200), entry('c', TODAY)]);
    const totals = totalsByDate(state, '2026-02-01', TODAY);
    expect([...totals.keys()]).to.have.members(['2026-03-01', TODAY]);
    expect(totals.get('2026-03-01')!.calories).to.be.closeTo(BANANA_CAL * 3, 1e-9);
  });

  it('bounds are inclusive and entries outside them are ignored', () => {
    const state = stateWith([entry('a', '2026-02-27'), entry('b', '2026-02-28'), entry('c', TODAY), entry('d', '2026-03-04')]);
    const totals = totalsByDate(state, '2026-02-28', TODAY);
    expect([...totals.keys()]).to.have.members(['2026-02-28', TODAY]);
  });
});

describe('trendData buckets', () => {
  it('week: seven day buckets, oldest first, tiling up to today across a month end', () => {
    const series = trendData(stateWith([]), TODAY, 'week').buckets;
    expect(series.map((b) => b.start)).to.deep.equal([
      '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02', '2026-03-03',
    ]);
    expect(series.every((b) => b.start === b.end)).to.equal(true);
  });

  it('tiles across a daylight-saving change without dropping or repeating a day', () => {
    const afterSpringForward = '2026-03-10';
    const series = trendData(stateWith([]), afterSpringForward, 'week').buckets;
    expect(series.map((b) => b.start)).to.deep.equal([
      '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10',
    ]);
  });

  for (const key of TREND_RANGE_KEYS) {
    it(`${key}: buckets tile exactly, span bucketDays each, and the last ends on today`, () => {
      const range = TREND_RANGES[key];
      const series = trendData(stateWith([]), TODAY, key).buckets;
      expect(series.length).to.equal(range.buckets);
      expect(series[series.length - 1]!.end).to.equal(TODAY);
      expect(series[0]!.start).to.equal(shiftDate(TODAY, -(range.buckets * range.bucketDays - 1)));

      for (let i = 0; i < series.length; i++) {
        expect(series[i]!.end).to.equal(shiftDate(series[i]!.start, range.bucketDays - 1));
        if (i > 0) {
          expect(series[i]!.start).to.equal(shiftDate(series[i - 1]!.end, 1));
        }
      }
    });
  }

  it('a bucket with no logged day is a gap: null perDay, zero loggedDays', () => {
    const series = trendData(stateWith([entry('a', TODAY)]), TODAY, 'week').buckets;
    expect(series.slice(0, 6).every((b) => b.perDay === null && b.loggedDays === 0)).to.equal(true);
    expect(series[6]!.loggedDays).to.equal(1);
    expect(series[6]!.perDay!.calories).to.be.closeTo(BANANA_CAL, 1e-9);
  });

  it('a day bucket sums every entry on that day', () => {
    const series = trendData(stateWith([entry('a', TODAY, 100), entry('b', TODAY, 200)]), TODAY, 'week').buckets;
    expect(series[6]!.perDay!.calories).to.be.closeTo(BANANA_CAL * 3, 1e-9);
    expect(series[6]!.perDay!.carbs).to.be.closeTo(22.8 * 3, 1e-9);
  });

  it('a week bucket is the mean over its logged days only', () => {
    const entries = [entry('a', TODAY, 100), entry('b', shiftDate(TODAY, -1), 200), entry('c', shiftDate(TODAY, -2), 300)];
    const series = trendData(stateWith(entries), TODAY, 'quarter').buckets;
    const last = series[series.length - 1]!;
    expect(last.loggedDays).to.equal(3);
    expect(last.perDay!.calories).to.be.closeTo(BANANA_CAL * 2, 1e-9);
  });

  it('an entry on a soft-deleted food still counts', () => {
    const base = seedTestState();
    const foods = base.foods.map((f) => (f.id === 'seed-banana' ? { ...f, deletedAt: '2026-03-02T00:00:00Z' } : f));
    const series = trendData({ ...base, foods, entries: [entry('a', TODAY)] }, TODAY, 'week').buckets;
    expect(series[6]!.perDay!.calories).to.be.closeTo(BANANA_CAL, 1e-9);
  });

  it('an entry whose unit no longer matches its food makes the day logged but adds nothing', () => {
    const series = trendData(stateWith([entry('a', TODAY, 1, 'seed-banana', 'count')]), TODAY, 'week').buckets;
    expect(series[6]!.loggedDays).to.equal(1);
    expect(series[6]!.perDay!.calories).to.equal(0);
  });
});

describe('trendData average', () => {
  it('one value per bucket for day ranges, none for week ranges', () => {
    expect(trendData(stateWith([]), TODAY, 'week').average.length).to.equal(7);
    expect(trendData(stateWith([]), TODAY, 'month').average.length).to.equal(30);
    expect(trendData(stateWith([]), TODAY, 'quarter').average).to.deep.equal([]);
    expect(trendData(stateWith([]), TODAY, 'year').average).to.deep.equal([]);
  });

  it('averages calories over the logged days in the trailing seven, null when there are none', () => {
    const state = stateWith([entry('a', TODAY, 100), entry('b', shiftDate(TODAY, -1), 200)]);
    const avg = trendData(state, TODAY, 'week').average;
    expect(avg[6]).to.be.closeTo(BANANA_CAL * 1.5, 1e-9);
    expect(avg[5]).to.be.closeTo(BANANA_CAL * 2, 1e-9);
    expect(avg[0]).to.equal(null);
  });

  it('looks back past the range start', () => {
    const state = stateWith([entry('a', shiftDate(TODAY, -8))]);
    const avg = trendData(state, TODAY, 'week').average;
    expect(trendData(state, TODAY, 'week').buckets[0]!.perDay).to.equal(null);
    expect(avg[0]).to.be.closeTo(BANANA_CAL, 1e-9);
    expect(avg[4]).to.be.closeTo(BANANA_CAL, 1e-9);
    expect(avg[5]).to.equal(null);
    expect(avg[6]).to.equal(null);
  });
});
