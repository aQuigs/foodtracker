import { expect } from '@esm-bundle/chai';
import { pickPiece, type UsdaPortion } from '../../scripts/usdaPortions.js';
import { USDA_PORTION_FIXTURES } from './usdaPortionFixtures.js';

// SR Legacy shape: measureUnit.name is always "undetermined", unit words
// live in `modifier`.
const sr = (modifier: string, amount: number, gramWeight: number, overrides: Partial<UsdaPortion> = {}): UsdaPortion => (
  { measureUnit: { name: 'undetermined' }, modifier, amount, gramWeight, sequenceNumber: 1, ...overrides }
);

// Foundation shape: the real unit is in measureUnit.name, modifier is a
// descriptor.
const fdn = (unit: string, modifier: string, amount: number, gramWeight: number, overrides: Partial<UsdaPortion> = {}): UsdaPortion => (
  { measureUnit: { name: unit }, modifier, amount, gramWeight, sequenceNumber: 1, ...overrides }
);

describe('pickPiece() classification', () => {
  it('returns null for an empty or missing portion list', () => {
    expect(pickPiece([])).to.equal(null);
    expect(pickPiece(undefined)).to.equal(null);
  });

  it('excludes SR volume/weight measures', () => {
    expect(pickPiece([sr('cup', 1, 227)])).to.equal(null);
    expect(pickPiece([sr('tbsp', 1, 14)])).to.equal(null);
  });

  it('excludes a Foundation measure unit even with no modifier', () => {
    expect(pickPiece([fdn('cup', '', 1, 240)])).to.equal(null);
  });

  it('excludes generic serving labels, SR and Foundation alike', () => {
    expect(pickPiece([sr('serving', 1, 30)])).to.equal(null);
    expect(pickPiece([sr('NLEA serving', 1, 126)])).to.equal(null);
    expect(pickPiece([fdn('RACC', '', 1, 30)])).to.equal(null);
    expect(pickPiece([sr('individual', 1, 40)])).to.equal(null);
  });

  it('excludes a batch yield, including the "package yield" phrasing', () => {
    expect(pickPiece([sr('unit (yield from 1 lb ready-to-cook chicken)', 1, 52)])).to.equal(null);
    expect(pickPiece([sr('1 package yield', 1, 300)])).to.equal(null);
  });

  it('lets an "excluding refuse" portion through — it names a trimmed piece, not a bone exclusion', () => {
    const excludingRefuse = pickPiece([sr('fillet excluding refuse', 1, 120)]);
    expect(excludingRefuse).to.deep.equal({ gramWeight: 120, pieces: { perServing: 1, noun: 'fillet' } });
  });

  it('excludes a zero, negative, or over-500g-per-piece amount', () => {
    expect(pickPiece([sr('medium', 0, 182)])).to.equal(null);
    expect(pickPiece([sr('medium', -1, 182)])).to.equal(null);
    expect(pickPiece([sr('melon', 1, 4518)])).to.equal(null);
  });

  it('drops a container-word portion with no reference serving and no other signal it is one sitting', () => {
    expect(pickPiece([sr('can', 1, 356)])).to.equal(null);
  });

  it('excludes a garbled multi-word Foundation unit by its first word, same as a clean one', () => {
    // A real Foundation row ships measureUnit.name "paired cooked w" (a
    // truncated, garbled value) — it must still read as "paired" and fall
    // under the generic-serving exclusion, not slip through as one
    // unmatched multi-word string.
    expect(pickPiece([fdn('paired cooked w', 'crumbles', 1, 155)])).to.equal(null);
  });

  it('drops a measure/serving portion\'s aside count when it names a volume or weight word, not a piece', () => {
    // "cup (8 fl oz)" restates the outer measure in different units; it is
    // not a piece count the way "oz (49 kernels)" is.
    expect(pickPiece([sr('cup (8 fl oz)', 1, 237)])).to.equal(null);
  });
});

