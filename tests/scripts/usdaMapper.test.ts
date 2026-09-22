import { expect } from '@esm-bundle/chai';
import {
  extractNutritionFacts,
  mapCuratedFoods,
  mapClassifiedFoods,
  type CuratedFood,
  type UsdaFood,
  type UsdaDump,
} from '../../scripts/usdaMapper.js';

describe('extractNutritionFacts()', () => {
  it('reads calories/protein/carbs/fat by USDA nutrient number', () => {
    const food: UsdaFood = {
      foodNutrients: [
        { nutrientNumber: '208', amount: 89 },
        { nutrientNumber: '203', amount: 1.1 },
        { nutrientNumber: '205', amount: 22.8 },
        { nutrientNumber: '204', amount: 0.3 },
      ],
    };

    expect(extractNutritionFacts(food)).to.deep.equal({
      calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3,
    });
  });

  it('reads via nested nutrient.id when present', () => {
    const food: UsdaFood = {
      foodNutrients: [
        { nutrient: { id: 1008 }, amount: 89 },
        { nutrient: { id: 1003 }, amount: 1.1 },
        { nutrient: { id: 1005 }, amount: 22.8 },
        { nutrient: { id: 1004 }, amount: 0.3 },
      ],
    };

    expect(extractNutritionFacts(food).calories).to.equal(89);
    expect(extractNutritionFacts(food).fat).to.equal(0.3);
  });

  it('defaults missing nutrients to 0 (not NaN)', () => {
    expect(extractNutritionFacts({ foodNutrients: [] })).to.deep.equal({
      calories: 0, protein: 0, carbs: 0, fat: 0,
    });
  });

  it('treats negative amounts as 0 (silently sanitized)', () => {
    const food: UsdaFood = {
      foodNutrients: [{ nutrientNumber: '208', amount: -10 }],
    };
    expect(extractNutritionFacts(food).calories).to.equal(0);
  });

  it('treats an energy row without an amount as absent, so the Atwater fallback still runs', () => {
    const food: UsdaFood = {
      foodNutrients: [
        { nutrient: { id: 1008, number: '208' } },
        { nutrient: { id: 2047, number: '957' }, amount: 884 },
      ],
    };
    expect(extractNutritionFacts(food).calories).to.equal(884);
  });

  it('treats a total-fat row without an amount as absent, so the fatty-acid fallback still runs', () => {
    const food: UsdaFood = {
      foodNutrients: [
        { nutrient: { id: 1004, number: '204' } },
        { nutrient: { id: 1258, number: '606' }, amount: 10 },
        { nutrient: { id: 1292, number: '645' }, amount: 20 },
      ],
    };
    expect(extractNutritionFacts(food).fat).to.equal(30);
  });

  it('falls back to Atwater General energy when kcal 208 is absent', () => {
    const food: UsdaFood = {
      foodNutrients: [
        { nutrient: { id: 2047, number: '957' }, amount: 645 },
        { nutrient: { id: 2048, number: '958' }, amount: 603 },
        { nutrientNumber: '203', amount: 21 },
      ],
    };
    expect(extractNutritionFacts(food).calories).to.equal(645);
    expect(extractNutritionFacts(food).protein).to.equal(21);
  });

  it('falls back to Atwater Specific energy when both 208 and Atwater General are absent', () => {
    const food: UsdaFood = {
      foodNutrients: [{ nutrient: { id: 2048, number: '958' }, amount: 603 }],
    };
    expect(extractNutritionFacts(food).calories).to.equal(603);
  });

  it('prefers explicit kcal 208 over Atwater values', () => {
    const food: UsdaFood = {
      foodNutrients: [
        { nutrient: { id: 2047, number: '957' }, amount: 645 },
        { nutrientNumber: '208', amount: 130 },
      ],
    };
    expect(extractNutritionFacts(food).calories).to.equal(130);
  });

  it('keeps an explicit kcal of 0 even when Atwater values exist', () => {
    const food: UsdaFood = {
      foodNutrients: [
        { nutrientNumber: '208', amount: 0 },
        { nutrient: { id: 2047, number: '957' }, amount: 5 },
      ],
    };
    expect(extractNutritionFacts(food).calories).to.equal(0);
  });

  it('derives calories from macros via Atwater factors when no energy nutrient exists', () => {
    const food: UsdaFood = {
      foodNutrients: [
        { nutrientNumber: '203', amount: 24.4 },
        { nutrientNumber: '205', amount: 10 },
        { nutrientNumber: '204', amount: 1.45 },
      ],
    };
    expect(extractNutritionFacts(food).calories).to.be.closeTo(4 * 24.4 + 4 * 10 + 9 * 1.45, 0.01);
  });

  it('derives fat from fatty-acid subcomponents when total fat is absent', () => {
    const food: UsdaFood = {
      foodNutrients: [
        { nutrient: { id: 1258, number: '606' }, amount: 15.8 },
        { nutrient: { id: 1292, number: '645' }, amount: 66.6 },
        { nutrient: { id: 1293, number: '646' }, amount: 10.4 },
        { nutrient: { id: 1257, number: '605' }, amount: 0.116 },
      ],
    };
    const n = extractNutritionFacts(food);
    expect(n.fat).to.be.closeTo(92.916, 0.001);
    expect(n.calories).to.be.closeTo(9 * 92.916, 0.01);
  });

  it('prefers explicit total fat over fatty-acid subcomponents', () => {
    const food: UsdaFood = {
      foodNutrients: [
        { nutrientNumber: '204', amount: 100 },
        { nutrient: { id: 1292, number: '645' }, amount: 66.6 },
      ],
    };
    expect(extractNutritionFacts(food).fat).to.equal(100);
  });

  it('handles missing foodNutrients without throwing', () => {
    expect(extractNutritionFacts({}).calories).to.equal(0);
  });
});

