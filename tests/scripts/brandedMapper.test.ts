import { expect } from '@esm-bundle/chai';
import {
  cleanBrandedName,
  isBrandPack,
  mapBrandedFoods,
  matchesPack,
  matchesPackKeys,
  type BrandedFood,
  type BrandPack,
} from '../../scripts/brandedMapper.js';
import { searchKey } from '../../src/domain/searchKey.js';

function nutrients(calories: number, protein: number, carbs: number, fat: number) {
  return [
    { nutrient: { id: 1008, number: '208' }, amount: calories },
    { nutrient: { id: 1003, number: '203' }, amount: protein },
    { nutrient: { id: 1005, number: '205' }, amount: carbs },
    { nutrient: { id: 1004, number: '204' }, amount: fat },
  ];
}

function row(overrides: Partial<BrandedFood> = {}): BrandedFood {
  return {
    fdcId: 1,
    description: 'KROGER, CHEESE PIZZA, CHEESE, CHEESE',
    brandOwner: 'The Kroger Co.',
    brandName: 'Kroger',
    brandedFoodCategory: 'Pizza',
    servingSizeUnit: 'g',
    publicationDate: '1/1/2020',
    foodNutrients: nutrients(100, 10, 20, 5),
    ...overrides,
  };
}

// row()'s fields are all optional on BrandedFood, so simulating "this field
// is absent from the dump row" means deleting the key, not setting it to
// undefined (exactOptionalPropertyTypes rejects the latter as a value).
function omit(base: BrandedFood, ...keys: (keyof BrandedFood)[]): BrandedFood {
  const copy = { ...base };
  for (const key of keys) {
    delete copy[key];
  }

  return copy;
}

const KROGER_PACK: BrandPack = {
  source: 'kroger',
  owners: ['The Kroger Co.', 'The Kroger Company'],
  brands: ['Kroger', 'Simple Truth', 'Simple Truth Organic'],
  strip: ['Simple Truth Organic', 'Simple Truth', 'Kroger'],
};

describe('isBrandPack()', () => {
  it('accepts a well-formed pack', () => {
    expect(isBrandPack(KROGER_PACK)).to.equal(true);
  });

  it('rejects a non-object', () => {
    expect(isBrandPack(null)).to.equal(false);
    expect(isBrandPack('kroger')).to.equal(false);
  });

  it('rejects a missing or empty source', () => {
    expect(isBrandPack({ ...KROGER_PACK, source: '' })).to.equal(false);
    expect(isBrandPack({ ...KROGER_PACK, source: undefined })).to.equal(false);
  });

  it('rejects non-string-array fields', () => {
    expect(isBrandPack({ ...KROGER_PACK, owners: 'The Kroger Co.' })).to.equal(false);
    expect(isBrandPack({ ...KROGER_PACK, brands: [1, 2] })).to.equal(false);
    expect(isBrandPack({ ...KROGER_PACK, strip: undefined })).to.equal(false);
  });
});

describe('matchesPack()', () => {
  it('matches by folded brand owner', () => {
    expect(matchesPack(row({ brandOwner: 'The Kroger Co.', brandName: 'Unrelated' }), KROGER_PACK)).to.equal(true);
  });

  it('matches by folded brand name', () => {
    expect(matchesPack(row({ brandOwner: 'Unrelated', brandName: 'Simple Truth' }), KROGER_PACK)).to.equal(true);
  });

  it('does not match an unrelated owner and brand', () => {
    expect(matchesPack(row({ brandOwner: 'Acme Inc.', brandName: 'Acme' }), KROGER_PACK)).to.equal(false);
  });

  it('folds punctuation and trailing whitespace on both sides', () => {
    const pack: BrandPack = { source: 'wegmans', owners: ['Wegmans Food Markets, Inc.'], brands: [], strip: [] };
    expect(matchesPack(omit(row({ brandOwner: 'Wegmans Food Markets, Inc. ' }), 'brandName'), pack)).to.equal(true);
  });

  it('treats missing owner/brand on the row as non-matching', () => {
    expect(matchesPack(omit(row(), 'brandOwner', 'brandName'), KROGER_PACK)).to.equal(false);
  });
});

