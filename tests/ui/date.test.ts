import { expect } from '@esm-bundle/chai';
import { shiftDate } from '../../src/ui/date.js';

describe('shiftDate', () => {
  it('adds 1 day', () => {
    expect(shiftDate('2026-05-23', 1)).to.equal('2026-05-24');
  });

  it('subtracts 1 day', () => {
    expect(shiftDate('2026-05-23', -1)).to.equal('2026-05-22');
  });

  it('crosses month boundary forward', () => {
    expect(shiftDate('2026-05-31', 1)).to.equal('2026-06-01');
  });

  it('crosses month boundary backward', () => {
    expect(shiftDate('2026-06-01', -1)).to.equal('2026-05-31');
  });

  it('crosses year boundary', () => {
    expect(shiftDate('2026-12-31', 1)).to.equal('2027-01-01');
    expect(shiftDate('2026-01-01', -1)).to.equal('2025-12-31');
  });

  it('handles leap-day correctly (2024 is a leap year)', () => {
    expect(shiftDate('2024-02-28', 1)).to.equal('2024-02-29');
    expect(shiftDate('2024-02-29', 1)).to.equal('2024-03-01');
    expect(shiftDate('2024-03-01', -1)).to.equal('2024-02-29');
  });

  it('handles non-leap year February correctly', () => {
    expect(shiftDate('2026-02-28', 1)).to.equal('2026-03-01');
  });

  it('survives a spring-forward DST day (US: 2026-03-08)', () => {
    expect(shiftDate('2026-03-07', 1)).to.equal('2026-03-08');
    expect(shiftDate('2026-03-08', 1)).to.equal('2026-03-09');
    expect(shiftDate('2026-03-09', -1)).to.equal('2026-03-08');
  });

  it('survives a fall-back DST day (US: 2026-11-01)', () => {
    expect(shiftDate('2026-10-31', 1)).to.equal('2026-11-01');
    expect(shiftDate('2026-11-01', 1)).to.equal('2026-11-02');
  });

  it('returns the input unchanged when given a non-ISO date string', () => {
    for (const bad of ['', '2026', '2026-05', 'not-a-date', '2026/05/23', 'NaN-NaN-NaN']) {
      expect(shiftDate(bad, 1)).to.equal(bad);
    }
  });
});