describe('mapCuratedFoods()', () => {
  const usdaFood = (fdcId: number, description: string, per100g: {
    calories: number; protein: number; carbs: number; fat: number;
  }): UsdaFood => ({
    fdcId,
    description,
    foodNutrients: [
      { nutrientNumber: '208', amount: per100g.calories },
      { nutrientNumber: '203', amount: per100g.protein },
      { nutrientNumber: '205', amount: per100g.carbs },
      { nutrientNumber: '204', amount: per100g.fat },
    ],
  });

  const APPLE = usdaFood(1001, 'Apples, raw, with skin', { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2 });
  const EGG = usdaFood(1002, 'Egg, whole, raw, fresh', { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 });

  const curatedApple: CuratedFood = { name: 'Apple', fdcId: 1001, category: 'fruit' };
  const curatedEgg: CuratedFood = { name: 'Egg', fdcId: 1002, category: 'dairy-eggs', countGrams: 50 };

  it('maps a weight-based entry to a per-100g SourcedFood with the curated name', () => {
    const [out] = mapCuratedFoods([{ SRLegacyFoods: [APPLE] }], [curatedApple], 'usda');

    expect(out).to.deep.equal({
      id: 'usda:1001',
      name: 'Apple',
      nutritionFacts: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2 },
      servingSize: 100,
      servingUnit: 'g',
      source: 'usda',
      sourceId: '1001',
      tags: ['fruit'],
    });
  });

  it('maps a countGrams entry to a 1-count serving with nutrition scaled to that weight', () => {
    const [out] = mapCuratedFoods([{ SRLegacyFoods: [EGG] }], [curatedEgg], 'usda');

    expect(out!.servingSize).to.equal(1);
    expect(out!.servingUnit).to.equal('count');
    expect(out!.nutritionFacts).to.deep.equal({
      calories: 71.5, protein: 6.3, carbs: 0.4, fat: 4.8,
    });
  });

  it('rounds nutrition to one decimal', () => {
    const food = usdaFood(1003, 'Thing', { calories: 33.333, protein: 1.111, carbs: 2.222, fat: 0.999 });
    const [out] = mapCuratedFoods([{ SRLegacyFoods: [food] }],
      [{ name: 'Thing', fdcId: 1003, category: 'pantry' }], 'usda');

    expect(out!.nutritionFacts).to.deep.equal({
      calories: 33.3, protein: 1.1, carbs: 2.2, fat: 1,
    });
  });

  it('resolves fdcIds across multiple dumps and list shapes', () => {
    const dumps: UsdaDump[] = [
      { FoundationFoods: [APPLE] },
      { SRLegacyFoods: [EGG] },
    ];
    const out = mapCuratedFoods(dumps, [curatedApple, curatedEgg], 'usda');
    expect(out.map((f) => f.name)).to.have.members(['Apple', 'Egg']);
  });

  it('sorts output by search key, ties broken by sourceId', () => {
    const foods = [1, 2, 3].map((id) =>
      usdaFood(id, `row ${id}`, { calories: 1, protein: 0, carbs: 0, fat: 0 }));
    const curated: CuratedFood[] = [
      { name: 'banana', fdcId: 3, category: 'c' },
      { name: 'Apricot', fdcId: 1, category: 'c' },
      { name: 'APPLE', fdcId: 2, category: 'c' },
    ];
    const out = mapCuratedFoods([{ SRLegacyFoods: foods }], curated, 'usda');
    expect(out.map((f) => f.name)).to.deep.equal(['APPLE', 'Apricot', 'banana']);
  });

  it('throws listing every unresolved fdcId, not just the first', () => {
    expect(() => mapCuratedFoods([{ SRLegacyFoods: [APPLE] }], [
      curatedApple,
      { name: 'Ghost', fdcId: 9998, category: 'c' },
      { name: 'Phantom', fdcId: 9999, category: 'c' },
    ], 'usda')).to.throw(/9998.*9999|Ghost.*Phantom/s);
  });

  it('throws on duplicate names, case-insensitively', () => {
    const other = usdaFood(1005, 'Other apple row', { calories: 60, protein: 0, carbs: 15, fat: 0 });
    expect(() => mapCuratedFoods([{ SRLegacyFoods: [APPLE, other] }], [
      curatedApple,
      { name: 'apple', fdcId: 1005, category: 'fruit' },
    ], 'usda')).to.throw(/apple/i);
  });

  it('throws on duplicate fdcIds', () => {
    expect(() => mapCuratedFoods([{ SRLegacyFoods: [APPLE] }], [
      curatedApple,
      { name: 'Apple 2', fdcId: 1001, category: 'fruit' },
    ], 'usda')).to.throw(/1001/);
  });

  it('throws when countGrams is zero or negative', () => {
    expect(() => mapCuratedFoods([{ SRLegacyFoods: [EGG] }], [
      { name: 'Egg', fdcId: 1002, category: 'dairy-eggs', countGrams: 0 },
    ], 'usda')).to.throw(/countGrams/);
  });

  it('returns [] for an empty curated list', () => {
    expect(mapCuratedFoods([{ SRLegacyFoods: [APPLE] }], [], 'usda')).to.deep.equal([]);
  });
});

