import { expect } from '@esm-bundle/chai';
import {
  extractNutritionFacts,
  extractServing,
  mapUsdaFood,
  mapUsdaDumps,
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

  it('handles missing foodNutrients without throwing', () => {
    expect(extractNutritionFacts({}).calories).to.equal(0);
  });
});

describe('extractServing()', () => {
  it('uses direct servingSize/servingSizeUnit when both valid', () => {
    expect(extractServing({ servingSize: 50, servingSizeUnit: 'g' }))
      .to.deep.equal({ servingSize: 50, servingUnit: 'g' });
  });

  it('normalizes "GRAM" / "Grams" to "g"', () => {
    expect(extractServing({ servingSize: 30, servingSizeUnit: 'GRAM' }).servingUnit).to.equal('g');
    expect(extractServing({ servingSize: 30, servingSizeUnit: 'Grams' }).servingUnit).to.equal('g');
  });

  it('falls back to first foodPortion.gramWeight when direct serving missing', () => {
    expect(extractServing({
      foodPortions: [{ gramWeight: 120 }],
    })).to.deep.equal({ servingSize: 120, servingUnit: 'g' });
  });

  it('defaults to 100 g when no signal available', () => {
    expect(extractServing({})).to.deep.equal({ servingSize: 100, servingUnit: 'g' });
  });

  it('defaults to 100 g when servingSize is zero or negative', () => {
    expect(extractServing({ servingSize: 0, servingSizeUnit: 'g' }).servingSize).to.equal(100);
    expect(extractServing({ servingSize: -1, servingSizeUnit: 'g' }).servingSize).to.equal(100);
  });

  it('defaults to 100 g when unit is unrecognized', () => {
    expect(extractServing({ servingSize: 50, servingSizeUnit: 'cup' }))
      .to.deep.equal({ servingSize: 100, servingUnit: 'g' });
  });

  it('emits count when first portion has a non-weight measureUnit with positive amount', () => {
    expect(extractServing({
      foodPortions: [{ amount: 1, measureUnit: { name: 'cup', abbreviation: 'cup' }, gramWeight: 240 }],
    })).to.deep.equal({ servingSize: 1, servingUnit: 'count' });
  });

  it('emits count for "1 medium" style portions (FNDDS shape)', () => {
    expect(extractServing({
      foodPortions: [{ amount: 1, measureUnit: { name: 'medium' }, gramWeight: 182 }],
    })).to.deep.equal({ servingSize: 1, servingUnit: 'count' });
  });

  it('emits count with the portion amount, not 1, when amount is given', () => {
    expect(extractServing({
      foodPortions: [{ amount: 2, measureUnit: { name: 'tbsp' }, gramWeight: 30 }],
    })).to.deep.equal({ servingSize: 2, servingUnit: 'count' });
  });

  it('still emits grams when the only portion is pure gramWeight (no measureUnit)', () => {
    expect(extractServing({
      foodPortions: [{ gramWeight: 120 }],
    })).to.deep.equal({ servingSize: 120, servingUnit: 'g' });
  });

  it('still emits grams when the portion unit name is itself a weight word', () => {
    expect(extractServing({
      foodPortions: [{ amount: 1, measureUnit: { name: 'gram' }, gramWeight: 100 }],
    })).to.deep.equal({ servingSize: 100, servingUnit: 'g' });
  });

  it('still emits grams when the direct servingSize/servingSizeUnit are valid, ignoring portions', () => {
    expect(extractServing({
      servingSize: 50, servingSizeUnit: 'g',
      foodPortions: [{ amount: 1, measureUnit: { name: 'cup' }, gramWeight: 240 }],
    })).to.deep.equal({ servingSize: 50, servingUnit: 'g' });
  });

  it('falls back to grams when count portion has zero or negative amount', () => {
    expect(extractServing({
      foodPortions: [{ amount: 0, measureUnit: { name: 'cup' }, gramWeight: 240 }],
    })).to.deep.equal({ servingSize: 240, servingUnit: 'g' });
  });

  it('treats measureUnit "undetermined" as no unit (falls back to grams)', () => {
    expect(extractServing({
      foodPortions: [{ amount: 1, measureUnit: { name: 'undetermined' }, gramWeight: 206 }],
    })).to.deep.equal({ servingSize: 206, servingUnit: 'g' });
  });

  it('uses portionDescription for FNDDS portions ("1 medium" overrides undetermined measureUnit)', () => {
    expect(extractServing({
      foodPortions: [{
        measureUnit: { name: 'undetermined' },
        portionDescription: '1 medium',
        gramWeight: 182,
      }],
    })).to.deep.equal({ servingSize: 1, servingUnit: 'count' });
  });

  it('ignores portionDescription that does not begin with a digit ("Guideline amount …")', () => {
    expect(extractServing({
      foodPortions: [{
        measureUnit: { name: 'undetermined' },
        portionDescription: 'Guideline amount per cup of beverage',
        gramWeight: 61,
      }],
    })).to.deep.equal({ servingSize: 61, servingUnit: 'g' });
  });

  it('uses the leading integer from portionDescription as the count amount', () => {
    expect(extractServing({
      foodPortions: [{
        measureUnit: { name: 'undetermined' },
        portionDescription: '2 cups',
        gramWeight: 480,
      }],
    })).to.deep.equal({ servingSize: 2, servingUnit: 'count' });
  });
});

