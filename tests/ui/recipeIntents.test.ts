import { expect } from '@esm-bundle/chai';
import {
  draftForRecipe, parseRecipeDraft, parseRecipeIntent, parseRecipeLogIntent,
} from '../../src/ui/recipeIntents.js';
import type { RecipeDraft, RecipeFormItem } from '../../src/ui/recipeIntents.js';
import { defaultEnabledSources } from '../../src/domain/foodSources.js';
import type { Food, Recipe, State } from '../../src/domain/types.js';

const fixedClock = () => ({
  now: () => new Date('2026-05-23T10:00:00.000Z'),
  newId: () => 'new-id-1',
});

const seqClock = () => {
  let i = 0;
  return {
    now: () => new Date('2026-05-23T10:00:00.000Z'),
    newId: () => `id-${++i}`,
  };
};

const egg: Food = {
  id: 'egg', name: 'Egg',
  nutritionFacts: { calories: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
  servingSize: 1, servingUnit: 'count',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const ham: Food = {
  id: 'ham', name: 'Ham',
  nutritionFacts: { calories: 46, protein: 5.5, carbs: 1.5, fat: 1.4 },
  servingSize: 28, servingUnit: 'g',
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

const omelette: Recipe = {
  id: 'r1', name: 'Omelette',
  items: [
    { foodId: 'egg', amount: 3, unit: 'count' },
    { foodId: 'ham', amount: 56, unit: 'g' },
  ],
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

function stateWith(foods: Food[], recipes: Recipe[] = []): State {
  return { version: 2, enabledSources: defaultEnabledSources(), foods, meals: [], entries: [], recipes, recipeLogs: [] };
}

const item = (overrides: Partial<RecipeFormItem> = {}): RecipeFormItem =>
  ({ foodId: 'egg', amount: '3', unit: 'count', ...overrides });

describe('parseRecipeIntent — add', () => {
  it('returns AddRecipe with a fresh id, createdAt and deletedAt null', () => {
    const r = parseRecipeIntent(
      { mode: 'add', name: 'Omelette', items: [item(), item({ foodId: 'ham', amount: '56', unit: 'g' })] },
      stateWith([egg, ham]),
      fixedClock(),
    );
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'AddRecipe') {
      throw new Error();
    }

    expect(r.action.recipe).to.deep.equal({
      id: 'new-id-1',
      name: 'Omelette',
      items: [
        { foodId: 'egg', amount: 3, unit: 'count' },
        { foodId: 'ham', amount: 56, unit: 'g' },
      ],
      createdAt: '2026-05-23T10:00:00.000Z',
      deletedAt: null,
    });
  });

  it('rejects an empty name', () => {
    const r = parseRecipeIntent({ mode: 'add', name: '  ', items: [item()] }, stateWith([egg]), fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter a name.' });
  });

  it('rejects a name a live recipe already uses', () => {
    const r = parseRecipeIntent({ mode: 'add', name: 'OMELETTE', items: [item()] }, stateWith([egg], [omelette]), fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'A recipe with this name already exists.' });
  });

  it('allows a name only a soft-deleted recipe used', () => {
    const deleted: Recipe = { ...omelette, deletedAt: '2026-02-01T00:00:00Z' };
    const r = parseRecipeIntent({ mode: 'add', name: 'Omelette', items: [item()] }, stateWith([egg], [deleted]), fixedClock());
    expect(r.kind).to.equal('action');
  });

  it('rejects zero items', () => {
    const r = parseRecipeIntent({ mode: 'add', name: 'Omelette', items: [] }, stateWith([egg]), fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Add at least one food.' });
  });

  it('rejects an item whose food is missing', () => {
    const r = parseRecipeIntent({ mode: 'add', name: 'Omelette', items: [item({ foodId: 'missing' })] }, stateWith([egg]), fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'One of the foods is no longer available.' });
  });

  it('rejects an item whose food is soft-deleted', () => {
    const deadEgg: Food = { ...egg, deletedAt: '2026-02-01T00:00:00Z' };
    const r = parseRecipeIntent({ mode: 'add', name: 'Omelette', items: [item()] }, stateWith([deadEgg]), fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'One of the foods is no longer available.' });
  });

  it('rejects an invalid unit string', () => {
    const r = parseRecipeIntent({ mode: 'add', name: 'Omelette', items: [item({ unit: 'tsp' })] }, stateWith([egg]), fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a unit for every item.' });
  });

  it('rejects a unit incompatible with the food (weight unit on a count food)', () => {
    const r = parseRecipeIntent({ mode: 'add', name: 'Omelette', items: [item({ unit: 'g' })] }, stateWith([egg]), fixedClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Pick a unit for every item.' });
  });

  it('rejects a non-positive or non-numeric amount', () => {
    for (const amount of ['', '0', '-1', 'abc']) {
      const r = parseRecipeIntent({ mode: 'add', name: 'Omelette', items: [item({ amount })] }, stateWith([egg]), fixedClock());
      expect(r, amount).to.deep.equal({ kind: 'error', message: 'Every item needs an amount greater than 0.' });
    }
  });

  it('rejects two items sharing a food', () => {
    const r = parseRecipeIntent(
      { mode: 'add', name: 'Omelette', items: [item(), item({ amount: '2' })] },
      stateWith([egg]),
      fixedClock(),
    );
    expect(r).to.deep.equal({ kind: 'error', message: 'Each food can only appear once.' });
  });
});

describe('parseRecipeIntent — edit', () => {
  it('returns EditRecipe with the parsed name and items', () => {
    const r = parseRecipeIntent(
      { mode: 'edit', recipeId: 'r1', name: 'Frittata', items: [item({ amount: '4' })] },
      stateWith([egg], [omelette]),
      fixedClock(),
    );
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'EditRecipe') {
      throw new Error();
    }

    expect(r.action.recipeId).to.equal('r1');
    expect(r.action.updates).to.deep.equal({
      name: 'Frittata',
      items: [{ foodId: 'egg', amount: 4, unit: 'count' }],
    });
  });

  it('allows keeping its own name', () => {
    const r = parseRecipeIntent(
      { mode: 'edit', recipeId: 'r1', name: 'Omelette', items: [item()] },
      stateWith([egg], [omelette]),
      fixedClock(),
    );
    expect(r.kind).to.equal('action');
  });

  it('rejects renaming onto another live recipe\'s name', () => {
    const scramble: Recipe = { id: 'r2', name: 'Scramble', items: [{ foodId: 'egg', amount: 2, unit: 'count' }], createdAt: '2026-01-01T00:00:00Z', deletedAt: null };
    const r = parseRecipeIntent(
      { mode: 'edit', recipeId: 'r2', name: 'OMELETTE', items: [item()] },
      stateWith([egg], [omelette, scramble]),
      fixedClock(),
    );
    expect(r.kind).to.equal('error');
  });

  it('errors with "This recipe was deleted." for an unknown recipeId', () => {
    const r = parseRecipeIntent(
      { mode: 'edit', recipeId: 'nope', name: 'X', items: [item()] },
      stateWith([egg], [omelette]),
      fixedClock(),
    );
    expect(r).to.deep.equal({ kind: 'error', message: 'This recipe was deleted.' });
  });

  it('errors with "This recipe was deleted." when the recipe has been soft-deleted since the form opened', () => {
    const deleted: Recipe = { ...omelette, deletedAt: '2026-02-01T00:00:00Z' };
    const r = parseRecipeIntent(
      { mode: 'edit', recipeId: 'r1', name: 'X', items: [item()] },
      stateWith([egg], [deleted]),
      fixedClock(),
    );
    expect(r).to.deep.equal({ kind: 'error', message: 'This recipe was deleted.' });
  });
});

describe('draftForRecipe', () => {
  it('builds amounts keyed by foodId with servings defaulted to 1', () => {
    expect(draftForRecipe(omelette)).to.deep.equal({
      recipeId: 'r1',
      amounts: { egg: '3', ham: '56' },
      servings: '1',
    });
  });
});

describe('parseRecipeDraft', () => {
  const draft = (overrides: Partial<RecipeDraft> = {}): RecipeDraft =>
    ({ recipeId: 'r1', amounts: { egg: '3', ham: '56' }, servings: '1', ...overrides });

  it('returns ok with the parsed servings and one portion per item', () => {
    const r = parseRecipeDraft(draft(), omelette);
    expect(r).to.deep.equal({
      kind: 'ok',
      servings: 1,
      portions: [
        { foodId: 'egg', amount: 3, unit: 'count' },
        { foodId: 'ham', amount: 56, unit: 'g' },
      ],
    });
  });

  it('rejects non-positive or non-numeric servings', () => {
    for (const servings of ['', '0', '-1', 'abc']) {
      const r = parseRecipeDraft(draft({ servings }), omelette);
      expect(r, servings).to.deep.equal({ kind: 'error', message: 'Enter servings greater than 0.' });
    }
  });

  it('treats a blank amount as skipped (null portion)', () => {
    const r = parseRecipeDraft(draft({ amounts: { egg: '', ham: '56' } }), omelette);
    expect(r.kind).to.equal('ok');
    if (r.kind !== 'ok') throw new Error();
    expect(r.portions).to.deep.equal([null, { foodId: 'ham', amount: 56, unit: 'g' }]);
  });

  it('treats a numeric-zero amount as skipped (null portion)', () => {
    const r = parseRecipeDraft(draft({ amounts: { egg: '0', ham: '56' } }), omelette);
    expect(r.kind).to.equal('ok');
    if (r.kind !== 'ok') throw new Error();
    expect(r.portions).to.deep.equal([null, { foodId: 'ham', amount: 56, unit: 'g' }]);
  });

  it('treats an item with no amount key as blank', () => {
    const r = parseRecipeDraft(draft({ amounts: { egg: '3' } }), omelette);
    expect(r.kind).to.equal('ok');
    if (r.kind !== 'ok') throw new Error();
    expect(r.portions).to.deep.equal([{ foodId: 'egg', amount: 3, unit: 'count' }, null]);
  });

  it('keys amounts by foodId, surviving the recipe\'s items being reordered', () => {
    const reordered: Recipe = { ...omelette, items: [...omelette.items].reverse() };
    const r = parseRecipeDraft(draft({ amounts: { egg: '1', ham: '20' } }), reordered);
    expect(r.kind).to.equal('ok');
    if (r.kind !== 'ok') {
      throw new Error();
    }

    expect(r.portions).to.deep.equal([
      { foodId: 'ham', amount: 20, unit: 'g' },
      { foodId: 'egg', amount: 1, unit: 'count' },
    ]);
  });

  it('rejects a negative or non-numeric non-blank amount', () => {
    for (const amounts of [{ egg: '-1', ham: '56' }, { egg: 'abc', ham: '56' }]) {
      const r = parseRecipeDraft(draft({ amounts }), omelette);
      expect(r, JSON.stringify(amounts)).to.deep.equal({ kind: 'error', message: 'Enter amounts of 0 or more.' });
    }
  });

  it('rejects when every amount is blank', () => {
    const r = parseRecipeDraft(draft({ amounts: { egg: '', ham: '' } }), omelette);
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter at least one amount greater than 0.' });
  });
});

describe('parseRecipeLogIntent', () => {
  const state = (): State => stateWith([egg, ham], [omelette]);

  it('writes a LogRecipe action with amounts scaled by servings', () => {
    const draft: RecipeDraft = { recipeId: 'r1', amounts: { egg: '3', ham: '56' }, servings: '2' };
    const r = parseRecipeLogIntent(draft, '2026-05-23', state(), seqClock());
    expect(r.kind).to.equal('action');
    if (r.kind !== 'action' || r.action.type !== 'LogRecipe') {
      throw new Error();
    }

    expect(r.action.recipeLog).to.deep.equal({ id: 'id-1', recipeId: 'r1', servings: 2 });
    expect(r.action.entries).to.deep.equal([
      { id: 'id-2', date: '2026-05-23', foodId: 'egg', amount: 6, unit: 'count', loggedAt: '2026-05-23T10:00:00.000Z' },
      { id: 'id-3', date: '2026-05-23', foodId: 'ham', amount: 112, unit: 'g', loggedAt: '2026-05-23T10:00:00.000Z' },
    ]);
    expect(r.action.newMealId).to.equal('id-4');
  });

  it('skips a null portion and only logs the remaining ones', () => {
    const draft: RecipeDraft = { recipeId: 'r1', amounts: { egg: '3', ham: '' }, servings: '1' };
    const r = parseRecipeLogIntent(draft, '2026-05-23', state(), seqClock());
    if (r.kind !== 'action' || r.action.type !== 'LogRecipe') throw new Error();
    expect(r.action.entries).to.have.lengthOf(1);
    expect(r.action.entries[0]!.foodId).to.equal('egg');
  });

  it('rounds a floating-point amount to 4 decimal places', () => {
    const withHam: Recipe = { ...omelette, items: [{ foodId: 'ham', amount: 1.1, unit: 'g' }] };
    const draft: RecipeDraft = { recipeId: 'r1', amounts: { ham: '1.1' }, servings: '3' };
    const r = parseRecipeLogIntent(draft, '2026-05-23', stateWith([ham], [withHam]), seqClock());
    if (r.kind !== 'action' || r.action.type !== 'LogRecipe') throw new Error();
    expect(r.action.entries[0]!.amount).to.equal(3.3);
  });

  it('errors when amount × servings overflows to a non-finite number', () => {
    const draft: RecipeDraft = { recipeId: 'r1', amounts: { egg: '1e308', ham: '' }, servings: '2' };
    const r = parseRecipeLogIntent(draft, '2026-05-23', state(), seqClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Amount × servings must be greater than 0.' });
  });

  it('errors when amount × servings rounds down to zero', () => {
    const draft: RecipeDraft = { recipeId: 'r1', amounts: { egg: '0.00001', ham: '' }, servings: '1' };
    const r = parseRecipeLogIntent(draft, '2026-05-23', state(), seqClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Amount × servings must be greater than 0.' });
  });

  it('errors when the recipe is missing', () => {
    const draft: RecipeDraft = { recipeId: 'nope', amounts: {}, servings: '1' };
    const r = parseRecipeLogIntent(draft, '2026-05-23', state(), seqClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'This recipe was deleted.' });
  });

  it('errors when the recipe is soft-deleted', () => {
    const deleted: Recipe = { ...omelette, deletedAt: '2026-02-01T00:00:00Z' };
    const draft: RecipeDraft = { recipeId: 'r1', amounts: { egg: '3', ham: '56' }, servings: '1' };
    const r = parseRecipeLogIntent(draft, '2026-05-23', stateWith([egg, ham], [deleted]), seqClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'This recipe was deleted.' });
  });

  it('propagates a parseRecipeDraft error', () => {
    const draft: RecipeDraft = { recipeId: 'r1', amounts: { egg: '', ham: '' }, servings: '1' };
    const r = parseRecipeLogIntent(draft, '2026-05-23', state(), seqClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Enter at least one amount greater than 0.' });
  });

  it('errors when a non-null portion\'s food has been soft-deleted since', () => {
    const deadHam: Food = { ...ham, deletedAt: '2026-02-01T00:00:00Z' };
    const draft: RecipeDraft = { recipeId: 'r1', amounts: { egg: '3', ham: '56' }, servings: '1' };
    const r = parseRecipeLogIntent(draft, '2026-05-23', stateWith([egg, deadHam], [omelette]), seqClock());
    expect(r).to.deep.equal({ kind: 'error', message: 'Ham was deleted. Edit the recipe.' });
  });
});
