import { expect } from '@esm-bundle/chai';
import { reducer } from '../../src/domain/reducer.js';
import { freshState } from '../../src/domain/seed.js';
import { entryCalories } from '../../src/domain/calc.js';
import { defaultEnabledSources } from '../../src/domain/foodSources.js';
import { defaultSettings } from '../../src/domain/settings.js';
import { parseLogIntent } from '../../src/ui/intents.js';
import type { Food, State } from '../../src/domain/types.js';

const validFood = (id = 'custom-1'): Food => ({
  id, name: 'Custom food',
  nutritionFacts: { calories: 200, protein: 5, carbs: 30, fat: 8 },
  servingSize: 100, servingUnit: 'g',
  createdAt: '2026-05-23T10:00:00Z', deletedAt: null,
});

const testClock = { now: () => new Date('2026-05-23T10:00:00Z'), newId: () => `id-${Math.random()}` };

// Logs through the real intent parser rather than hand-building an entry, so
// the test exercises the same freeze-at-log-time conversion the app does.
function loggedState(state: State, foodId: string, amount: string, unit: string): State {
  const result = parseLogIntent({ foodId, amount, unit, date: '2026-05-23' }, state.foods, testClock);
  if (result.kind !== 'action') {
    throw new Error(`log failed: ${result.message}`);
  }

  return reducer(state, result.action);
}

describe('reducer — AddFood', () => {
  it('appends a new food with a unique id', () => {
    const before = freshState();
    const food = validFood('new-1');
    const after = reducer(before, { type: 'AddFood', food });
    expect(after.foods).to.have.lengthOf(before.foods.length + 1);
    expect(after.foods.find((f) => f.id === 'new-1')).to.deep.equal(food);
  });

  it('is a no-op on duplicate id', () => {
    const existing = validFood('existing-1');
    const before: State = { version: 2, enabledSources: defaultEnabledSources(), foods: [existing], meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings() };
    const dup = { ...validFood('existing-1') };
    const after = reducer(before, { type: 'AddFood', food: dup });
    expect(after).to.equal(before);
  });

  it('rejects negative nutrition values', () => {
    const before = freshState();
    for (const k of ['calories', 'protein', 'carbs', 'fat'] as const) {
      const bad = validFood();
      bad.nutritionFacts = { ...bad.nutritionFacts, [k]: -1 };
      const after = reducer(before, { type: 'AddFood', food: bad });
      expect(after, k).to.equal(before);
    }
  });

  it('rejects NaN/Infinity nutrition values', () => {
    const before = freshState();
    for (const bad of [NaN, Infinity, -Infinity]) {
      for (const k of ['calories', 'protein', 'carbs', 'fat'] as const) {
        const food = validFood();
        food.nutritionFacts = { ...food.nutritionFacts, [k]: bad };
        const after = reducer(before, { type: 'AddFood', food });
        expect(after).to.equal(before);
      }
    }
  });

  it('rejects an id that matches a soft-deleted food (locked behavior)', () => {
    const deleted: State = {
      version: 1,
      foods: [{ ...validFood('shared-id'), deletedAt: '2026-05-22T00:00:00Z' }],
      entries: [],
    };
    const after = reducer(deleted, { type: 'AddFood', food: validFood('shared-id') });
    expect(after).to.equal(deleted);
  });

  it('rejects a name a live food already uses, case-insensitively', () => {
    const before: State = { version: 2, enabledSources: defaultEnabledSources(), foods: [{ ...validFood('a1'), name: 'Apple' }], meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings() };
    const after = reducer(before, { type: 'AddFood', food: { ...validFood('a2'), name: 'apple' } });
    expect(after).to.equal(before);
  });

  it('allows a name that only a soft-deleted food used', () => {
    const dead = { ...validFood('a1'), name: 'Apple', deletedAt: '2026-05-22T00:00:00Z' };
    const before: State = { version: 2, enabledSources: defaultEnabledSources(), foods: [dead], meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings() };
    const after = reducer(before, { type: 'AddFood', food: { ...validFood('a2'), name: 'Apple' } });
    expect(after.foods).to.have.lengthOf(2);
  });

  it('allows the same name from two different brands to coexist', () => {
    const costco = { ...validFood('brand:kirkland-signature:1'), name: 'Almonds', brand: 'Kirkland Signature' };
    const before: State = { version: 2, enabledSources: defaultEnabledSources(), foods: [costco], meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings() };
    const after = reducer(before, { type: 'AddFood', food: { ...validFood('brand:great-value:1'), name: 'Almonds', brand: 'Great Value' } });
    expect(after.foods).to.have.lengthOf(2);
  });

  it('allows a user-made food to coexist with a same-named brand food', () => {
    const costco = { ...validFood('brand:kirkland-signature:1'), name: 'Almonds', brand: 'Kirkland Signature' };
    const before: State = { version: 2, enabledSources: defaultEnabledSources(), foods: [costco], meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings() };
    const after = reducer(before, { type: 'AddFood', food: { ...validFood('a2'), name: 'Almonds' } });
    expect(after.foods).to.have.lengthOf(2);
  });

  it('still rejects a user-made food with the same name as an untagged (reference-source) food', () => {
    const usda = { ...validFood('usda:1'), name: 'Almonds', source: 'usda' };
    const before: State = { version: 2, enabledSources: defaultEnabledSources(), foods: [usda], meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings() };
    const after = reducer(before, { type: 'AddFood', food: { ...validFood('a2'), name: 'Almonds' } });
    expect(after).to.equal(before);
  });

  it('rejects empty name or empty id', () => {
    const before = freshState();
    for (const bad of [
      { ...validFood(), name: '' },
      { ...validFood(), id: '' },
    ]) {
      const after = reducer(before, { type: 'AddFood', food: bad });
      expect(after).to.equal(before);
    }
  });

  it('accepts pieces on a weight food', () => {
    const before = freshState();
    const food = { ...validFood('cookies'), pieces: { perServing: 8, noun: 'cookies' } };
    const after = reducer(before, { type: 'AddFood', food });
    expect(after.foods.find((f) => f.id === 'cookies')!.pieces).to.deep.equal({ perServing: 8, noun: 'cookies' });
  });

  it('rejects pieces on a count food, or a non-positive or non-finite pieces.perServing', () => {
    const before = freshState();
    const foods = [
      { ...validFood('egg'), servingSize: 1, servingUnit: 'count' as const, pieces: { perServing: 1 } },
      ...[0, -1, Infinity, NaN].map((perServing) => ({ ...validFood(), pieces: { perServing } })),
    ];

    for (const food of foods) {
      expect(reducer(before, { type: 'AddFood', food }), JSON.stringify(food.pieces)).to.equal(before);
    }
  });
});

