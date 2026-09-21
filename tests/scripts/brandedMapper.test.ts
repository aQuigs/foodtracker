import { expect } from '@esm-bundle/chai';
import {
  BrandCollector,
  brandIdFor,
  brandLabelFor,
  cleanBrandedName,
  type BrandDataset,
  type BrandedFood,
} from '../../scripts/brandedMapper.js';

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
    brandName: 'KROGER',
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

function spellings(...pairs: [string, number][]): Map<string, number> {
  return new Map(pairs);
}

function collect(rows: BrandedFood[]): BrandDataset[] {
  const collector = new BrandCollector();
  for (const r of rows) {
    collector.add(r);
  }

  return collector.datasets();
}

function names(brand: BrandDataset | undefined): string[] {
  return brand!.rows.map(([, name]) => name);
}

function fdcIds(brand: BrandDataset | undefined): number[] {
  return brand!.rows.map(([fdcId]) => fdcId);
}

describe('brandIdFor()', () => {
  it('folds case, apostrophes and hyphens so spellings of one brand share an id', () => {
    expect(brandIdFor("LAY'S")).to.equal('lays');
    expect(brandIdFor('Lays')).to.equal('lays');
    expect(brandIdFor('H-E-B')).to.equal('heb');
    expect(brandIdFor("Trader Joe's")).to.equal('trader-joes');
  });

  it('joins words with hyphens and drops punctuation that is not intra-word', () => {
    expect(brandIdFor('Good & Gather')).to.equal('good-gather');
    expect(brandIdFor('  Simple  Truth Organic ')).to.equal('simple-truth-organic');
    expect(brandIdFor('365 Whole Foods Market')).to.equal('365-whole-foods-market');
  });

  it('decodes entities and ignores trademark glyphs before folding', () => {
    expect(brandIdFor('GOOD &#38; GATHER &#8482;')).to.equal('good-gather');
    expect(brandIdFor('SIGNATURE SELECT®')).to.equal('signature-select');
  });

  it('returns null for a spelling that folds to nothing', () => {
    expect(brandIdFor('')).to.equal(null);
    expect(brandIdFor('   ')).to.equal(null);
    expect(brandIdFor('™')).to.equal(null);
  });
});