describe('pickPiece() pick order', () => {
  it('ranks a "medium" piece above a plain one, even when heavier', () => {
    const portions = [
      sr('large (3-1/4" dia)', 1, 223, { sequenceNumber: 1 }),
      sr('medium (3" dia)', 1, 182, { sequenceNumber: 2 }),
      sr('small (2-3/4" dia)', 1, 149, { sequenceNumber: 3 }),
      sr('fruit (2-5/8" dia)', 1, 131, { sequenceNumber: 4 }),
    ];
    expect(pickPiece(portions)).to.deep.equal({ gramWeight: 182, pieces: { perServing: 1, noun: 'medium' } });
  });

  it('with no comma to separate them, treats two content words as one two-word noun rather than favoring the shorter one', () => {
    // "cracker square" has nothing to truncate at, so the whole phrase is
    // the noun — it ties "cracker" (from "crackers") on tier, and amount 1
    // wins the tie over amount 5.
    const portions = [
      sr('crackers', 5, 14.9, { sequenceNumber: 1 }),
      sr('cracker square', 1, 3, { sequenceNumber: 2 }),
    ];
    expect(pickPiece(portions)).to.deep.equal({ gramWeight: 3, pieces: { perServing: 1, noun: 'cracker square' } });
  });

  it('prefers amount 1 over other amounts once class and tier are equal', () => {
    const portions = [
      sr('slice', 5, 10, { sequenceNumber: 1 }),
      sr('slice', 1, 8, { sequenceNumber: 2 }),
    ];
    expect(pickPiece(portions)).to.deep.equal({ gramWeight: 8, pieces: { perServing: 1, noun: 'slice' } });
  });

  it('prefers the lighter piece once class, tier and amount 1 are equal', () => {
    const portions = [
      sr('slice', 1, 29, { sequenceNumber: 1 }),
      sr('slice', 1, 25, { sequenceNumber: 2 }),
    ];
    expect(pickPiece(portions)).to.deep.equal({ gramWeight: 25, pieces: { perServing: 1, noun: 'slice' } });
  });

  it('breaks a full tie by lowest sequenceNumber, then id', () => {
    const bySeq = [
      sr('piece', 1, 25, { sequenceNumber: 2, id: 1 }),
      sr('slice', 1, 25, { sequenceNumber: 1, id: 2 }),
    ];
    expect(pickPiece(bySeq)).to.deep.equal({ gramWeight: 25, pieces: { perServing: 1, noun: 'slice' } });

    const byId = [
      sr('piece', 1, 25, { sequenceNumber: 1, id: 20 }),
      sr('slice', 1, 25, { sequenceNumber: 1, id: 10 }),
    ];
    expect(pickPiece(byId)).to.deep.equal({ gramWeight: 25, pieces: { perServing: 1, noun: 'slice' } });
  });

  it('still ranks "medium" above an unrelated whole noun even without a description match', () => {
    const portions = [
      sr('medium', 1, 60, { sequenceNumber: 1 }),
      sr('hoagie', 1, 86, { sequenceNumber: 2 }),
    ];
    expect(pickPiece(portions, 'Rolls, dinner, plain, commercially prepared')).to.deep.equal({ gramWeight: 60, pieces: { perServing: 1, noun: 'medium' } });
  });

  it('drops a container whose own amount is not exactly 1', () => {
    expect(pickPiece([fdn('box', '', 2, 40)])).to.equal(null);
  });

  it('leaves an already-plural noun, a size word, and a mass noun alone when the amount is more than 1', () => {
    expect(pickPiece([sr('crackers', 5, 14.9)])).to.deep.equal({ gramWeight: 14.9, pieces: { perServing: 5, noun: 'crackers' } });
    expect(pickPiece([sr('large', 4, 22)])).to.deep.equal({ gramWeight: 22, pieces: { perServing: 4, noun: 'large' } });
    expect(pickPiece([sr('fruit', 10, 15)])).to.deep.equal({ gramWeight: 15, pieces: { perServing: 10, noun: 'fruit' } });
  });

  it('does not pluralize a fractional amount', () => {
    expect(pickPiece([sr('fillet', 0.5, 77)])).to.deep.equal({ gramWeight: 77, pieces: { perServing: 0.5, noun: 'fillet' } });
  });

  it('requires a fraction of an eighth or smaller to promote a sub-piece — a 3/8 share is not small enough', () => {
    // Same shape as Cantaloupe's real wedge/small pair (fixtures), but with
    // 3/8 instead of 1/8: the whole survives since 3/8 isn't <= 1/8.
    const portions = [
      sr('small (about 4-1/4" dia)', 1, 441, { sequenceNumber: 1 }),
      sr('wedge, medium (3/8 of medium melon)', 1, 69, { sequenceNumber: 2 }),
    ];
    expect(pickPiece(portions)).to.deep.equal({ gramWeight: 441, pieces: { perServing: 1, noun: 'small' } });
  });

  it('demotes a typical-size word back to tier 2 when another qualifier rides along with it', () => {
    // "slice regular, crust not eaten" isn't the plain regular slice —
    // "crust not eaten" is a real qualifier, so it doesn't tie the actual
    // "slice, regular" candidate on tier despite sharing the word "regular".
    const portions = [
      sr('slice regular, crust not eaten', 1, 12, { sequenceNumber: 1 }),
      sr('slice, regular', 1, 25, { sequenceNumber: 2 }),
    ];
    expect(pickPiece(portions)).to.deep.equal({ gramWeight: 25, pieces: { perServing: 1, noun: 'slice' } });
  });
});