describe('reducer — EditFood', () => {
  const state: State = {
    version: 2, enabledSources: defaultEnabledSources(),
    foods: [validFood('f1'), { ...validFood('deleted-1'), deletedAt: '2026-05-22T00:00:00Z' }],
    meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings(),
  };

  it('updates name and nutrition fields', () => {
    const after = reducer(state, {
      type: 'EditFood',
      foodId: 'f1',
      updates: { name: 'Renamed', nutritionFacts: { calories: 250, protein: 5, carbs: 30, fat: 8 } },
    });
    const f = after.foods.find((x) => x.id === 'f1')!;
    expect(f.name).to.equal('Renamed');
    expect(f.nutritionFacts.calories).to.equal(250);
    expect(f.nutritionFacts.protein).to.equal(5);
  });

  it('is a no-op on unknown id', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'no-such', updates: { name: 'X' } });
    expect(after).to.equal(state);
  });

  it('is a no-op on a soft-deleted food', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'deleted-1', updates: { name: 'X' } });
    expect(after).to.equal(state);
  });

  it('rejects invalid nutrition updates (negative, NaN, Infinity)', () => {
    for (const bad of [-1, NaN, Infinity, -Infinity]) {
      for (const k of ['calories', 'protein', 'carbs', 'fat'] as const) {
        const updates = { nutritionFacts: { calories: 1, protein: 1, carbs: 1, fat: 1, [k]: bad } };
        const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates });
        expect(after).to.equal(state);
      }
    }
  });

  it('rejects renaming onto another live food\'s name', () => {
    const before: State = { ...state, foods: [{ ...validFood('a1'), name: 'Apple' }, { ...validFood('b1'), name: 'Banana' }] };
    const after = reducer(before, { type: 'EditFood', foodId: 'b1', updates: { name: 'APPLE' } });
    expect(after).to.equal(before);
  });

  it('allows keeping a food\'s own name on edit', () => {
    const before: State = { ...state, foods: [{ ...validFood('a1'), name: 'Apple' }] };
    const after = reducer(before, { type: 'EditFood', foodId: 'a1', updates: { name: 'Apple', servingSize: 50 } });
    expect(after.foods[0]!.servingSize).to.equal(50);
  });

  it('rejects empty name update', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates: { name: '' } });
    expect(after).to.equal(state);
  });

  it('rejects empty updates ({})', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates: {} });
    expect(after).to.equal(state);
  });

  it('preserves createdAt and deletedAt on edits', () => {
    const after = reducer(state, { type: 'EditFood', foodId: 'f1', updates: { name: 'Renamed' } });
    const f = after.foods.find((x) => x.id === 'f1')!;
    expect(f.createdAt).to.equal(state.foods[0]!.createdAt);
    expect(f.deletedAt).to.equal(null);
  });

  it('rejects servingUnit change across the count/weight axis when entries reference the food', () => {
    const stateWithCountFood: State = {
      version: 1,
      foods: [{ ...validFood('egg'), servingSize: 1, servingUnit: 'count' }],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'egg', amount: 3, unit: 'count', loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const after = reducer(stateWithCountFood, {
      type: 'EditFood', foodId: 'egg',
      updates: { servingUnit: 'g', servingSize: 100 },
    });
    expect(after).to.equal(stateWithCountFood);
  });

  it('allows servingUnit change across the axis when no entries reference the food', () => {
    const stateNoEntries: State = { ...state, foods: [{ ...validFood('egg'), servingSize: 1, servingUnit: 'count' }] };
    const after = reducer(stateNoEntries, {
      type: 'EditFood', foodId: 'egg',
      updates: { servingUnit: 'g', servingSize: 100 },
    });
    const f = after.foods.find((x) => x.id === 'egg')!;
    expect(f.servingUnit).to.equal('g');
    expect(f.servingSize).to.equal(100);
  });

  it('allows servingUnit change within the weight axis (g↔oz↔lb)', () => {
    const s: State = {
      ...state, foods: [validFood('f1')],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 100, unit: 'g', mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const after = reducer(s, { type: 'EditFood', foodId: 'f1', updates: { servingUnit: 'oz', servingSize: 1 } });
    const f = after.foods.find((x) => x.id === 'f1')!;
    expect(f.servingUnit).to.equal('oz');
  });

  it('is a no-op on a sourced food (immutable provenance)', () => {
    const sourced: State = { ...state, foods: [{ ...validFood('usda:12345'), source: 'usda' }] };
    const after = reducer(sourced, {
      type: 'EditFood', foodId: 'usda:12345', updates: { name: 'Renamed' },
    });
    expect(after).to.equal(sourced);
  });

  it('sets pieces from updates.pieces', () => {
    const before: State = { ...state, foods: [validFood('cookies')] };
    const after = reducer(before, { type: 'EditFood', foodId: 'cookies', updates: { pieces: { perServing: 8, noun: 'cookies' } } });
    expect(after.foods.find((f) => f.id === 'cookies')!.pieces).to.deep.equal({ perServing: 8, noun: 'cookies' });
  });

  it('clears pieces when updates.pieces is null', () => {
    const before: State = { ...state, foods: [{ ...validFood('cookies'), pieces: { perServing: 8, noun: 'cookies' } }] };
    const after = reducer(before, { type: 'EditFood', foodId: 'cookies', updates: { pieces: null } });
    expect(after.foods.find((f) => f.id === 'cookies')!.pieces).to.equal(undefined);
  });

  it('leaves pieces untouched when updates omits it', () => {
    const before: State = { ...state, foods: [{ ...validFood('cookies'), pieces: { perServing: 8, noun: 'cookies' } }] };
    const after = reducer(before, { type: 'EditFood', foodId: 'cookies', updates: { name: 'Renamed' } });
    expect(after.foods.find((f) => f.id === 'cookies')!.pieces).to.deep.equal({ perServing: 8, noun: 'cookies' });
  });

  it('rejects pieces on a food whose next servingUnit is count, or a non-positive pieces.perServing', () => {
    const before: State = { ...state, foods: [validFood('f1')] };
    const updates = [
      { servingUnit: 'count' as const, servingSize: 1, pieces: { perServing: 1 } },
      { pieces: { perServing: 0 } },
    ];

    for (const u of updates) {
      expect(reducer(before, { type: 'EditFood', foodId: 'f1', updates: u }), JSON.stringify(u)).to.equal(before);
    }
  });

  it('allows removing pieces while a count-shown entry references the food, leaving the entry unaffected', () => {
    const bar: Food = { ...validFood('bar'), servingSize: 118, pieces: { perServing: 1 } };
    const before: State = { ...state, foods: [bar], meals: [], entries: [] };
    const withEntry = loggedState(before, 'bar', '2', 'count');

    const after = reducer(withEntry, { type: 'EditFood', foodId: 'bar', updates: { pieces: null } });

    expect(after.foods.find((f) => f.id === 'bar')!.pieces).to.equal(undefined);
    expect(after.entries[0]).to.deep.equal(withEntry.entries[0]);
  });

  // The entry stores the physical grams a past "2 count" resolved to at log
  // time, so a later pieces edit — even one that changes the piece weight —
  // must never rescale it.
  it('leaves a past count entry\'s calories unaffected by an edit to pieces.perServing', () => {
    const bar: Food = { ...validFood('bar'), servingSize: 118, nutritionFacts: { calories: 118, protein: 0, carbs: 0, fat: 0 }, pieces: { perServing: 1 } };
    const before: State = { ...state, foods: [bar], meals: [], entries: [] };
    const withEntry = loggedState(before, 'bar', '2', 'count');

    const after = reducer(withEntry, { type: 'EditFood', foodId: 'bar', updates: { pieces: { perServing: 2 } } });

    expect(after.foods.find((f) => f.id === 'bar')!.pieces).to.deep.equal({ perServing: 2 });
    expect(entryCalories(after.entries[0]!, after.foods.find((f) => f.id === 'bar')!)).to.equal(236);
  });

  // A stored row must never read 'count' against a food's current pieces —
  // an entry logged while the food was itself counted must convert the
  // moment the food gains pieces, not silently keep breaking the rule.
  it('converts a counted food\'s count entries when it\'s edited into a weight food with pieces', () => {
    const counted: Food = { ...validFood('egg'), servingSize: 1, servingUnit: 'count' };
    const before: State = { ...state, foods: [counted], meals: [], entries: [] };
    const withEntry = loggedState(before, 'egg', '3', 'count');
    expect(withEntry.entries[0]!.unit).to.equal('count');

    const after = reducer(withEntry, {
      type: 'EditFood', foodId: 'egg',
      updates: { servingUnit: 'g', servingSize: 50, pieces: { perServing: 3 } },
    });

    expect(after.entries[0]!.unit).to.equal('g');
    expect(after.entries[0]!.amount).to.equal(50);
    expect(after.entries[0]!.shown).to.deep.equal({ amount: 3, unit: 'count' });
  });
});

