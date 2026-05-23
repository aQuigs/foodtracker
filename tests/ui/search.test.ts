import { expect } from '@esm-bundle/chai';
import { filterFoods, fuzzyScore } from '../../src/ui/search.js';
import type { Food } from '../../src/domain/types.js';

const baseFood = (id: string, name: string, deletedAt: string | null = null): Food => ({
  id, name,
  kcalPer100g: 100, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0,
  primaryUnit: 'g', weightPerUnit: 100, chips: null,
  createdAt: '2026-01-01T00:00:00Z', deletedAt,
});

const foods: Food[] = [
  baseFood('1', 'Banana'),
  baseFood('2', 'Greek yogurt'),
  baseFood('3', 'Chicken breast'),
  baseFood('4', 'Olive oil'),
  baseFood('5', 'Deleted item', '2026-05-01T00:00:00Z'),
  baseFood('6', 'Cranberry juice'),
];

describe('fuzzyScore', () => {
  it('returns a positive number when all query letters appear in order in the name', () => {
    const score = fuzzyScore('Banana', 'bana');
    expect(score).to.be.a('number');
    expect(score).to.be.greaterThan(0);
  });

  it('returns null when query letters cannot be matched in order', () => {
    expect(fuzzyScore('Banana', 'zzzzqq')).to.equal(null);
  });

  it('is case-insensitive', () => {
    expect(fuzzyScore('Banana', 'BANANA')).to.be.greaterThan(0);
    expect(fuzzyScore('banana', 'Banana')).to.be.greaterThan(0);
  });

  it('scores a tighter match (fewer gaps) higher than a sparser one', () => {
    // 'ban' in 'Banana': b(0)-a(1)-n(2), 0 gaps → score 3
    // 'ban' in 'Bean soup': b(0)-a(2)-n(3), 1 skipped char → score 2.9
    const tight = fuzzyScore('Banana', 'ban');
    const sparse = fuzzyScore('Bean soup', 'ban');
    expect(tight).to.not.equal(null);
    expect(sparse).to.not.equal(null);
    expect(tight!).to.be.greaterThan(sparse!);
  });

  it('matches a one-letter omission (prefix of word)', () => {
    expect(fuzzyScore('Banana', 'bana')).to.be.greaterThan(0);
  });

  it('matches a typo where one expected letter is skipped', () => {
    expect(fuzzyScore('Chicken breast', 'chiken')).to.be.greaterThan(0);
  });

  it('matches multi-word queries across word boundaries', () => {
    expect(fuzzyScore('Olive oil', 'olv ol')).to.be.greaterThan(0);
  });

  it('returns null for empty query', () => {
    expect(fuzzyScore('Banana', '')).to.equal(null);
  });
});

describe('filterFoods', () => {
  it('returns all non-deleted foods when query is empty', () => {
    const result = filterFoods(foods, '');
    expect(result.map((f) => f.id)).to.deep.equal(['1', '2', '3', '4', '6']);
  });

  it('returns all non-deleted foods when query is whitespace', () => {
    const result = filterFoods(foods, '   ');
    expect(result.map((f) => f.id)).to.deep.equal(['1', '2', '3', '4', '6']);
  });

  it('returns empty list for all-gibberish query', () => {
    expect(filterFoods(foods, 'zzzzqq')).to.deep.equal([]);
  });

  it('matches exact substring case-insensitively', () => {
    const ids = filterFoods(foods, 'banana').map((f) => f.id);
    expect(ids).to.include('1');
    const ids2 = filterFoods(foods, 'BANANA').map((f) => f.id);
    expect(ids2).to.include('1');
  });

  it('matches one-letter omission: "bana" finds Banana', () => {
    const ids = filterFoods(foods, 'bana').map((f) => f.id);
    expect(ids).to.include('1');
  });

  it('matches one-letter typo/skip: "chiken" finds Chicken breast', () => {
    const ids = filterFoods(foods, 'chiken').map((f) => f.id);
    expect(ids).to.include('3');
  });

  it('matches multi-word query: "olv ol" finds Olive oil', () => {
    const ids = filterFoods(foods, 'olv ol').map((f) => f.id);
    expect(ids).to.include('4');
  });

  it('excludes soft-deleted foods even when name would match', () => {
    const result = filterFoods(foods, 'deleted');
    expect(result.find((f) => f.id === '5')).to.equal(undefined);
  });

  it('sorts results by score descending, then alphabetically for ties', () => {
    const tiedFoods: Food[] = [
      baseFood('a', 'Canned beans'),
      baseFood('b', 'Bean soup'),
      baseFood('c', 'Grilled chicken'),
    ];
    const result = filterFoods(tiedFoods, 'bean');
    const names = result.map((f) => f.name);
    expect(names.indexOf('Bean soup')).to.be.lessThan(names.indexOf('Canned beans'));
    expect(result.find((f) => f.id === 'c')).to.equal(undefined);
  });

  it('tie-break is case-insensitive: "apple pie" sorts before "Apple turnover" regardless of case', () => {
    const tiedFoods: Food[] = [
      baseFood('x', 'Apple turnover'),
      baseFood('y', 'apple pie'),
    ];
    const result = filterFoods(tiedFoods, 'apple');
    const names = result.map((f) => f.name);
    expect(names.indexOf('apple pie')).to.be.lessThan(names.indexOf('Apple turnover'));
  });

  it('matches query spanning two words: "ck br" finds Chicken breast', () => {
    const ids = filterFoods(foods, 'ck br').map((f) => f.id);
    expect(ids).to.include('3');
  });

  it('higher density match ranks above sparser match', () => {
    const tight: Food[] = [
      baseFood('t1', 'Banana'),
      baseFood('t2', 'Bayanbulak'),
    ];
    const result = filterFoods(tight, 'ban');
    const ids = result.map((f) => f.id);
    expect(ids[0]).to.equal('t1');
  });
});