describe('brandLabelFor()', () => {
  it('prefers the most frequent spelling that mixes upper and lower case', () => {
    expect(brandLabelFor(spellings(['KROGER', 3039], ['Kroger', 38]))).to.equal('Kroger');
    expect(brandLabelFor(spellings(['YOCRUNCH', 56], ['YoCrunch', 14], ['Yocrunch', 2]))).to.equal('YoCrunch');
  });

  it('does not treat an all-lowercase spelling as mixed case', () => {
    expect(brandLabelFor(spellings(['MEIJER', 5585], ['meijer', 8]))).to.equal('Meijer');
  });

  it('title-cases the most frequent spelling when none is mixed case', () => {
    expect(brandLabelFor(spellings(['CHOBANI', 483]))).to.equal('Chobani');
    expect(brandLabelFor(spellings(['NATURE VALLEY', 527]))).to.equal('Nature Valley');
    expect(brandLabelFor(spellings(["BOB'S RED MILL", 610]))).to.equal("Bob's Red Mill");
    expect(brandLabelFor(spellings(['HY-VEE', 3264]))).to.equal('Hy-Vee');
    expect(brandLabelFor(spellings(['O ORGANICS', 1129]))).to.equal('O Organics');
  });

  it('leaves a word alone when it has no vowel — an initialism or a number', () => {
    expect(brandLabelFor(spellings(['H-E-B', 1131]))).to.equal('H-E-B');
    expect(brandLabelFor(spellings(['BBQ KING', 4]))).to.equal('BBQ King');
    expect(brandLabelFor(spellings(['UTZ', 559]))).to.equal('Utz');
    expect(brandLabelFor(spellings(['365', 123]))).to.equal('365');
    expect(brandLabelFor(spellings(["M&M'S", 564]))).to.equal("M&M'S");
  });

  it('breaks a frequency tie alphabetically so a rebuild is stable', () => {
    expect(brandLabelFor(spellings(['Kettle', 5], ['KETTLE', 5]))).to.equal('Kettle');
    expect(brandLabelFor(spellings(['ZETA', 5], ['ALPHA', 5]))).to.equal('Alpha');
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

describe('BrandCollector', () => {
  it('turns an eligible row into a brand row under its brand: USDA id, cleaned name, category, nutrition per 100 g', () => {
    expect(collect([row()])).to.deep.equal([{
      id: 'kroger',
      label: 'Kroger',
      rows: [[1, 'Cheese pizza', 'Pizza', 100, 10, 20, 5]],
    }]);
  });

  it('groups spellings that fold alike under one brand and labels it by the label rule', () => {
    const out = collect([
      row({ fdcId: 1, brandName: "LAY'S", description: "LAY'S, CLASSIC" }),
      row({ fdcId: 2, brandName: 'Lays', description: 'LAYS, WAVY' }),
      row({ fdcId: 3, brandName: "Lay's", description: "LAY'S, BAKED" }),
    ]);

    expect(out.map((b) => b.id)).to.deep.equal(['lays']);
    expect(out[0]!.label).to.equal("Lay's");
    expect(names(out[0])).to.deep.equal(['Baked', 'Classic', 'Wavy']);
  });

  it('strips the row\'s own brand spelling from its name, entities and glyphs included', () => {
    const [target] = collect([row({ brandName: 'GOOD &#38; GATHER &#8482;', description: 'GOOD &#38; GATHER &#8482; PIZZA' })]);
    expect(target!.id).to.equal('good-gather');
    expect(names(target)).to.deep.equal(['Pizza']);
  });

  it('drops a row with no brand name, or one that folds to nothing', () => {
    expect(collect([omit(row(), 'brandName')])).to.deep.equal([]);
    expect(collect([row({ brandName: '™' })])).to.deep.equal([]);
  });

  it('sorts brands by id and each brand\'s rows by search key, then by USDA id as text', () => {
    const out = collect([
      row({ fdcId: 1, brandName: 'Zeta', description: 'BANANA CHIPS' }),
      row({ fdcId: 2, brandName: 'Alpha', description: 'CARROT CHIPS' }),
      row({ fdcId: 3, brandName: 'Alpha', description: 'APPLE CHIPS' }),
      row({ fdcId: 10, brandName: 'Alpha', description: 'APPLE CHIPS', foodNutrients: nutrients(1, 1, 1, 1) }),
    ]);

    expect(out.map((b) => b.id)).to.deep.equal(['alpha', 'zeta']);
    expect(names(out[0])).to.deep.equal(['Apple chips', 'Apple chips', 'Carrot chips']);
    expect(fdcIds(out[0])).to.deep.equal([10, 3, 2]);
  });

  it('writes an empty category when brandedFoodCategory is absent or blank, and trims it otherwise', () => {
    const category = (r: BrandedFood): string | undefined => collect([r])[0]!.rows[0]![2];

    expect(category(omit(row(), 'brandedFoodCategory'))).to.equal('');
    expect(category(row({ brandedFoodCategory: '   ' }))).to.equal('');
    expect(category(row({ brandedFoodCategory: '  Pizza  ' }))).to.equal('Pizza');
  });

  it('accepts g, GRM, GM, ml and MLT serving units case-insensitively and drops any other', () => {
    const rows = ['g', 'GRM', 'Gm', 'ML', 'mlt'].map((servingSizeUnit, i) =>
      row({ fdcId: i + 1, description: `Item ${i}`, servingSizeUnit }));
    expect(collect(rows)[0]!.rows).to.have.lengthOf(5);
    expect(collect([row({ servingSizeUnit: 'IU' })])).to.deep.equal([]);
  });

  it('drops a row with a non-integer or missing fdcId, an empty description, or an empty cleaned name', () => {
    expect(collect([row({ fdcId: 1.5 })])).to.deep.equal([]);
    expect(collect([omit(row(), 'fdcId')])).to.deep.equal([]);
    expect(collect([row({ description: '' })])).to.deep.equal([]);
    expect(collect([row({ description: 'KROGER' })])).to.deep.equal([]);
  });

  it('drops a row with no energy or macro nutrients at all but keeps an explicit zero', () => {
    expect(collect([row({ foodNutrients: [] })])).to.deep.equal([]);
    expect(collect([row({ foodNutrients: [{ nutrient: { id: 1008 }, amount: 0 }] })])[0]!.rows[0]!.slice(3)).to.deep.equal([0, 0, 0, 0]);
  });

  it('collapses rows with the same name and nutrition, keeping the latest publication', () => {
    const older = row({ fdcId: 1, description: 'CHEDDAR CHEESE', publicationDate: '1/1/2019' });
    const newer = row({ fdcId: 2, description: 'CHEDDAR CHEESE', publicationDate: '6/1/2021' });
    expect(fdcIds(collect([newer, older])[0])).to.deep.equal([2]);
  });

  it('keeps a same-named row whose nutrition differs, so a reformulated item ships beside the original', () => {
    const original = row({ fdcId: 1, description: 'CHEDDAR CHEESE', foodNutrients: nutrients(400, 25, 1, 33) });
    const variant = row({ fdcId: 2, description: 'CHEDDAR CHEESE', foodNutrients: nutrients(380, 24, 2, 31) });
    expect(fdcIds(collect([original, variant])[0])).to.deep.equal([1, 2]);
  });

  it('compares nutrition after rounding, so a hundredth of a gram is not a difference', () => {
    const a = row({ fdcId: 1, description: 'CHEDDAR CHEESE', foodNutrients: nutrients(100, 10.01, 20, 5) });
    const b = row({ fdcId: 2, description: 'CHEDDAR CHEESE', foodNutrients: nutrients(100, 10.04, 20, 5) });
    expect(collect([a, b])[0]!.rows).to.have.lengthOf(1);
  });

  it('treats a missing or out-of-range publication date as oldest and breaks a tie by the highest fdcId', () => {
    const noDate = omit(row({ fdcId: 1, description: 'CHEDDAR CHEESE' }), 'publicationDate');
    const bogus = row({ fdcId: 2, description: 'CHEDDAR CHEESE', publicationDate: '13/45/2020' });
    const dated = row({ fdcId: 3, description: 'CHEDDAR CHEESE', publicationDate: '1/1/2000' });
    expect(fdcIds(collect([noDate, bogus, dated])[0])).to.deep.equal([3]);

    const first = row({ fdcId: 5, description: 'CHEDDAR CHEESE', publicationDate: '1/1/2020' });
    const second = row({ fdcId: 9, description: 'CHEDDAR CHEESE', publicationDate: '1/1/2020' });
    expect(fdcIds(collect([first, second])[0])).to.deep.equal([9]);
  });

  it('rounds nutrition to one decimal', () => {
    const [kroger] = collect([row({ foodNutrients: nutrients(33.333, 1.111, 2.222, 0.999) })]);
    expect(kroger!.rows[0]!.slice(3)).to.deep.equal([33.3, 1.1, 2.2, 1]);
  });

  it('collects nothing from no rows', () => {
    expect(collect([])).to.deep.equal([]);
  });
});
