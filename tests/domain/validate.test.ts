import { expect } from '@esm-bundle/chai';
import { isSourcedFood, parseState } from '../../src/domain/validate.js';
import { STORE_BUNDLES, brandSource, bundleSources } from '../../src/domain/foodSources.js';

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
  it('expands a store pack name into its bundle\'s brand sources', () => {
    const state = parseState(blob([], { enabledSources: ['usda', 'costco'] }), makeId)!;
    expect(state.enabledSources).to.deep.equal(['usda', ...bundleSources('costco')]);
  });

  it('keeps brand sources and unknown names, deduped, in order', () => {
    const chobani = brandSource('chobani');
    const state = parseState(blob([], { enabledSources: [chobani, 'usda', chobani, 'discontinued-source'] }), makeId)!;
    expect(state.enabledSources).to.deep.equal([chobani, 'usda', 'discontinued-source']);
  });

  it('never lists a brand twice when a store bundle repeats one already on', () => {
    const kirkland = brandSource('kirkland-signature');
    const state = parseState(blob([], { enabledSources: [kirkland, 'costco'] }), makeId)!;
    expect(state.enabledSources.filter((s) => s === kirkland)).to.have.lengthOf(1);
  });
});
