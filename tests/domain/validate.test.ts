import { expect } from '@esm-bundle/chai';
import { isSourcedFood, parseState, parseStateReport } from '../../src/domain/validate.js';
import { STORE_BUNDLES, brandSource } from '../../src/domain/foodSources.js';

const nutritionFacts = { calories: 100, protein: 5, carbs: 10, fat: 2 };

function food(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    nutritionFacts, servingSize: 100, servingUnit: 'g',
    createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    ...overrides,
  };
}

function blob(foods: Record<string, unknown>[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ version: 2, foods, meals: [], entries: [], ...extra });
}

let nextId = 0;
const makeId = (): string => `gen-${nextId++}`;

describe('isSourcedFood() with a brand', () => {
  const sourced = {
    id: 'brand:chobani:1',
    name: 'Greek yogurt, blueberry',
    brand: 'Chobani',
    nutritionFacts,
    servingSize: 100,
    servingUnit: 'g',
    source: 'brand:chobani',
    sourceId: '1',
    tags: ['Yogurt'],
  };

  it('accepts a row carrying a brand label and one without', () => {
    expect(isSourcedFood(sourced)).to.equal(true);

    const { brand: _brand, ...untagged } = sourced;
    expect(isSourcedFood(untagged)).to.equal(true);
  });

  it('rejects an empty or non-string brand', () => {
    expect(isSourcedFood({ ...sourced, brand: '' })).to.equal(false);
    expect(isSourcedFood({ ...sourced, brand: 7 })).to.equal(false);
  });
});

describe('isSourcedFood() with pieces', () => {
  const sourced = {
    id: 'brand:chobani:1',
    name: 'Mixed berry vanilla drink',
    brand: 'Chobani',
    nutritionFacts,
    servingSize: 296,
    servingUnit: 'ml',
    source: 'brand:chobani',
    sourceId: '1',
  };

  it('accepts a food with no pieces, and pieces with or without a noun', () => {
    expect(isSourcedFood(sourced)).to.equal(true);
    expect(isSourcedFood({ ...sourced, pieces: { perServing: 1, noun: 'bottle' } })).to.equal(true);
    expect(isSourcedFood({ ...sourced, pieces: { perServing: 1 } })).to.equal(true);
  });

  it('rejects a non-positive or non-finite perServing, an empty or non-string noun, and pieces on a count food', () => {
    const cases = [
      { ...sourced, pieces: { perServing: 0 } },
      { ...sourced, pieces: { perServing: -1 } },
      { ...sourced, pieces: { perServing: Infinity } },
      { ...sourced, pieces: { perServing: 1, noun: '' } },
      { ...sourced, pieces: { perServing: 1, noun: 7 } },
      { ...sourced, servingUnit: 'count', pieces: { perServing: 1, noun: 'egg' } },
    ];

    for (const c of cases) {
      expect(isSourcedFood(c), JSON.stringify(c.pieces)).to.equal(false);
    }
  });
});

describe('parseState — pieces on a user food', () => {
  it('loads a food with no pieces, and one with pieces and a noun', () => {
    const state = parseState(blob([
      food({ id: 'a', name: 'Chobani drink', servingSize: 296, servingUnit: 'ml' }),
      food({ id: 'b', name: 'Cookies', servingSize: 30, servingUnit: 'g', pieces: { perServing: 8, noun: 'cookies' } }),
    ]), makeId)!;

    expect(state.foods[0]!.pieces).to.equal(undefined);
    expect(state.foods[1]!.pieces).to.deep.equal({ perServing: 8, noun: 'cookies' });
  });

  // An edit that merges over a food's existing keys can keep its pieces
  // across a switch to servingUnit 'count', where they no longer fit — a
  // legitimate sequence a stricter build then has to read back, not a
  // corrupt blob.
  it('strips malformed pieces, or pieces on a count food, instead of rejecting the blob', () => {
    const cases = [
      { pieces: { perServing: 0 } },
      { pieces: { perServing: 1, noun: '' } },
      { servingSize: 1, servingUnit: 'count', pieces: { perServing: 1, noun: 'egg' } },
    ];

    for (const c of cases) {
      const state = parseState(blob([food({ id: 'a', name: 'X', ...c })]), makeId);
      expect(state, JSON.stringify(c)).to.not.equal(null);
      expect(state!.foods[0]!.pieces).to.equal(undefined);
    }
  });
});