describe('pickPiece() noun extraction', () => {
  it('drops a brand word (a capitalized token USDA never uses for its own portion words)', () => {
    expect(pickPiece([sr('envelope Alba (.675 oz)', 1, 19)])).to.deep.equal({ gramWeight: 19, pieces: { perServing: 1, noun: 'envelope' } });
  });

  it('picks one word out of a size + brand modifier', () => {
    // With no comma before "medium", there's no named noun to combine it
    // with, so "McDonald's shake" drops entirely and "medium" stands alone.
    const shake = pickPiece([fdn('each', "medium McDonald's shake (16 fl oz)", 1, 454)]);
    expect(shake).to.deep.equal({ gramWeight: 454, pieces: { perServing: 1, noun: 'medium' } });
  });

  it('drops a bare capitalized word with nothing else in the phrase, rather than guessing it\'s a real noun', () => {
    expect(pickPiece([sr('Gherkin (2-3/4" long)', 1, 25)])).to.equal(null);
  });

  it('never ships the bare Foundation "each" unit as a noun', () => {
    expect(pickPiece([fdn('each', '', 1, 150)])).to.equal(null);
  });

  it('reduces "medium whole" and "potato medium" to "medium"', () => {
    // "whole" is filler either way; "potato" has no comma to separate it
    // from "medium", so it doesn't combine into "medium potato" the way
    // "fillet, medium" combines into "medium fillet".
    expect(pickPiece([sr('medium whole (2-3/5" dia)', 1, 123)])).to.deep.equal({ gramWeight: 123, pieces: { perServing: 1, noun: 'medium' } });
    expect(pickPiece([sr('potato medium (2-1/4" to 3-1/4" dia)', 1, 213)])).to.deep.equal({ gramWeight: 213, pieces: { perServing: 1, noun: 'medium' } });
  });

  it('combines a size word with the named noun before it, when a comma separates them, but drops a typical size next to a real noun', () => {
    expect(pickPiece([sr('fillet, medium', 1, 40)])).to.deep.equal({ gramWeight: 40, pieces: { perServing: 1, noun: 'fillet' } });
    expect(pickPiece([sr('fillet, small', 1, 20)])).to.deep.equal({ gramWeight: 20, pieces: { perServing: 1, noun: 'small fillet' } });
  });
});

describe('pickPiece() singularize/pluralize', () => {
  it('reverses "-ies" to "-y", except for a small set of words already "-ie" in their base form', () => {
    expect(pickPiece([sr('cookies', 5, 30)])).to.deep.equal({ gramWeight: 30, pieces: { perServing: 5, noun: 'cookies' } });
    expect(pickPiece([sr('brownies', 3, 45)])).to.deep.equal({ gramWeight: 45, pieces: { perServing: 3, noun: 'brownies' } });
    expect(pickPiece([sr('pierogies', 4, 80)])).to.deep.equal({ gramWeight: 80, pieces: { perServing: 4, noun: 'pierogies' } });
    expect(pickPiece([sr('cherries', 10, 50)])).to.deep.equal({ gramWeight: 50, pieces: { perServing: 10, noun: 'cherries' } });

    // "pie" is also a MULTI word (a whole pie is too big for one sitting),
    // so it can only be pinned at amount 1, with a reference serving to
    // clear the one-sitting gate.
    expect(pickPiece([sr('pies', 1, 400), fdn('RACC', '', 1, 400)])).to.deep.equal({ gramWeight: 400, pieces: { perServing: 1, noun: 'pie' } });
  });

  it('reverses "-oes" to "-o"', () => {
    expect(pickPiece([sr('potatoes', 4, 200)])).to.deep.equal({ gramWeight: 200, pieces: { perServing: 4, noun: 'potatoes' } });
  });

  it('drops "es" for "-ches"/"-shes"/"-xes"/"-sses", not just the trailing "s"', () => {
    expect(pickPiece([sr('peaches', 6, 180)])).to.deep.equal({ gramWeight: 180, pieces: { perServing: 6, noun: 'peaches' } });
    expect(pickPiece([sr('dishes', 2, 40)])).to.deep.equal({ gramWeight: 40, pieces: { perServing: 2, noun: 'dishes' } });
    expect(pickPiece([sr('mixes', 3, 90)])).to.deep.equal({ gramWeight: 90, pieces: { perServing: 3, noun: 'mixes' } });
    expect(pickPiece([sr('kisses', 5, 25)])).to.deep.equal({ gramWeight: 25, pieces: { perServing: 5, noun: 'kisses' } });
  });

  it('reverses the irregular "-ves" plurals via a lookup, not a suffix rule', () => {
    expect(pickPiece([sr('halves', 4, 60)])).to.deep.equal({ gramWeight: 60, pieces: { perServing: 4, noun: 'halves' } });
    expect(pickPiece([sr('leaves', 5, 50)])).to.deep.equal({ gramWeight: 50, pieces: { perServing: 5, noun: 'leaves' } });
    expect(pickPiece([sr('knives', 2, 40)])).to.deep.equal({ gramWeight: 40, pieces: { perServing: 2, noun: 'knives' } });
    expect(pickPiece([sr('loaves', 1, 450), fdn('RACC', '', 1, 450)])).to.deep.equal({ gramWeight: 450, pieces: { perServing: 1, noun: 'loaf' } });
  });
});

describe('pickPiece() against real USDA foodPortions', () => {
  for (const fixture of USDA_PORTION_FIXTURES) {
    it(`${fixture.name} (fdcId ${fixture.fdcId})`, () => {
      expect(pickPiece(fixture.foodPortions, fixture.description, fixture.caloriesPer100 ?? 0)).to.deep.equal(fixture.want);
    });
  }
});