describe('mapUsdaFood()', () => {
  it('produces a SourcedFood with id=<source>:<fdcId>', () => {
    const food: UsdaFood = {
      fdcId: 12345,
      description: 'Apple, raw',
      foodNutrients: [{ nutrientNumber: '208', amount: 52 }],
    };
    const result = mapUsdaFood(food, 'usda');
    expect(result?.id).to.equal('usda:12345');
    expect(result?.sourceId).to.equal('12345');
    expect(result?.source).to.equal('usda');
    expect(result?.name).to.equal('Apple, raw');
  });

  it('returns null for items missing fdcId', () => {
    expect(mapUsdaFood({ description: 'X' }, 'usda')).to.equal(null);
  });

  it('returns null for items with empty description', () => {
    expect(mapUsdaFood({ fdcId: 1, description: '' }, 'usda')).to.equal(null);
  });

  it('appends "(1 cup, 240g)" to the name when the food is countable', () => {
    const food: UsdaFood = {
      fdcId: 100, description: 'Milk, whole',
      foodPortions: [{ amount: 1, measureUnit: { name: 'cup' }, gramWeight: 240 }],
    };
    const result = mapUsdaFood(food, 'usda');
    expect(result?.servingUnit).to.equal('count');
    expect(result?.name).to.equal('Milk, whole (1 cup, 240g)');
  });

  it('rounds gram weight in the appended description to whole grams', () => {
    const food: UsdaFood = {
      fdcId: 101, description: 'Apple, raw',
      foodPortions: [{ amount: 1, measureUnit: { name: 'medium' }, gramWeight: 182.4 }],
    };
    expect(mapUsdaFood(food, 'usda')?.name).to.equal('Apple, raw (1 medium, 182g)');
  });

  it('does not append portion description when the food stays in grams', () => {
    const food: UsdaFood = {
      fdcId: 102, description: 'Chicken, raw',
      foodPortions: [{ gramWeight: 120 }],
    };
    const result = mapUsdaFood(food, 'usda');
    expect(result?.servingUnit).to.equal('g');
    expect(result?.name).to.equal('Chicken, raw');
  });

  it('uses portionDescription verbatim in the appended hint (FNDDS shape)', () => {
    const food: UsdaFood = {
      fdcId: 103, description: 'Apple, raw',
      foodPortions: [{
        measureUnit: { name: 'undetermined' },
        portionDescription: '1 medium',
        gramWeight: 182,
      }],
    };
    const result = mapUsdaFood(food, 'usda');
    expect(result?.servingUnit).to.equal('count');
    expect(result?.name).to.equal('Apple, raw (1 medium, 182g)');
  });

  it('does not append a portion hint when the portion is "undetermined" (SR-Legacy)', () => {
    const food: UsdaFood = {
      fdcId: 104, description: "APPLEBEE'S, chili",
      foodPortions: [{ amount: 1, measureUnit: { name: 'undetermined' }, gramWeight: 136 }],
    };
    const result = mapUsdaFood(food, 'usda');
    expect(result?.servingUnit).to.equal('g');
    expect(result?.name).to.equal("APPLEBEE'S, chili");
  });
});

describe('mapUsdaDumps()', () => {
  it('flattens Foundation + SRLegacy + Survey arrays into one list', () => {
    const dump: UsdaDump = {
      FoundationFoods: [{ fdcId: 1, description: 'B' }],
      SRLegacyFoods:   [{ fdcId: 2, description: 'A' }],
      SurveyFoods:     [{ fdcId: 3, description: 'C' }],
    };

    const result = mapUsdaDumps([dump], 'usda');
    expect(result.map((f) => f.name)).to.deep.equal(['A', 'B', 'C']);
  });

  it('sorts deterministically by name, then by sourceId', () => {
    const dump: UsdaDump = {
      FoundationFoods: [
        { fdcId: 5, description: 'Apple' },
        { fdcId: 1, description: 'Apple' },
      ],
    };
    expect(mapUsdaDumps([dump], 'usda').map((f) => f.sourceId)).to.deep.equal(['1', '5']);
  });

  it('drops items the mapper rejects (no fdcId)', () => {
    const dump: UsdaDump = {
      FoundationFoods: [
        { fdcId: 1, description: 'A' },
        { description: 'no-id' },
      ],
    };
    expect(mapUsdaDumps([dump], 'usda')).to.have.lengthOf(1);
  });

  it('returns [] for an empty dump set', () => {
    expect(mapUsdaDumps([{}], 'usda')).to.deep.equal([]);
  });

  it('is deterministic: same input -> same output ordering', () => {
    const dump: UsdaDump = {
      FoundationFoods: [
        { fdcId: 3, description: 'Banana' },
        { fdcId: 1, description: 'Apple' },
        { fdcId: 2, description: 'Cherry' },
      ],
    };
    const a = mapUsdaDumps([dump], 'usda');
    const b = mapUsdaDumps([dump], 'usda');
    expect(JSON.stringify(a)).to.equal(JSON.stringify(b));
  });
});