describe('matchesPackKeys()', () => {
  it('matches on a pre-folded owner key or brand key', () => {
    expect(matchesPackKeys(searchKey('The Kroger Co.'), null, KROGER_PACK)).to.equal(true);
    expect(matchesPackKeys(null, searchKey('Simple Truth'), KROGER_PACK)).to.equal(true);
  });

  it('does not match when neither key is in the pack', () => {
    expect(matchesPackKeys(searchKey('Acme'), searchKey('Acme'), KROGER_PACK)).to.equal(false);
  });

  it('treats a null key as no match on that side', () => {
    expect(matchesPackKeys(null, null, KROGER_PACK)).to.equal(false);
  });
});

describe('cleanBrandedName()', () => {
  it('strips the longest matching phrase first so shorter substrings do not leave remnants', () => {
    expect(cleanBrandedName('SIMPLE TRUTH ORGANIC HONEY', ['Simple Truth', 'Simple Truth Organic'])).to.equal('Honey');
  });

  it('strips phrases containing apostrophes, ampersands, hyphens and periods on word boundaries', () => {
    expect(cleanBrandedName("TRADER JOSE'S SALSA", ["Trader Jose's"])).to.equal('Salsa');
    expect(cleanBrandedName('H-E-B TORTILLAS', ['H-E-B'])).to.equal('Tortillas');
  });

  it('drops a comma segment whose every word already appeared in an earlier segment', () => {
    expect(cleanBrandedName('KROGER, CHEESE PIZZA, CHEESE, CHEESE', ['Kroger'])).to.equal('Cheese pizza');
    expect(cleanBrandedName('WHOLE FANCY UNSALTED CASHEWS, UNSALTED', [])).to.equal('Whole fancy unsalted cashews');
    expect(cleanBrandedName('COOKIES, CHOCOLATE CHIP, CHOCOLATE CHIP', [])).to.equal('Cookies, chocolate chip');
  });

  it('applies sentence case while keeping allowlisted acronyms upper-case as whole words', () => {
    expect(cleanBrandedName('NON-GMO CRACKERS', [])).to.equal('Non-GMO crackers');
    expect(cleanBrandedName('BBQ SAUCE', [])).to.equal('BBQ sauce');
  });

  it('collapses whitespace and trims leading/trailing punctuation left behind by removals', () => {
    expect(cleanBrandedName('KIRKLAND SIGNATURE - ORGANIC HONEY', ['Kirkland Signature'])).to.equal('Organic honey');
  });

  it('returns an empty string when nothing is left after cleaning', () => {
    expect(cleanBrandedName('KROGER', ['Kroger'])).to.equal('');
    expect(cleanBrandedName(' , , ', [])).to.equal('');
  });

  it('decodes numeric HTML entities before matching a strip phrase, and drops the trademark glyph', () => {
    expect(cleanBrandedName('GOOD &#38; GATHER &#8482; PIZZA', ['Good & Gather'])).to.equal('Pizza');
  });

  it('decodes named HTML entities amp/quot/reg and drops the registered-trademark glyph', () => {
    expect(cleanBrandedName('MAC &amp; CHEESE', [])).to.equal('Mac & cheese');
    expect(cleanBrandedName('THE &quot;BEST&quot; CHIPS', [])).to.equal('The "best" chips');
    expect(cleanBrandedName('ACME&reg; SAUCE', [])).to.equal('Acme sauce');
  });

  it('still decodes &#38; and its hex equivalent &#x26; to &', () => {
    expect(cleanBrandedName('SALT &#38; PEPPER', [])).to.equal('Salt & pepper');
    expect(cleanBrandedName('SALT &#x26; PEPPER', [])).to.equal('Salt & pepper');
  });

  it('leaves an out-of-range numeric entity untouched instead of throwing', () => {
    expect(() => cleanBrandedName('BEYOND &#1114112; UNICODE', [])).to.not.throw();
    expect(cleanBrandedName('BEYOND &#1114112; UNICODE', [])).to.equal('Beyond &#1114112; unicode');
    expect(cleanBrandedName('HEX &#x110000; OVERFLOW', [])).to.equal('Hex &#x110000; overflow');
    expect(cleanBrandedName('HUGE &#99999999999; NUMBER', [])).to.equal('Huge &#99999999999; number');
  });

  it('leaves a lone surrogate entity untouched instead of shipping an unpaired surrogate', () => {
    expect(cleanBrandedName('LONE &#xD800; SURROGATE', [])).to.equal('Lone &#xd800; surrogate');
  });

  it('leaves a C0 control entity untouched instead of shipping a control character', () => {
    expect(cleanBrandedName('NUL &#0; HERE', [])).to.equal('Nul &#0; here');
  });

  it('strips a phrase whose edge is a non-word character even when followed by whitespace', () => {
    expect(cleanBrandedName("TRADER JACQUES' CROISSANTS", ["Trader Jacques'"])).to.equal('Croissants');
    expect(cleanBrandedName('ACME INC. CRACKERS', ['Acme Inc.'])).to.equal('Crackers');
  });

  it('keeps a trailing % or ) but still trims trailing separators left behind by removals', () => {
    expect(cleanBrandedName('MILK, 2%', [])).to.equal('Milk, 2%');
    expect(cleanBrandedName('COOKIES (ORGANIC)', [])).to.equal('Cookies (organic)');
  });
});