describe('reducer — SoftDeleteFood', () => {
  it('sets deletedAt on a live food', () => {
    const before: State = { version: 2, enabledSources: defaultEnabledSources(), foods: [validFood('f-live')], meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings() };
    const ts = '2026-05-23T10:00:00Z';
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'f-live', deletedAt: ts });
    expect(after.foods.find((f) => f.id === 'f-live')!.deletedAt).to.equal(ts);
  });

  it('is a no-op on unknown id', () => {
    const before = freshState();
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'no-such', deletedAt: '2026-05-23T10:00:00Z' });
    expect(after).to.equal(before);
  });

  it('is a no-op when food is already soft-deleted', () => {
    const before: State = {
      version: 2, enabledSources: defaultEnabledSources(),
      foods: [{ ...validFood('d1'), deletedAt: '2026-05-22T00:00:00Z' }],
      meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings(),
    };
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'd1', deletedAt: '2026-05-23T10:00:00Z' });
    expect(after).to.equal(before);
  });

  it('leaves entries that reference the food intact', () => {
    const before: State = {
      version: 2, enabledSources: defaultEnabledSources(),
      foods: [validFood('f1')],
      meals: [], entries: [{ id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 100, unit: 'g' as const, loggedAt: '2026-05-23T10:00:00Z' }],
      recipes: [], recipeLogs: [], settings: defaultSettings(),
    };
    const after = reducer(before, { type: 'SoftDeleteFood', foodId: 'f1', deletedAt: '2026-05-23T10:00:00Z' });
    expect(after.entries).to.deep.equal(before.entries);
  });
});

