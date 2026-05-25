import { expect } from '@esm-bundle/chai';
import { parseLogIntent } from '../../src/ui/intents.js';
import type { Food } from '../../src/domain/types.js';

const food: Food = {
  id: 'banana', name: 'Banana',
  nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const clock = {
  now: () => new Date('2026-05-23T10:00:00.000Z'),
  newId: () => 'id-1',
};

describe('parseLogIntent', () => {
  it('returns a LogEntry action for valid input', () => {
    const r = parseLogIntent({ foodId: 'banana', gramsRaw: '120', date: '2026-05-23' }, [food], clock);
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action') return;
    expect(r.action).to.deep.equal({
      type: 'LogEntry',
      entry: {
        id: 'id-1',
        date: '2026-05-23',
        foodId: 'banana',
        grams: 120,
        loggedAt: '2026-05-23T10:00:00.000Z',
      },
    });
  });

  it('errors when foodId is empty', () => {
    const r = parseLogIntent({ foodId: '', gramsRaw: '120', date: '2026-05-23' }, [food], clock);
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('errors when foodId is not in foods', () => {
    const r = parseLogIntent({ foodId: 'missing', gramsRaw: '120', date: '2026-05-23' }, [food], clock);
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('errors when the food is soft-deleted', () => {
    const deleted: Food = { ...food, deletedAt: '2026-05-01T00:00:00Z' };
    const r = parseLogIntent({ foodId: 'banana', gramsRaw: '120', date: '2026-05-23' }, [deleted], clock);
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('errors when grams is empty or whitespace', () => {
    for (const raw of ['', '   ']) {
      const r = parseLogIntent({ foodId: 'banana', gramsRaw: raw, date: '2026-05-23' }, [food], clock);
      expect(r).to.deep.equal({ kind: 'error', message: 'Enter grams greater than 0.' });
    }
  });

  it('errors when grams is zero, negative, or non-numeric', () => {
    for (const raw of ['0', '-5', 'abc']) {
      const r = parseLogIntent({ foodId: 'banana', gramsRaw: raw, date: '2026-05-23' }, [food], clock);
      expect(r.kind).to.equal('error');
    }
  });

  it('accepts fractional grams', () => {
    const r = parseLogIntent({ foodId: 'banana', gramsRaw: '12.5', date: '2026-05-23' }, [food], clock);
    expect(r.kind).to.equal('action');
    if (r.kind === 'action' && r.action.type === 'LogEntry') {
      expect(r.action.entry.grams).to.equal(12.5);
    }
  });
});
