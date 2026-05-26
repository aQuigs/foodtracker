import { expect } from '@esm-bundle/chai';
import { parseFoodIntent } from '../../src/ui/foodIntents.js';
import type { Entry, Food } from '../../src/domain/types.js';

const fixedClock = () => ({
  now: () => new Date('2026-05-23T10:00:00.000Z'),
  newId: () => 'new-id-1',
});

const existing: Food[] = [
  { id: 'seed-banana', name: 'Banana',
    nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
    servingSize: 100, servingUnit: 'g',
    createdAt: '2026-01-01T00:00:00Z', deletedAt: null },
];

const baseForm = {
  calories: '100', protein: '5', carbs: '10', fat: '2',
  servingSize: '100', servingUnit: 'g',
};

describe('parseFoodIntent — add', () => {
  it('returns AddFood with a fresh id and createdAt when valid', () => {
    const r = parseFoodIntent({ mode: 'add', name: 'Cheese', calories: '402', protein: '25', carbs: '1.3', fat: '33', servingSize: '100', servingUnit: 'g' }, existing, [], fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action') {
      throw new Error();
    }

    expect(r.action.type).to.equal('AddFood');
    if (r.action.type !== 'AddFood') {
      throw new Error();
    }

    expect(r.action.food).to.deep.equal({
      id: 'new-id-1',
      name: 'Cheese',
      nutritionFacts: { calories: 402, protein: 25, carbs: 1.3, fat: 33 },
      servingSize: 100,
      servingUnit: 'g',
      createdAt: '2026-05-23T10:00:00.000Z',
      deletedAt: null,
    });
  });

  it('produces a count food with serving size 1', () => {
    const r = parseFoodIntent({ mode: 'add', name: 'Egg', calories: '78', protein: '6.5', carbs: '0.6', fat: '5.5', servingSize: '1', servingUnit: 'count' }, [], [], fixedClock());
    if (r.kind !== 'action' || r.action.type !== 'AddFood') throw new Error();
    expect(r.action.food.servingUnit).to.equal('count');
    expect(r.action.food.servingSize).to.equal(1);
  });

  it('rejects a non-positive serving size', () => {
    for (const s of ['', '0', '-1', 'abc']) {
      const r = parseFoodIntent({ mode: 'add', name: 'X', ...baseForm, servingSize: s }, [], [], fixedClock());
      expect(r.kind, s).to.equal('error');
    }
  });

  it('rejects an unknown servingUnit', () => {
    const r = parseFoodIntent({ mode: 'add', name: 'X', ...baseForm, servingUnit: 'tsp' }, [], [], fixedClock());
    expect(r.kind).to.equal('error');
  });

  it('rejects empty name', () => {
    const r = parseFoodIntent({ mode: 'add', name: '   ', ...baseForm }, existing, [], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter a name.' });
  });

  it('rejects duplicate name (case-insensitive) against a live food', () => {
    const r = parseFoodIntent({ mode: 'add', name: 'banana', ...baseForm }, existing, [], fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'A food with this name already exists.' });
  });

  it('accepts the same name when the existing food is soft-deleted', () => {
    const deleted: Food[] = [{ ...existing[0]!, deletedAt: '2026-05-22T00:00:00Z' }];
    const r = parseFoodIntent({ mode: 'add', name: 'Banana', ...baseForm }, deleted, [], fixedClock());
    expect(r.kind).to.equal('action');
  });

  it('rejects negative or NaN nutrition', () => {
    for (const overrides of [
      { calories: '-1' },
      { calories: 'abc' },
      { protein: 'NaN' },
      { fat: '-0.1' },
    ]) {
      const r = parseFoodIntent({ mode: 'add', name: 'Cheese', ...baseForm, ...overrides }, existing, [], fixedClock());
      expect(r.kind, JSON.stringify(overrides)).to.equal('error');
    }
  });

  it('treats blank nutrition fields as 0', () => {
    const r = parseFoodIntent({ mode: 'add', name: 'Water', calories: '0', protein: '', carbs: '', fat: '', servingSize: '100', servingUnit: 'g' }, existing, [], fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'AddFood') {
      throw new Error();
    }

    expect(r.action.food.nutritionFacts.protein).to.equal(0);
    expect(r.action.food.nutritionFacts.carbs).to.equal(0);
    expect(r.action.food.nutritionFacts.fat).to.equal(0);
  });
});

describe('parseFoodIntent — edit', () => {
  it('returns EditFood with parsed updates', () => {
    const r = parseFoodIntent({
      mode: 'edit', foodId: 'seed-banana',
      name: 'Better Banana', calories: '90', protein: '1.2', carbs: '23', fat: '0.4',
      servingSize: '100', servingUnit: 'g',
    }, existing, [], fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'EditFood') {
      throw new Error();
    }

    expect(r.action.foodId).to.equal('seed-banana');
    expect(r.action.updates).to.deep.equal({
      name: 'Better Banana',
      nutritionFacts: { calories: 90, protein: 1.2, carbs: 23, fat: 0.4 },
      servingSize: 100,
      servingUnit: 'g',
    });
  });

  it('rejects edit if name collides with a different live food', () => {
    const multi: Food[] = [
      existing[0]!,
      { ...existing[0]!, id: 'seed-oats', name: 'Oats' },
    ];
    const r = parseFoodIntent({
      mode: 'edit', foodId: 'seed-oats',
      name: 'Banana', ...baseForm,
    }, multi, [], fixedClock());
    expect(r.kind).to.equal('error');
  });

  it('allows edit that keeps the same name (no rename)', () => {
    const r = parseFoodIntent({
      mode: 'edit', foodId: 'seed-banana',
      name: 'Banana', ...baseForm,
    }, existing, [], fixedClock());
    expect(r.kind).to.equal('action');
  });

  it('rejects edit that crosses the count/weight axis when entries reference the food', () => {
    const count: Food = { ...existing[0]!, id: 'egg', name: 'Egg', servingSize: 1, servingUnit: 'count' };
    const entry: Entry = { id: 'e1', date: '2026-05-23', foodId: 'egg', amount: 3, unit: 'count', loggedAt: '2026-05-23T10:00:00Z' };
    const r = parseFoodIntent({
      mode: 'edit', foodId: 'egg',
      name: 'Egg', ...baseForm, servingUnit: 'g', servingSize: '100',
    }, [count], [entry], fixedClock());
    expect(r.kind).to.equal('error');
    if (r.kind === 'error') {
      expect(r.message).to.match(/count.*weight|weight.*count/i);
    }
  });

  it('allows axis change when no entries reference the food', () => {
    const count: Food = { ...existing[0]!, id: 'egg', name: 'Egg', servingSize: 1, servingUnit: 'count' };
    const r = parseFoodIntent({
      mode: 'edit', foodId: 'egg',
      name: 'Egg', ...baseForm, servingUnit: 'g', servingSize: '100',
    }, [count], [], fixedClock());
    expect(r.kind).to.equal('action');
  });

  it('allows same-axis weight change (g→oz) when entries exist', () => {
    const entry: Entry = { id: 'e1', date: '2026-05-23', foodId: 'seed-banana', amount: 100, unit: 'g', loggedAt: '2026-05-23T10:00:00Z' };
    const r = parseFoodIntent({
      mode: 'edit', foodId: 'seed-banana',
      name: 'Banana', ...baseForm, servingUnit: 'oz', servingSize: '1',
    }, existing, [entry], fixedClock());
    expect(r.kind).to.equal('action');
  });
});
