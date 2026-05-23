import { expect } from '@esm-bundle/chai';
import { parseFoodIntent } from '../../src/ui/foodIntents.js';
import type { FoodFormInput } from '../../src/ui/foodIntents.js';
import type { Food } from '../../src/domain/types.js';

const fixedClock = () => ({
  now: () => new Date('2026-05-23T10:00:00.000Z'),
  newId: () => 'new-id-1',
});

const existing: Food[] = [
  { id: 'seed-banana', name: 'Banana',
    kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
    primaryUnit: 'g', weightPerUnit: 100, chips: null,
    createdAt: '2026-01-01T00:00:00Z', deletedAt: null },
];

const addInput = (overrides: Partial<Extract<FoodFormInput, { mode: 'add' }>> = {}): FoodFormInput => ({
  mode: 'add', name: 'Cheese',
  kcalRaw: '402', proteinRaw: '25', carbsRaw: '1.3', fatRaw: '33',
  primaryUnit: 'g', weightPerUnitRaw: '',
  chipsRaw: ['', '', '', ''],
  ...overrides,
});

const editInput = (overrides: Partial<Extract<FoodFormInput, { mode: 'edit' }>> = {}): FoodFormInput => ({
  mode: 'edit', foodId: 'seed-banana',
  name: 'Better Banana', kcalRaw: '90', proteinRaw: '1.2', carbsRaw: '23', fatRaw: '0.4',
  primaryUnit: 'g', weightPerUnitRaw: '',
  chipsRaw: ['', '', '', ''],
  ...overrides,
});

describe('parseFoodIntent — add', () => {
  it('returns AddFood with a fresh id and createdAt when valid', () => {
    const r = parseFoodIntent(addInput(), existing, fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'AddFood') {
      throw new Error();
    }

    expect(r.action.food).to.deep.equal({
      id: 'new-id-1',
      name: 'Cheese',
      kcalPer100g: 402, proteinPer100g: 25, carbsPer100g: 1.3, fatPer100g: 33,
      primaryUnit: 'g', weightPerUnit: 100,
      chips: null,
      createdAt: '2026-05-23T10:00:00.000Z',
      deletedAt: null,
    });
  });

  it('returns AddFood with count primaryUnit and parsed weightPerUnit', () => {
    const r = parseFoodIntent(addInput({ name: 'Egg', primaryUnit: 'count', weightPerUnitRaw: '50' }), existing, fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'AddFood') {
      throw new Error();
    }

    expect(r.action.food.primaryUnit).to.equal('count');
    expect(r.action.food.weightPerUnit).to.equal(50);
  });

  it('rejects empty name', () => {
    const r = parseFoodIntent(addInput({ name: '   ' }), existing, fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter a name.' });
  });

  it('rejects duplicate name (case-insensitive) against a live food', () => {
    const r = parseFoodIntent(addInput({ name: 'banana' }), existing, fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'A food with this name already exists.' });
  });

  it('accepts the same name when the existing food is soft-deleted', () => {
    const deleted: Food[] = [{ ...existing[0]!, deletedAt: '2026-05-22T00:00:00Z' }];
    const r = parseFoodIntent(addInput({ name: 'Banana' }), deleted, fixedClock());
    expect(r.kind).to.equal('action');
  });

  it('rejects negative or NaN nutrition', () => {
    for (const overrides of [
      { kcalRaw: '-1' },
      { kcalRaw: 'abc' },
      { proteinRaw: 'NaN' },
      { fatRaw: '-0.1' },
    ]) {
      const r = parseFoodIntent(addInput(overrides), existing, fixedClock());
      expect(r.kind, JSON.stringify(overrides)).to.equal('error');
    }
  });

  it('rejects count food with missing/invalid weightPerUnit', () => {
    for (const wpu of ['', '0', '-5', 'abc']) {
      const r = parseFoodIntent(addInput({ name: 'Egg', primaryUnit: 'count', weightPerUnitRaw: wpu }), existing, fixedClock());
      expect(r.kind, `wpu=${wpu}`).to.equal('error');
    }
  });

  it('treats blank nutrition fields as 0', () => {
    const r = parseFoodIntent(addInput({ name: 'Water', kcalRaw: '0', proteinRaw: '', carbsRaw: '', fatRaw: '' }), existing, fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'AddFood') {
      throw new Error();
    }

    expect(r.action.food.proteinPer100g).to.equal(0);
    expect(r.action.food.carbsPer100g).to.equal(0);
    expect(r.action.food.fatPer100g).to.equal(0);
  });

  it('ignores weightPerUnitRaw for non-count units (defaults to 100)', () => {
    const r = parseFoodIntent(addInput({ name: 'Olive oil', primaryUnit: 'g', weightPerUnitRaw: '999' }), existing, fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'AddFood') {
      throw new Error();
    }

    expect(r.action.food.weightPerUnit).to.equal(100);
  });
});

describe('parseFoodIntent — edit', () => {
  it('returns EditFood with parsed updates', () => {
    const r = parseFoodIntent(editInput(), existing, fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'EditFood') {
      throw new Error();
    }

    expect(r.action.foodId).to.equal('seed-banana');
    expect(r.action.updates).to.deep.equal({
      name: 'Better Banana',
      kcalPer100g: 90, proteinPer100g: 1.2, carbsPer100g: 23, fatPer100g: 0.4,
      primaryUnit: 'g', weightPerUnit: 100,
      chips: null,
    });
  });

  it('rejects edit if name collides with a different live food', () => {
    const multi: Food[] = [
      existing[0]!,
      { ...existing[0]!, id: 'seed-oats', name: 'Oats' },
    ];
    const r = parseFoodIntent(editInput({ foodId: 'seed-oats', name: 'Banana' }), multi, fixedClock());
    expect(r.kind).to.equal('error');
  });

  it('allows edit that keeps the same name (no rename)', () => {
    const r = parseFoodIntent(editInput({ name: 'Banana' }), existing, fixedClock());
    expect(r.kind).to.equal('action');
  });
});