describe('reducer — ReviveFood', () => {
  const deadState = (): State => ({
    version: 2,
    enabledSources: defaultEnabledSources(),
    foods: [{ ...validFood('d1'), deletedAt: '2026-05-22T00:00:00Z' }],
    meals: [],
    entries: [],
    recipes: [],
    recipeLogs: [],
    settings: defaultSettings(),
  });

  it('replaces the soft-deleted record with the payload and clears deletedAt', () => {
    const refreshed = { ...validFood('d1'), nutritionFacts: { calories: 99, protein: 1, carbs: 2, fat: 3 } };
    const after = reducer(deadState(), { type: 'ReviveFood', food: refreshed });
    const revived = after.foods.find((f) => f.id === 'd1')!;
    expect(revived.deletedAt).to.equal(null);
    expect(revived.nutritionFacts.calories).to.equal(99);
  });

  it('is a no-op on unknown id', () => {
    const before = freshState();
    const after = reducer(before, { type: 'ReviveFood', food: validFood('no-such') });
    expect(after).to.equal(before);
  });

  it('is a no-op when food is already live', () => {
    const before: State = { version: 2, enabledSources: defaultEnabledSources(), foods: [validFood('f-live')], meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings() };
    const after = reducer(before, { type: 'ReviveFood', food: validFood('f-live') });
    expect(after).to.equal(before);
  });

  it('is a no-op when the payload is invalid', () => {
    const before = deadState();
    const bad = { ...validFood('d1'), nutritionFacts: { calories: -1, protein: 0, carbs: 0, fat: 0 } };
    const after = reducer(before, { type: 'ReviveFood', food: bad });
    expect(after).to.equal(before);
  });

  it('is a no-op when another live food already uses the payload\'s name', () => {
    const before: State = { ...deadState(), foods: [...deadState().foods, { ...validFood('live-1'), name: 'Custom food' }] };
    const after = reducer(before, { type: 'ReviveFood', food: validFood('d1') });
    expect(after).to.equal(before);
  });

  it('is a no-op when the payload itself is marked deleted', () => {
    const before = deadState();
    const stillDead = { ...validFood('d1'), deletedAt: '2026-05-23T00:00:00Z' };
    const after = reducer(before, { type: 'ReviveFood', food: stillDead });
    expect(after).to.equal(before);
  });

  it('rejects an axis-changing revive when entries reference the food', () => {
    const before: State = {
      ...deadState(),
      meals: [{ id: 'm1', date: '2026-05-23', position: 0 }],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'd1', amount: 250, unit: 'g', mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const countShape = { ...validFood('d1'), servingSize: 1, servingUnit: 'count' as const };
    const after = reducer(before, { type: 'ReviveFood', food: countShape });
    expect(after).to.equal(before);
  });

  it('allows an axis-changing revive when no entries reference the food', () => {
    const countShape = { ...validFood('d1'), servingSize: 1, servingUnit: 'count' as const };
    const after = reducer(deadState(), { type: 'ReviveFood', food: countShape });
    expect(after.foods.find((f) => f.id === 'd1')!.servingUnit).to.equal('count');
  });

  it('allows a same-axis revive when entries reference the food', () => {
    const before: State = {
      ...deadState(),
      meals: [{ id: 'm1', date: '2026-05-23', position: 0 }],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'd1', amount: 250, unit: 'g', mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const refreshed = { ...validFood('d1'), servingSize: 50 };
    const after = reducer(before, { type: 'ReviveFood', food: refreshed });
    expect(after.foods.find((f) => f.id === 'd1')!.servingSize).to.equal(50);
  });

  it('revives with the payload\'s pieces', () => {
    const withPieces = { ...validFood('d1'), pieces: { perServing: 8, noun: 'cookies' } };
    const after = reducer(deadState(), { type: 'ReviveFood', food: withPieces });
    expect(after.foods.find((f) => f.id === 'd1')!.pieces).to.deep.equal({ perServing: 8, noun: 'cookies' });
  });

  // Logging happens while the food is still live (ReviveFood only replaces a
  // dead one), then it's soft-deleted, so the entry it left behind is exactly
  // what a real revive scenario would meet.
  function loggedThenDead(food: Food, amount: string, unit: string): State {
    const alive: State = { version: 2, enabledSources: defaultEnabledSources(), foods: [food], meals: [], entries: [], recipes: [], recipeLogs: [], settings: defaultSettings() };
    const withEntry = loggedState(alive, food.id, amount, unit);
    return reducer(withEntry, { type: 'SoftDeleteFood', foodId: food.id, deletedAt: '2026-05-22T00:00:00Z' });
  }

  it('allows a revive that removes pieces while a count-shown entry references the food, leaving it unaffected', () => {
    const withPieces: Food = { ...validFood('d1'), pieces: { perServing: 8, noun: 'cookies' } };
    const before = loggedThenDead(withPieces, '2', 'count');

    const after = reducer(before, { type: 'ReviveFood', food: validFood('d1') });

    expect(after.foods.find((f) => f.id === 'd1')!.pieces).to.equal(undefined);
    expect(after.entries[0]).to.deep.equal(before.entries[0]);
  });

  // Same invariant as EditFood: a past count entry is physical grams, frozen
  // at log time, so a revived catalog food with a different piece weight
  // (118 g -> 182 g, same density) must not change its calories.
  it('leaves a past count entry\'s calories unaffected by a revived food with a different piece weight', () => {
    const bar: Food = { ...validFood('d1'), servingSize: 118, nutritionFacts: { calories: 118, protein: 0, carbs: 0, fat: 0 }, pieces: { perServing: 1 } };
    const before = loggedThenDead(bar, '2', 'count');

    const repackaged = { ...validFood('d1'), servingSize: 182, nutritionFacts: { calories: 182, protein: 0, carbs: 0, fat: 0 }, pieces: { perServing: 1 } };
    const after = reducer(before, { type: 'ReviveFood', food: repackaged });

    expect(after.foods.find((f) => f.id === 'd1')!.servingSize).to.equal(182);
    expect(entryCalories(after.entries[0]!, after.foods.find((f) => f.id === 'd1')!)).to.equal(236);
  });

  // A stored row must never read 'count' against a food's current pieces —
  // reviving a formerly counted food into a weight food with pieces must
  // convert its count entries then, the same as EditFood.
  it('converts a counted food\'s count entries when it\'s revived as a weight food with pieces', () => {
    const counted: Food = { ...validFood('d1'), servingSize: 1, servingUnit: 'count' };
    const before = loggedThenDead(counted, '3', 'count');
    expect(before.entries[0]!.unit).to.equal('count');

    const repackaged: Food = { ...validFood('d1'), servingSize: 50, servingUnit: 'g', pieces: { perServing: 3 } };
    const after = reducer(before, { type: 'ReviveFood', food: repackaged });

    expect(after.entries[0]!.unit).to.equal('g');
    expect(after.entries[0]!.amount).to.equal(50);
    expect(after.entries[0]!.shown).to.deep.equal({ amount: 3, unit: 'count' });
  });
});

describe('reducer — ReplaceState', () => {
  it('swaps the entire state', () => {
    const next: State = {
      version: 1,
      foods: [validFood('only')],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'only', amount: 100, unit: 'g' as const, loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const after = reducer(freshState(), { type: 'ReplaceState', state: next });
    expect(after).to.equal(next);
  });
});