describe('parseStateReport — lossy imports', () => {
  it('is not lossy when only a food\'s unusable pieces were dropped', () => {
    const raw = blob([food({
      id: 'egg', name: 'Egg', servingSize: 1, servingUnit: 'count', pieces: { perServing: 1 },
    })]);
    const report = parseStateReport(raw, makeId)!;
    expect(report.lossy).to.equal(false);
  });

  it('is lossy when an entry, a recipe item, or a recipe left with none was dropped', () => {
    const meal1 = { id: 'm1', date: '2026-05-23', position: 0 };
    const raw = blob([food({ id: 'a', name: 'Drink' })], {
      meals: [meal1],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'a', amount: 1, unit: 'floz', mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z' }],
      recipes: [{ id: 'r1', name: 'Smoothie', createdAt: '2026-01-01T00:00:00Z', deletedAt: null, items: [{ foodId: 'a', amount: 1, unit: 'floz' }] }],
    });
    const report = parseStateReport(raw, makeId)!;
    expect(report.lossy).to.equal(true);
    expect(report.state.entries).to.deep.equal([]);
    expect(report.state.recipes).to.deep.equal([]);
  });
});

describe('parseState — duplicate live names', () => {
  it('leaves a same-named pair from two different brands alone', () => {
    const state = parseState(blob([
      food({ id: 'brand:kirkland-signature:1', name: 'Almonds', brand: 'Kirkland Signature', source: 'brand:kirkland-signature' }),
      food({ id: 'brand:great-value:1', name: 'Almonds', brand: 'Great Value', source: 'brand:great-value' }),
    ]), makeId)!;

    expect(state.foods.map((f) => f.name)).to.deep.equal(['Almonds', 'Almonds']);
  });

  it('suffixes a same-named pair of one brand', () => {
    const state = parseState(blob([
      food({ id: 'a', name: 'Almonds', brand: 'Kirkland Signature' }),
      food({ id: 'b', name: 'Almonds', brand: 'Kirkland Signature' }),
    ]), makeId)!;

    expect(state.foods.map((f) => f.name)).to.deep.equal(['Almonds', 'Almonds (2)']);
  });
});

describe('parseState — brand on a food', () => {
  it('keeps a brand and loads a food without one', () => {
    const state = parseState(blob([
      food({ id: 'a', name: 'Almonds', brand: 'Kirkland Signature' }),
      food({ id: 'b', name: 'Oats' }),
    ]), makeId)!;

    expect(state.foods[0]!.brand).to.equal('Kirkland Signature');
    expect(state.foods[1]!.brand).to.equal(undefined);
  });

  it('rejects the blob when a brand is empty or not a string', () => {
    expect(parseState(blob([food({ id: 'a', name: 'Almonds', brand: '' })]), makeId)).to.equal(null);
    expect(parseState(blob([food({ id: 'a', name: 'Almonds', brand: 3 })]), makeId)).to.equal(null);
  });
});

describe('parseState — foods added from a store pack before brands were on the row', () => {
  it('stamps the store\'s label as the brand, so identity and tag are unchanged', () => {
    const state = parseState(blob([food({ id: 'costco:1', name: 'Almonds', source: 'costco' })]), makeId)!;
    expect(state.foods[0]!.brand).to.equal(STORE_BUNDLES.get('costco')!.label);
    expect(state.foods[0]!.source).to.equal('costco');
  });

  it('leaves a food that already carries a brand alone, whatever its source', () => {
    const state = parseState(blob([food({ id: 'costco:1', name: 'Almonds', source: 'costco', brand: 'Kirkland Signature' })]), makeId)!;
    expect(state.foods[0]!.brand).to.equal('Kirkland Signature');
  });

  it('does not invent a brand for a USDA food, a brand-source food or a user food', () => {
    const state = parseState(blob([
      food({ id: 'usda:1', name: 'Apple', source: 'usda' }),
      food({ id: 'brand:chobani:1', name: 'Greek yogurt', source: 'brand:chobani' }),
      food({ id: 'mine', name: 'Soup' }),
    ]), makeId)!;

    expect(state.foods.map((f) => f.brand)).to.deep.equal([undefined, undefined, undefined]);
  });

  it('still tells a store-pack Almonds from a same-named Target one on a v1 blob', () => {
    const raw = JSON.stringify({
      version: 1,
      foods: [
        food({ id: 'costco:1', name: 'Almonds', source: 'costco' }),
        food({ id: 'target:1', name: 'Almonds', source: 'target' }),
      ],
      entries: [],
    });

    const state = parseState(raw, makeId)!;
    expect(state.foods.map((f) => f.name)).to.deep.equal(['Almonds', 'Almonds']);
    expect(state.foods.map((f) => f.brand)).to.deep.equal(['Costco', 'Target']);
  });
});

