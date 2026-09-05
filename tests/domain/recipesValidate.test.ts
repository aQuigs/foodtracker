import { expect } from '@esm-bundle/chai';
import { parseState } from '../../src/domain/validate.js';

const makeId = (() => {
  let i = 0;
  return () => `gen-${++i}`;
})();

const foodBase = {
  nutritionFacts: { calories: 1, protein: 1, carbs: 1, fat: 1 },
  servingSize: 100, servingUnit: 'g',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const food = (overrides: Partial<Record<string, unknown>> = {}) => ({
  ...foodBase, id: 'egg', name: 'Egg', ...overrides,
});

const meal = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'm1', date: '2026-05-23', position: 0, ...overrides,
});

const entry = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'e1', date: '2026-05-23', foodId: 'egg', amount: 3, unit: 'g',
  mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z', ...overrides,
});

const recipe = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'r1', name: 'Omelette',
  items: [{ foodId: 'egg', amount: 3, unit: 'g' }],
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
  ...overrides,
});

const recipeLog = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'rl1', recipeId: 'r1', servings: 2, ...overrides,
});

function blob(fields: Record<string, unknown>): string {
  return JSON.stringify({
    version: 2, foods: [food()], meals: [meal()], entries: [entry()],
    ...fields,
  });
}

describe('parseState — recipes/recipeLogs', () => {
  it('defaults recipes and recipeLogs to [] when absent from a v2 blob, keeping other data', () => {
    const s = parseState(blob({}), makeId)!;
    expect(s.recipes).to.deep.equal([]);
    expect(s.recipeLogs).to.deep.equal([]);
    expect(s.foods).to.have.lengthOf(1);
    expect(s.entries).to.have.lengthOf(1);
  });

  it('defaults recipes and recipeLogs to [] after a v1 migration', () => {
    const raw = JSON.stringify({
      version: 1,
      foods: [food()],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'egg', amount: 3, unit: 'g', loggedAt: '2026-05-23T10:00:00Z' }],
    });
    const s = parseState(raw, makeId)!;
    expect(s.recipes).to.deep.equal([]);
    expect(s.recipeLogs).to.deep.equal([]);
    expect(s.entries).to.have.lengthOf(1);
  });

  it('renames a later duplicate live recipe name, same as foods', () => {
    const s = parseState(blob({
      recipes: [recipe(), recipe({ id: 'r2' })],
    }), makeId)!;
    expect(s.recipes.map((r) => r.name)).to.deep.equal(['Omelette', 'Omelette (2)']);
  });

  it('round-trips a well-formed recipe and recipeLog', () => {
    const s = parseState(blob({ recipes: [recipe()], recipeLogs: [recipeLog()], entries: [entry({ recipeLogId: 'rl1' })] }), makeId)!;
    expect(s.recipes).to.deep.equal([recipe()]);
    expect(s.recipeLogs).to.deep.equal([recipeLog()]);
    expect(s.entries[0]!.recipeLogId).to.equal('rl1');
  });

  it('rejects the whole blob when recipes is present but not an array', () => {
    expect(parseState(blob({ recipes: 'nope' }), makeId)).to.equal(null);
  });

  it('rejects a recipe missing required fields', () => {
    for (const bad of [
      recipe({ id: '' }),
      recipe({ name: '' }),
      recipe({ createdAt: '' }),
      recipe({ deletedAt: 42 }),
      recipe({ items: 'nope' }),
    ]) {
      expect(parseState(blob({ recipes: [bad] }), makeId), JSON.stringify(bad)).to.equal(null);
    }
  });

  it('rejects a recipe with zero items', () => {
    expect(parseState(blob({ recipes: [recipe({ items: [] })] }), makeId)).to.equal(null);
  });

  it('rejects a recipe whose items share a foodId', () => {
    const dup = recipe({ items: [{ foodId: 'egg', amount: 1, unit: 'g' }, { foodId: 'egg', amount: 2, unit: 'g' }] });
    expect(parseState(blob({ recipes: [dup] }), makeId)).to.equal(null);
  });

  it('rejects a recipe item with an empty foodId, a foodId naming no food, a non-positive amount, or an invalid unit', () => {
    for (const item of [
      { foodId: '', amount: 1, unit: 'g' },
      { foodId: 'missing-food', amount: 1, unit: 'g' },
      { foodId: 'egg', amount: 0, unit: 'g' },
      { foodId: 'egg', amount: -1, unit: 'g' },
      { foodId: 'egg', amount: 1, unit: 'tsp' },
    ]) {
      expect(parseState(blob({ recipes: [recipe({ items: [item] })] }), makeId), JSON.stringify(item)).to.equal(null);
    }
  });

  it('accepts a recipe item referencing a soft-deleted food (history from a pasted backup)', () => {
    const deadFood = food({ id: 'dead', deletedAt: '2026-01-02T00:00:00Z' });
    const s = parseState(blob({ foods: [food(), deadFood], recipes: [recipe({ items: [{ foodId: 'dead', amount: 1, unit: 'g' }] })] }), makeId)!;
    expect(s.recipes).to.have.lengthOf(1);
  });

  it('rejects the whole blob when recipeLogs is present but not an array', () => {
    expect(parseState(blob({ recipeLogs: 'nope' }), makeId)).to.equal(null);
  });

  it('rejects a recipeLog missing required fields or naming no recipe', () => {
    for (const bad of [
      recipeLog({ id: '' }),
      recipeLog({ recipeId: '' }),
      recipeLog({ recipeId: 'no-such-recipe' }),
      recipeLog({ servings: 0 }),
      recipeLog({ servings: -1 }),
    ]) {
      expect(parseState(blob({ recipes: [recipe()], recipeLogs: [bad] }), makeId), JSON.stringify(bad)).to.equal(null);
    }
  });

  it('keeps a valid entry.recipeLogId that names an existing recipeLog', () => {
    const s = parseState(blob({ recipes: [recipe()], recipeLogs: [recipeLog()], entries: [entry({ recipeLogId: 'rl1' })] }), makeId)!;
    expect(s.entries[0]!.recipeLogId).to.equal('rl1');
  });

  it('drops entry.recipeLogId when it names no recipeLog, loading the entry ungrouped instead of rejecting the blob', () => {
    const s = parseState(blob({ entries: [entry({ recipeLogId: 'no-such-log' })] }), makeId)!;
    expect(s.entries).to.have.lengthOf(1);
    expect(s.entries[0]!.recipeLogId).to.equal(undefined);
  });

  it('drops entry.recipeLogId when it is an empty string', () => {
    const s = parseState(blob({ entries: [entry({ recipeLogId: '' })] }), makeId)!;
    expect(s.entries[0]!.recipeLogId).to.equal(undefined);
  });

  it('drops entry.recipeLogId when it is not a string', () => {
    const s = parseState(blob({ entries: [entry({ recipeLogId: 42 })] }), makeId)!;
    expect(s.entries[0]!.recipeLogId).to.equal(undefined);
  });

  it('leaves entry.recipeLogId absent when the field is absent', () => {
    const s = parseState(blob({}), makeId)!;
    expect(s.entries[0]!.recipeLogId).to.equal(undefined);
  });

  it('drops a recipeLog that no entry references', () => {
    const s = parseState(blob({ recipes: [recipe()], recipeLogs: [recipeLog()] }), makeId)!;
    expect(s.recipeLogs).to.deep.equal([]);
  });

  it('keeps a recipeLog referenced by at least one entry among several', () => {
    const s = parseState(blob({
      recipes: [recipe()],
      recipeLogs: [recipeLog(), recipeLog({ id: 'rl2' })],
      entries: [entry({ recipeLogId: 'rl2' })],
    }), makeId)!;
    expect(s.recipeLogs).to.deep.equal([recipeLog({ id: 'rl2' })]);
  });

  it('still rejects the blob when an entry references a meal id not in meals', () => {
    expect(parseState(blob({ entries: [entry({ mealId: 'nonexistent' })] }), makeId)).to.equal(null);
  });
});
