import { expect } from '@esm-bundle/chai';
import { parseState } from '../../src/domain/validate.js';

const nutritionFacts = { calories: 100, protein: 5, carbs: 10, fat: 2 };

function food(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    nutritionFacts, servingSize: 100, servingUnit: 'g',
    createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    ...overrides,
  };
}

let nextId = 0;
const makeId = (): string => `gen-${nextId++}`;

describe('parseState — duplicate live names', () => {
  it('leaves a same-named pair from two different brands alone', () => {
    const raw = JSON.stringify({
      version: 2,
      foods: [
        food({ id: 'costco:1', name: 'Almonds', source: 'costco' }),
        food({ id: 'target:1', name: 'Almonds', source: 'target' }),
      ],
      meals: [], entries: [],
    });

    const state = parseState(raw, makeId)!;
    expect(state.foods.map((f) => f.name)).to.deep.equal(['Almonds', 'Almonds']);
  });
});
