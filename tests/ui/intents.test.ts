import { expect } from '@esm-bundle/chai';
import { parseLogIntent } from '../../src/ui/intents.js';
import type { Food } from '../../src/domain/types.js';

const food: Food = {
  id: 'banana', name: 'Banana',
  nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  servingSize: 100, servingUnit: 'g',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const egg: Food = {
  id: 'egg', name: 'Egg',
  nutritionFacts: { calories: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
  servingSize: 1, servingUnit: 'count',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const clock = {
  now: () => new Date('2026-05-23T10:00:00.000Z'),
  newId: () => 'id-1',
};

const seqClock = (() => {
  let i = 0;
  return {
    now: () => new Date('2026-05-23T10:00:00.000Z'),
    newId: () => `id-${++i}`,
  };
})();

describe('parseLogIntent', () => {
  it('returns a LogEntry action for valid input (grams)', () => {
    const r = parseLogIntent({ foodId: 'banana', amount: '120', unit: 'g', date: '2026-05-23' }, [food], clock);
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action') return;
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'LogEntry') {
      return;
    }

    expect(r.action.entry).to.deep.equal({
      id: 'id-1',
      date: '2026-05-23',
      foodId: 'banana',
      amount: 120,
      unit: 'g',
      loggedAt: '2026-05-23T10:00:00.000Z',
    });
    expect(r.action.newMealId).to.equal('id-1');
  });

  it('accepts oz/lb amounts (no grams field stored)', () => {
    const r1 = parseLogIntent({ foodId: 'banana', amount: '1', unit: 'oz', date: '2026-05-23' }, [food], clock);
    expect(r1.kind).to.equal('action');
    if (r1.kind !== 'action' || r1.action.type !== 'LogEntry') throw new Error();
    expect(r1.action.entry.amount).to.equal(1);
    expect(r1.action.entry.unit).to.equal('oz');

    const r2 = parseLogIntent({ foodId: 'banana', amount: '0.25', unit: 'lb', date: '2026-05-23' }, [food], clock);
    expect(r2.kind).to.equal('action');
  });

  it('accepts count amounts for a count food', () => {
    const r = parseLogIntent({ foodId: 'egg', amount: '2', unit: 'count', date: '2026-05-23' }, [egg], clock);
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'LogEntry') throw new Error();
    expect(r.action.entry.amount).to.equal(2);
    expect(r.action.entry.unit).to.equal('count');
  });

  it('errors when foodId is empty', () => {
    const r = parseLogIntent({ foodId: '', amount: '120', unit: 'g', date: '2026-05-23' }, [food], clock);
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('errors when foodId is not in foods', () => {
    const r = parseLogIntent({ foodId: 'missing', amount: '120', unit: 'g', date: '2026-05-23' }, [food], clock);
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('errors when the food is soft-deleted', () => {
    const deleted: Food = { ...food, deletedAt: '2026-05-01T00:00:00Z' };
    const r = parseLogIntent({ foodId: 'banana', amount: '120', unit: 'g', date: '2026-05-23' }, [deleted], clock);
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('errors when unit is invalid', () => {
    const r = parseLogIntent({ foodId: 'banana', amount: '120', unit: 'tsp', date: '2026-05-23' }, [food], clock);
    expect(r.kind).to.equal('error');
  });

  it('errors when unit is valid but incompatible with the food (lb on count-food)', () => {
    const r = parseLogIntent({ foodId: 'egg', amount: '1', unit: 'lb', date: '2026-05-23' }, [egg], clock);
    expect(r.kind).to.equal('error');
    if (r.kind === 'error') {
      expect(r.message).to.contain('lb');
    }
  });

  it('errors when unit is valid but incompatible with the food (count on g-food)', () => {
    const r = parseLogIntent({ foodId: 'banana', amount: '1', unit: 'count', date: '2026-05-23' }, [food], clock);
    expect(r.kind).to.equal('error');
    if (r.kind === 'error') {
      expect(r.message).to.contain('count');
    }
  });

  it('errors when amount is empty or whitespace', () => {
    for (const raw of ['', '   ']) {
      const r = parseLogIntent({ foodId: 'banana', amount: raw, unit: 'g', date: '2026-05-23' }, [food], clock);
      expect(r.kind).to.equal('error');
    }
  });

  it('errors when amount is zero, negative, or non-numeric', () => {
    for (const raw of ['0', '-5', 'abc']) {
      const r = parseLogIntent({ foodId: 'banana', amount: raw, unit: 'g', date: '2026-05-23' }, [food], clock);
      expect(r.kind).to.equal('error');
    }
  });

  it('accepts fractional amounts', () => {
    const r = parseLogIntent({ foodId: 'banana', amount: '12.5', unit: 'g', date: '2026-05-23' }, [food], clock);
    expect(r.kind).to.equal('action');
    if (r.kind === 'action' && r.action.type === 'LogEntry') {
      expect(r.action.entry.amount).to.equal(12.5);
    }
  });
});