describe('mapBrandedFoods()', () => {
  it('maps an eligible row to a per-100g SourcedFood', () => {
    const [out] = mapBrandedFoods([row()], KROGER_PACK, 'kroger');

    expect(out).to.deep.equal({
      id: 'kroger:1',
      name: 'Cheese pizza',
      nutritionFacts: { calories: 100, protein: 10, carbs: 20, fat: 5 },
      servingSize: 100,
      servingUnit: 'g',
      source: 'kroger',
      sourceId: '1',
      tags: ['Pizza'],
    });
  });

  it('omits tags when brandedFoodCategory is absent', () => {
    const [out] = mapBrandedFoods([omit(row(), 'brandedFoodCategory')], KROGER_PACK, 'kroger');
    expect(out!.tags).to.deep.equal([]);
  });

  it('trims brandedFoodCategory before using it as a tag', () => {
    const [out] = mapBrandedFoods([row({ brandedFoodCategory: '  Pizza  ' })], KROGER_PACK, 'kroger');
    expect(out!.tags).to.deep.equal(['Pizza']);
  });

  it('omits tags when brandedFoodCategory is whitespace-only', () => {
    const [out] = mapBrandedFoods([row({ brandedFoodCategory: '   ' })], KROGER_PACK, 'kroger');
    expect(out!.tags).to.deep.equal([]);
  });

  it('drops a row whose fdcId is not an integer', () => {
    expect(mapBrandedFoods([row({ fdcId: 1.5 })], KROGER_PACK, 'kroger')).to.deep.equal([]);
  });

  it('accepts g, GRM, GM, ml and MLT serving units case-insensitively', () => {
    const rows = ['g', 'GRM', 'Gm', 'ML', 'mlt'].map((servingSizeUnit, i) =>
      row({ fdcId: i + 1, description: `Item ${i}`, servingSizeUnit }));
    expect(mapBrandedFoods(rows, KROGER_PACK, 'kroger')).to.have.lengthOf(5);
  });

  it('drops a row with an unsupported serving unit', () => {
    expect(mapBrandedFoods([row({ servingSizeUnit: 'IU' })], KROGER_PACK, 'kroger')).to.deep.equal([]);
  });

  it('drops a row with a non-numeric fdcId', () => {
    expect(mapBrandedFoods([omit(row(), 'fdcId')], KROGER_PACK, 'kroger')).to.deep.equal([]);
  });

  it('drops a row with an empty description', () => {
    expect(mapBrandedFoods([row({ description: '' })], KROGER_PACK, 'kroger')).to.deep.equal([]);
  });

  it('drops a row whose cleaned name is empty', () => {
    expect(mapBrandedFoods([row({ description: 'KROGER' })], KROGER_PACK, 'kroger')).to.deep.equal([]);
  });

  it('drops a row with no energy or macro nutrients at all', () => {
    expect(mapBrandedFoods([row({ foodNutrients: [] })], KROGER_PACK, 'kroger')).to.deep.equal([]);
  });

  it('keeps a row with an explicit zero for a tracked nutrient', () => {
    const [out] = mapBrandedFoods([row({ foodNutrients: [{ nutrient: { id: 1008 }, amount: 0 }] })], KROGER_PACK, 'kroger');
    expect(out).to.exist;
    expect(out!.nutritionFacts.calories).to.equal(0);
  });

  it('dedupes same-name rows keeping the latest publication date', () => {
    const older = row({ fdcId: 1, description: 'CHEDDAR CHEESE', publicationDate: '1/1/2019' });
    const newer = row({ fdcId: 2, description: 'CHEDDAR CHEESE', publicationDate: '6/1/2021' });
    const out = mapBrandedFoods([older, newer], KROGER_PACK, 'kroger');

    expect(out).to.have.lengthOf(1);
    expect(out[0]!.sourceId).to.equal('2');
  });

  it('treats a missing publication date as oldest', () => {
    const noDate = omit(row({ fdcId: 1, description: 'CHEDDAR CHEESE' }), 'publicationDate');
    const dated = row({ fdcId: 2, description: 'CHEDDAR CHEESE', publicationDate: '1/1/2000' });
    const out = mapBrandedFoods([noDate, dated], KROGER_PACK, 'kroger');

    expect(out).to.have.lengthOf(1);
    expect(out[0]!.sourceId).to.equal('2');
  });

  it('treats an out-of-range publication date as missing rather than letting it roll over past a valid one', () => {
    const bogus = row({ fdcId: 1, description: 'CHEDDAR CHEESE', publicationDate: '13/45/2020' });
    const valid = row({ fdcId: 2, description: 'CHEDDAR CHEESE', publicationDate: '1/1/2021' });
    const out = mapBrandedFoods([bogus, valid], KROGER_PACK, 'kroger');

    expect(out).to.have.lengthOf(1);
    expect(out[0]!.sourceId).to.equal('2');
  });

  it('breaks a publication-date tie by the highest fdcId', () => {
    const first = row({ fdcId: 5, description: 'CHEDDAR CHEESE', publicationDate: '1/1/2020' });
    const second = row({ fdcId: 9, description: 'CHEDDAR CHEESE', publicationDate: '1/1/2020' });
    const out = mapBrandedFoods([first, second], KROGER_PACK, 'kroger');

    expect(out).to.have.lengthOf(1);
    expect(out[0]!.sourceId).to.equal('9');
  });

  it('rounds nutrition to one decimal', () => {
    const [out] = mapBrandedFoods([row({ foodNutrients: nutrients(33.333, 1.111, 2.222, 0.999) })], KROGER_PACK, 'kroger');
    expect(out!.nutritionFacts).to.deep.equal({ calories: 33.3, protein: 1.1, carbs: 2.2, fat: 1 });
  });

  it('sorts output by search key deterministically', () => {
    const rows = [
      row({ fdcId: 1, description: 'BANANA CHIPS' }),
      row({ fdcId: 2, description: 'APPLE CHIPS' }),
      row({ fdcId: 3, description: 'CARROT CHIPS' }),
    ];
    const out = mapBrandedFoods(rows, KROGER_PACK, 'kroger');
    expect(out.map((f) => f.name)).to.deep.equal(['Apple chips', 'Banana chips', 'Carrot chips']);
  });

  it('returns [] for an empty row list', () => {
    expect(mapBrandedFoods([], KROGER_PACK, 'kroger')).to.deep.equal([]);
  });
});