describe('parseState — enabled sources', () => {
  it('keeps a store by its own id, the name the store packs had', () => {
    const state = parseState(blob([], { enabledSources: ['usda', 'costco'] }), makeId)!;
    expect(state.enabledSources).to.deep.equal(['usda', 'costco']);
  });

  it('turns a house brand that is on by itself into its store, once', () => {
    const state = parseState(blob([], {
      enabledSources: ['usda', brandSource('kirkland-signature'), brandSource('kirkland'), brandSource('chobani'), 'costco'],
    }), makeId)!;
    expect(state.enabledSources).to.deep.equal(['usda', 'costco', brandSource('chobani')]);
  });

  it('keeps brand sources and unknown names, deduped, in order', () => {
    const chobani = brandSource('chobani');
    const state = parseState(blob([], { enabledSources: [chobani, 'usda', chobani, 'discontinued-source'] }), makeId)!;
    expect(state.enabledSources).to.deep.equal([chobani, 'usda', 'discontinued-source']);
  });

});

describe('parseState — settings', () => {
  it('defaults to percent when settings is missing', () => {
    const state = parseState(blob([]), makeId)!;
    expect(state.settings).to.deep.equal({ mealMacros: 'percent' });
    expect(state.version).to.equal(2);
  });

  it('keeps an explicit grams setting', () => {
    const state = parseState(blob([], { settings: { mealMacros: 'grams' } }), makeId)!;
    expect(state.settings).to.deep.equal({ mealMacros: 'grams' });
  });

  it('defaults an invalid mealMacros value and keeps the rest of the blob intact', () => {
    const state = parseState(blob([
      food({ id: 'a', name: 'Oats' }),
    ], { settings: { mealMacros: 'bogus' } }), makeId)!;
    expect(state.settings).to.deep.equal({ mealMacros: 'percent' });
    expect(state.foods).to.have.lengthOf(1);
  });

  it('drops unknown keys inside settings', () => {
    const state = parseState(blob([], { settings: { mealMacros: 'grams', bogus: 'x' } }), makeId)!;
    expect(state.settings).to.deep.equal({ mealMacros: 'grams' });
  });

  it('never rejects the blob over a malformed settings value', () => {
    const state = parseState(blob([], { settings: 'not-an-object' }), makeId);
    expect(state).to.not.equal(null);
    expect(state!.settings).to.deep.equal({ mealMacros: 'percent' });
  });

  it('defaults settings on a v1 blob', () => {
    const raw = JSON.stringify({
      version: 1,
      foods: [food({ id: 'a', name: 'Oats' })],
      entries: [],
    });

    const state = parseState(raw, makeId)!;
    expect(state.settings).to.deep.equal({ mealMacros: 'percent' });
    expect(state.version).to.equal(2);
  });
});

// The live site and PR previews share one localStorage blob, so a build can
// meet a unit a different build wrote. Wiping the whole blob over one entry
// or portion in a unit this build doesn't know would cost the user their
// whole log; drop just the offending piece instead.
describe('parseState — a unit this build does not know', () => {
  const meal1 = { id: 'm1', date: '2026-05-23', position: 0 };

  const entryIn = (id: string, unit: string) => ({
    id, date: '2026-05-23', foodId: 'a', amount: 1, unit,
    mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z',
  });

  it('drops an entry in an unknown unit, loading its other entries, foods and meals intact', () => {
    const state = parseState(blob([
      food({ id: 'a', name: 'Drink' }),
    ], {
      meals: [meal1],
      entries: [entryIn('e-floz', 'floz'), entryIn('e-g', 'g')],
    }), makeId)!;

    expect(state).to.not.equal(null);
    expect(state.foods).to.have.lengthOf(1);
    expect(state.meals).to.deep.equal([meal1]);
    expect(state.entries.map((e) => e.id)).to.deep.equal(['e-g']);
  });

  it('drops a recipe portion in an unknown unit, keeping the recipe when another portion remains', () => {
    const recipe = {
      id: 'r1', name: 'Smoothie', createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
      items: [{ foodId: 'a', amount: 1, unit: 'floz' }, { foodId: 'b', amount: 100, unit: 'g' }],
    };
    const state = parseState(blob([
      food({ id: 'a', name: 'Drink' }),
      food({ id: 'b', name: 'Yogurt' }),
    ], { recipes: [recipe] }), makeId)!;

    expect(state).to.not.equal(null);
    expect(state.recipes).to.have.lengthOf(1);
    expect(state.recipes[0]!.items).to.deep.equal([{ foodId: 'b', amount: 100, unit: 'g' }]);
    expect(state.foods).to.have.lengthOf(2);
  });

  it('still rejects the blob when an entry is missing required fields, not just an unrecognized unit', () => {
    const raw = blob([food({ id: 'a', name: 'Drink' })], {
      meals: [meal1],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: '', amount: 1, unit: 'floz', mealId: 'm1', loggedAt: '2026-05-23T10:00:00Z' }],
    });
    expect(parseState(raw, makeId)).to.equal(null);
  });
});
