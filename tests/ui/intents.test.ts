import { expect } from '@esm-bundle/chai';
import { parseLogIntent } from '../../src/ui/intents.js';
import type { Food } from '../../src/domain/types.js';

const food: Food = {
  id: 'f1', name: 'Banana',
  kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const fixedClock = () => ({
  now: () => new Date('2026-05-23T10:00:00.000Z'),
  newId: () => 'fixed-id',
});

describe('parseLogIntent', () => {
  it('returns LogEntry action for valid input', () => {
    const r = parseLogIntent({ foodId: 'f1', gramsRaw: '120', date: '2026-05-23' }, [food], fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action') {
      throw new Error();
    }

    expect(r.action).to.deep.equal({
      type: 'LogEntry',
      entry: {
        id: 'fixed-id',
        date: '2026-05-23',
        foodId: 'f1',
        grams: 120,
        loggedAt: '2026-05-23T10:00:00.000Z',
      },
    });
  });

  it('parses decimal grams', () => {
    const r = parseLogIntent({ foodId: 'f1', gramsRaw: '37.5', date: '2026-05-23' }, [food], fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action') {
      throw new Error();
    }

    if (r.action.type !== 'LogEntry') {
      throw new Error();
    }

    expect(r.action.entry.grams).to.equal(37.5);
  });

  it('rejects empty foodId', () => {
    const r = parseLogIntent({ foodId: '', gramsRaw: '100', date: '2026-05-23' }, [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('rejects unknown foodId', () => {
    const r = parseLogIntent({ foodId: 'nope', gramsRaw: '100', date: '2026-05-23' }, [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('rejects empty grams', () => {
    const r = parseLogIntent({ foodId: 'f1', gramsRaw: '', date: '2026-05-23' }, [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter grams greater than 0.' });
  });

  it('rejects whitespace-only grams', () => {
    const r = parseLogIntent({ foodId: 'f1', gramsRaw: '   ', date: '2026-05-23' }, [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter grams greater than 0.' });
  });

  it('rejects zero grams', () => {
    const r = parseLogIntent({ foodId: 'f1', gramsRaw: '0', date: '2026-05-23' }, [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter grams greater than 0.' });
  });

  it('rejects negative grams', () => {
    const r = parseLogIntent({ foodId: 'f1', gramsRaw: '-10', date: '2026-05-23' }, [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter grams greater than 0.' });
  });

  it('rejects non-numeric grams', () => {
    const r = parseLogIntent({ foodId: 'f1', gramsRaw: 'abc', date: '2026-05-23' }, [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter grams greater than 0.' });
  });

  it('rejects NaN/Infinity grams', () => {
    for (const gramsRaw of ['NaN', 'Infinity', '-Infinity']) {
      const r = parseLogIntent({ foodId: 'f1', gramsRaw, date: '2026-05-23' }, [food], fixedClock());
      expect(r.kind).to.equal('error');
    }
  });

  it('rejects logging against a soft-deleted food from the picker side', () => {
    const deleted: Food = { ...food, deletedAt: '2026-05-22T00:00:00Z' };
    const r = parseLogIntent({ foodId: 'f1', gramsRaw: '100', date: '2026-05-23' }, [deleted], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });
});