describe('mapClassifiedFoods()', () => {
  const usdaFood = (fdcId: number, description: string, category: string, calories = 100): UsdaFood => ({
    fdcId,
    description,
    foodCategory: { description: category },
    foodNutrients: [
      { nutrientNumber: '208', amount: calories },
      { nutrientNumber: '203', amount: 10 },
      { nutrientNumber: '205', amount: 20 },
      { nutrientNumber: '204', amount: 5 },
    ],
  });

  const APPLE = usdaFood(1, 'Apples, raw, with skin', 'Fruits and Fruit Juices', 52);
  const EGGWHITE = usdaFood(2, 'Egg, white, dried, stabilized', 'Dairy and Egg Products');

  it('ships kept rows per-100g under the classified name', () => {
    const out = mapClassifiedFoods([{ SRLegacyFoods: [APPLE, EGGWHITE] }], [
      { fdcId: 1, keep: true, name: 'Apple' },
      { fdcId: 2, keep: false },
    ], 'usda-full');

    expect(out).to.have.lengthOf(1);
    expect(out[0]).to.deep.include({
      id: 'usda-full:1', name: 'Apple', servingSize: 100, servingUnit: 'g',
      source: 'usda-full', sourceId: '1',
    });
    expect(out[0]!.nutritionFacts.calories).to.equal(52);
    expect(out[0]!.tags).to.deep.equal(['Fruits and Fruit Juices']);
  });

  it('throws listing every eligible dump row that has no classification', () => {
    expect(() => mapClassifiedFoods([{ SRLegacyFoods: [APPLE, EGGWHITE] }], [
      { fdcId: 1, keep: true, name: 'Apple' },
    ], 'usda-full')).to.throw(/unclassified[\s\S]*2/);
  });

  it('does not demand classifications for rows the pre-filter excludes', () => {
    const babyfood = usdaFood(3, 'Babyfood, peas, strained', 'Baby Foods');
    const branded = usdaFood(4, "APPLEBEE'S, chicken tenders", 'Restaurant Foods');
    const out = mapClassifiedFoods([{ SRLegacyFoods: [APPLE, babyfood, branded] }], [
      { fdcId: 1, keep: true, name: 'Apple' },
    ], 'usda-full');
    expect(out.map((f) => f.name)).to.deep.equal(['Apple']);
  });

  it('ignores classifications whose fdcId is absent from the dumps (row removed upstream)', () => {
    const out = mapClassifiedFoods([{ SRLegacyFoods: [APPLE] }], [
      { fdcId: 1, keep: true, name: 'Apple' },
      { fdcId: 999, keep: true, name: 'Ghost' },
    ], 'usda-full');
    expect(out.map((f) => f.name)).to.deep.equal(['Apple']);
  });

  it('throws on a kept row with no name', () => {
    expect(() => mapClassifiedFoods([{ SRLegacyFoods: [APPLE] }], [
      { fdcId: 1, keep: true },
    ], 'usda-full')).to.throw(/name/);
  });

  it('throws on duplicate keep-names, case-insensitively', () => {
    const pear = usdaFood(5, 'Pears, raw', 'Fruits and Fruit Juices');
    expect(() => mapClassifiedFoods([{ SRLegacyFoods: [APPLE, pear] }], [
      { fdcId: 1, keep: true, name: 'Apple' },
      { fdcId: 5, keep: true, name: 'apple' },
    ], 'usda-full')).to.throw(/apple/i);
  });

  it('sorts output by search key', () => {
    const pear = usdaFood(5, 'Pears, raw', 'Fruits and Fruit Juices');
    const out = mapClassifiedFoods([{ SRLegacyFoods: [pear, APPLE] }], [
      { fdcId: 1, keep: true, name: 'apple' },
      { fdcId: 5, keep: true, name: 'Banana pear' },
    ], 'usda-full');
    expect(out.map((f) => f.name)).to.deep.equal(['apple', 'Banana pear']);
  });

  it('throws when a kept name collides with a reserved curated name, case-insensitively', () => {
    expect(() => mapClassifiedFoods([{ SRLegacyFoods: [APPLE] }], [
      { fdcId: 1, keep: true, name: 'Apple' },
    ], 'usda-full', new Set(['apple']))).to.throw(/curated/i);
  });

  it('dedups dump rows sharing an fdcId instead of misreporting a name collision', () => {
    const out = mapClassifiedFoods([
      { SRLegacyFoods: [APPLE] },
      { FoundationFoods: [APPLE] },
    ], [
      { fdcId: 1, keep: true, name: 'Apple' },
      { fdcId: 2, keep: false },
    ], 'usda-full');
    expect(out.map((f) => f.name)).to.deep.equal(['Apple']);
  });
});
