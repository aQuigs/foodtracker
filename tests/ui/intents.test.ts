import { expect } from '@esm-bundle/chai';
import { parseLogIntent } from '../../src/ui/intents.js';
import type { Food, Unit } from '../../src/domain/types.js';

const food: Food = {
  id: 'f1', name: 'Banana',
  kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
  primaryUnit: 'g', weightPerUnit: 100,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const egg: Food = {
  id: 'f-egg', name: 'Egg',
  kcalPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11,
  primaryUnit: 'count', weightPerUnit: 50,
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const fixedClock = () => ({
  now: () => new Date('2026-05-23T10:00:00.000Z'),
  newId: () => 'fixed-id',
});

const baseInput = (overrides: Partial<{ foodId: string; amountRaw: string; unit: Unit; date: string }>) => ({
  foodId: 'f1', amountRaw: '120', unit: 'g' as Unit, date: '2026-05-23',
  ...overrides,
});

describe('parseLogIntent', () => {
  it('returns LogEntry action for valid gram input', () => {
    const r = parseLogIntent(baseInput({}), [food], fixedClock());
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
        amount: 120,
        unit: 'g',
        grams: 120,
        loggedAt: '2026-05-23T10:00:00.000Z',
      },
    });
  });

  it('resolves grams for count entries using weightPerUnit', () => {
    const r = parseLogIntent(baseInput({ foodId: 'f-egg', amountRaw: '2', unit: 'count' }), [egg], fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'LogEntry') {
      throw new Error();
    }

    expect(r.action.entry.amount).to.equal(2);
    expect(r.action.entry.unit).to.equal('count');
    expect(r.action.entry.grams).to.equal(100);
  });

  it('resolves grams for ounces', () => {
    const r = parseLogIntent(baseInput({ amountRaw: '4', unit: 'oz' }), [food], fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'LogEntry') {
      throw new Error();
    }

    expect(r.action.entry.grams).to.be.closeTo(113.398, 1e-3);
  });

  it('resolves grams for pounds', () => {
    const r = parseLogIntent(baseInput({ amountRaw: '0.25', unit: 'lb' }), [food], fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'LogEntry') {
      throw new Error();
    }

    expect(r.action.entry.grams).to.be.closeTo(113.398, 1e-3);
  });

  it('parses decimal amounts', () => {
    const r = parseLogIntent(baseInput({ amountRaw: '37.5' }), [food], fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'LogEntry') {
      throw new Error();
    }

    expect(r.action.entry.amount).to.equal(37.5);
  });

  it('rejects empty foodId', () => {
    const r = parseLogIntent(baseInput({ foodId: '' }), [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('rejects unknown foodId', () => {
    const r = parseLogIntent(baseInput({ foodId: 'nope' }), [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });

  it('rejects empty amount', () => {
    const r = parseLogIntent(baseInput({ amountRaw: '' }), [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter an amount greater than 0.' });
  });

  it('rejects whitespace-only amount', () => {
    const r = parseLogIntent(baseInput({ amountRaw: '   ' }), [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter an amount greater than 0.' });
  });

  it('rejects zero amount', () => {
    const r = parseLogIntent(baseInput({ amountRaw: '0' }), [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter an amount greater than 0.' });
  });

  it('rejects negative amount', () => {
    const r = parseLogIntent(baseInput({ amountRaw: '-10' }), [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter an amount greater than 0.' });
  });

  it('rejects non-numeric amount', () => {
    const r = parseLogIntent(baseInput({ amountRaw: 'abc' }), [food], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter an amount greater than 0.' });
  });

  it('rejects NaN/Infinity amount', () => {
    for (const amountRaw of ['NaN', 'Infinity', '-Infinity']) {
      const r = parseLogIntent(baseInput({ amountRaw }), [food], fixedClock());
      expect(r.kind).to.equal('error');
    }
  });

  it('rejects logging against a soft-deleted food from the picker side', () => {
    const deleted: Food = { ...food, deletedAt: '2026-05-22T00:00:00Z' };
    const r = parseLogIntent(baseInput({}), [deleted], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a food.' });
  });
});
