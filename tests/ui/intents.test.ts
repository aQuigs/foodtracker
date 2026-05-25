import { expect } from '@esm-bundle/chai';
import { parseLogIntent } from '../../src/ui/intents.js';
import type { Food } from '../../src/domain/types.js';

const food: Food = {
  id: 'banana', name: 'Banana',
  nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  primaryUnit: 'g', weightPerUnit: 100,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const egg: Food = {
  id: 'egg', name: 'Egg',
  nutritionFacts: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  primaryUnit: 'count', weightPerUnit: 50,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const clock = {
  now: () => new Date('2026-05-23T10:00:00.000Z'),
  newId: () => 'id-1',
};

describe('parseLogIntent', () => {
  it('returns a LogEntry action for valid input (grams)', () => {
    const r = parseLogIntent({ foodId: 'banana', amountRaw: '120', unit: 'g', date: '2026-05-23' }, [food], clock);
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action') return;
    expect(r.action).to.deep.equal({
      type: 'LogEntry',
      entry: {
        id: 'id-1',
        date: '2026-05-23',
        foodId: 'banana',
        amount: 120,
        unit: 'g',
        grams: 120,
        loggedAt: '2026-05-23T10:00:00.000Z',
      },
    });
  });

  it('resolves grams from oz/lb via toGrams', () => {
    const r1 = parseLogIntent({ foodId: 'banana', amountRaw: '1', unit: 'oz', date: '2026-05-23' }, [food], clock);
    if (r1.kind !== 'action' || r1.action.type !== 'LogEntry') throw new Error();
    expect(r1.action.entry.grams).to.be.closeTo(28.3495, 1e-4);

    const r2 = parseLogIntent({ foodId: 'banana', amountRaw: '0.25', unit: 'lb', date: '2026-05-23' }, [food], clock);
    if (r2.kind !== 'action' || r2.action.type !== 'LogEntry') throw new Error();
    expect(r2.action.entry.grams).to.be.closeTo(113.398, 1e-3);
  });

  it('resolves grams from count via the food\'s weightPerUnit', () => {
    const r = parseLogIntent({ foodId: 'egg', amountRaw: '2', unit: 'count', date: '2026-05-23' }, [egg], clock);
    if (r.kind !== 'action' || r.action.type !== 'LogEntry') throw new Error();
    expect(r.action.entry.grams).to.equal(100);
    expect(r.action.entry.amount).to.equal(2);
    expect(r.action.entry.unit).to.equal('count');
  });

  it('errors when foodId is empty', () => {
    const r = parseLogIntent({ foodId: '', amountRaw: '120', unit: 'g', date: '2026-05-23' }, [food], clock);
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('errors when foodId is not in foods', () => {
    const r = parseLogIntent({ foodId: 'missing', amountRaw: '120', unit: 'g', date: '2026-05-23' }, [food], clock);
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('errors when the food is soft-deleted', () => {
    const deleted: Food = { ...food, deletedAt: '2026-05-01T00:00:00Z' };
    const r = parseLogIntent({ foodId: 'banana', amountRaw: '120', unit: 'g', date: '2026-05-23' }, [deleted], clock);
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('errors when unit is invalid', () => {
    const r = parseLogIntent({ foodId: 'banana', amountRaw: '120', unit: 'tsp', date: '2026-05-23' }, [food], clock);
    expect(r.kind).to.equal('error');
  });

  it('errors when amount is empty or whitespace', () => {
    for (const raw of ['', '   ']) {
      const r = parseLogIntent({ foodId: 'banana', amountRaw: raw, unit: 'g', date: '2026-05-23' }, [food], clock);
      expect(r.kind).to.equal('error');
    }
  });

  it('errors when amount is zero, negative, or non-numeric', () => {
    for (const raw of ['0', '-5', 'abc']) {
      const r = parseLogIntent({ foodId: 'banana', amountRaw: raw, unit: 'g', date: '2026-05-23' }, [food], clock);
      expect(r.kind).to.equal('error');
    }
  });

  it('accepts fractional amounts', () => {
    const r = parseLogIntent({ foodId: 'banana', amountRaw: '12.5', unit: 'g', date: '2026-05-23' }, [food], clock);
    expect(r.kind).to.equal('action');
    if (r.kind === 'action' && r.action.type === 'LogEntry') {
      expect(r.action.entry.grams).to.equal(12.5);
    }
  });
});
