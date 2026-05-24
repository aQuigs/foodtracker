import { expect } from '@esm-bundle/chai';
import { parseFoodIntent } from '../../src/ui/foodIntents.js';
import type { Food } from '../../src/domain/types.js';

const fixedClock = () => ({
  now: () => new Date('2026-05-23T10:00:00.000Z'),
  newId: () => 'new-id-1',
});

const existing: Food[] = [
  { id: 'seed-banana', name: 'Banana',
    kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3,
    createdAt: '2026-01-01T00:00:00Z', deletedAt: null },
];

describe('parseFoodIntent — add', () => {
  it('returns AddFood with a fresh id and createdAt when valid', () => {
    const r = parseFoodIntent({ mode: 'add', name: 'Cheese', kcalRaw: '402', proteinRaw: '25', carbsRaw: '1.3', fatRaw: '33' }, existing, fixedClock());
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
      kcalPer100g: 402, proteinPer100g: 25, carbsPer100g: 1.3, fatPer100g: 33,
      createdAt: '2026-05-23T10:00:00.000Z',
      deletedAt: null,
    });
  });

  it('rejects empty name', () => {
    const r = parseFoodIntent({ mode: 'add', name: '   ', kcalRaw: '100', proteinRaw: '5', carbsRaw: '10', fatRaw: '2' }, existing, fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter a name.' });
  });

  it('rejects duplicate name (case-insensitive) against a live food', () => {
    const r = parseFoodIntent({ mode: 'add', name: 'banana', kcalRaw: '100', proteinRaw: '5', carbsRaw: '10', fatRaw: '2' }, existing, fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'A food with this name already exists.' });
  });

  it('accepts the same name when the existing food is soft-deleted', () => {
    const deleted: Food[] = [{ ...existing[0]!, deletedAt: '2026-05-22T00:00:00Z' }];
    const r = parseFoodIntent({ mode: 'add', name: 'Banana', kcalRaw: '100', proteinRaw: '5', carbsRaw: '10', fatRaw: '2' }, deleted, fixedClock());
    expect(r.kind).to.equal('action');
  });

  it('rejects negative or NaN nutrition', () => {
    for (const overrides of [
      { kcalRaw: '-1' },
      { kcalRaw: 'abc' },
      { proteinRaw: 'NaN' },
      { fatRaw: '-0.1' },
    ]) {
      const r = parseFoodIntent({ mode: 'add', name: 'Cheese', kcalRaw: '100', proteinRaw: '5', carbsRaw: '10', fatRaw: '2', ...overrides }, existing, fixedClock());
      expect(r.kind, JSON.stringify(overrides)).to.equal('error');
    }
  });

  it('treats blank nutrition fields as 0', () => {
    const r = parseFoodIntent({ mode: 'add', name: 'Water', kcalRaw: '0', proteinRaw: '', carbsRaw: '', fatRaw: '' }, existing, fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'AddFood') {
      throw new Error();
    }

    expect(r.action.food.proteinPer100g).to.equal(0);
    expect(r.action.food.carbsPer100g).to.equal(0);
    expect(r.action.food.fatPer100g).to.equal(0);
  });
});

describe('parseFoodIntent — edit', () => {
  it('returns EditFood with parsed updates', () => {
    const r = parseFoodIntent({
      mode: 'edit', foodId: 'seed-banana',
      name: 'Better Banana', kcalRaw: '90', proteinRaw: '1.2', carbsRaw: '23', fatRaw: '0.4',
    }, existing, fixedClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'EditFood') {
      throw new Error();
    }

    expect(r.action.foodId).to.equal('seed-banana');
    expect(r.action.updates).to.deep.equal({
      name: 'Better Banana',
      kcalPer100g: 90, proteinPer100g: 1.2, carbsPer100g: 23, fatPer100g: 0.4,
    });
  });

  it('rejects edit if name collides with a different live food', () => {
    const multi: Food[] = [
      existing[0]!,
      { ...existing[0]!, id: 'seed-oats', name: 'Oats' },
    ];
    const r = parseFoodIntent({
      mode: 'edit', foodId: 'seed-oats',
      name: 'Banana', kcalRaw: '100', proteinRaw: '5', carbsRaw: '10', fatRaw: '2',
    }, multi, fixedClock());
    expect(r.kind).to.equal('error');
  });

  it('allows edit that keeps the same name (no rename)', () => {
    const r = parseFoodIntent({
      mode: 'edit', foodId: 'seed-banana',
      name: 'Banana', kcalRaw: '100', proteinRaw: '5', carbsRaw: '10', fatRaw: '2',
    }, existing, fixedClock());
    expect(r.kind).to.equal('action');
  });
});
