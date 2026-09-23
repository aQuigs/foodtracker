import type { Pieces } from '../../src/domain/types.js';
import type { UsdaPortion } from '../../scripts/usdaPortions.js';

// Real foodPortions, extracted verbatim (see scripts/build-data.ts's cached
// USDA_CACHE_DIR zips) from Foundation/SR Legacy rows. `want` is pickPiece's
// expected return for `foodPortions`/`description`/`caloriesPer100`, or
// null. `caloriesPer100` defaults to 0 (the calorie-cap gate never fires)
// for fixtures that aren't testing it.
export type PortionFixture = {
  name: string;
  fdcId: number;
  description: string;
  foodPortions: UsdaPortion[];
  caloriesPer100?: number;
  want: { gramWeight: number; pieces: Pieces } | null;
};

export const USDA_PORTION_FIXTURES: PortionFixture[] = [
  {
    name: 'Pizza (cheese)',
    fdcId: 170317,
    description: 'Pizza, cheese topping, regular crust, frozen, cooked',
    foodPortions: [
      { id: 86418, amount: 1, gramWeight: 81, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'serving 9 servings per 24 oz package' },
      { id: 86419, amount: 1, gramWeight: 151, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'serving 3 servings per 15.1 oz package' },
      { id: 86423, amount: 1, gramWeight: 452, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'package 15.1 oz pizza' },
      { id: 86422, amount: 1, gramWeight: 727, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'package 24 oz pizza' },
      { id: 86424, amount: 1, gramWeight: 293, sequenceNumber: 7, measureUnit: { name: 'undetermined' }, modifier: 'package 9.8 oz pizza' },
      { id: 86420, amount: 1, gramWeight: 146, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'serving 2 servings per 9.8 oz package' },
      { id: 86421, amount: 1, gramWeight: 199, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'serving 1 serving per 8 oz box' },
      { id: 86425, amount: 1, gramWeight: 199, sequenceNumber: 8, measureUnit: { name: 'undetermined' }, modifier: 'package 8 oz pizza' },
    ],
    // Every "serving" portion here states one package size's own count ("2
    // servings per 9.8 oz package"), so none of them is a reference serving,
    // and there's no cup or fl oz portion either — a whole frozen pizza has
    // no signal it's a single sitting, so every "package" candidate drops.
    want: null,
  },
  {
    name: 'Angel food cake',
    fdcId: 172694,
    description: 'Cake, angelfood, commercially prepared',
    foodPortions: [
      { id: 91122, amount: 1, gramWeight: 28, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'piece (1/12 of 12 oz cake)' },
      { id: 91123, amount: 1, gramWeight: 340, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cake (9" dia x 4")' },
    ],
    want: { gramWeight: 28, pieces: { perServing: 1, noun: 'piece' } },
  },
  {
    name: 'Pie crust (baked)',
    fdcId: 175026,
    description: 'Pie crust, standard-type, prepared from recipe, baked',
    foodPortions: [
      { id: 95449, amount: 1, gramWeight: 23, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'piece (1/8 of 9" crust)' },
      { id: 95450, amount: 1, gramWeight: 180, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'crust, single 9"' },
    ],
    want: { gramWeight: 23, pieces: { perServing: 1, noun: 'piece' } },
  },
  {
    name: 'Dinner roll',
    fdcId: 172793,
    description: 'Rolls, dinner, plain, commercially prepared (includes brown-and-serve)',
    foodPortions: [
      { id: 91407, amount: 1, gramWeight: 25, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'each (pan, dinner, or small roll) (2" square, 2" high)' },
      { id: 91409, amount: 1, gramWeight: 86, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'roll (foot long frankfurter roll)' },
      { id: 91408, amount: 1, gramWeight: 43, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'roll (hamburger, frankfurter, onion roll, bun, large roll)' },
      { id: 91406, amount: 1, gramWeight: 28, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'roll (1 oz)' },
    ],
    want: { gramWeight: 28, pieces: { perServing: 1, noun: 'roll' } },
  },
  {
    name: 'Potato chips',
    fdcId: 169677,
    description: 'Snacks, potato chips, plain, salted',
    foodPortions: [
      { id: 85334, amount: 1, gramWeight: 227, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'bag (8 oz)' },
      { id: 85333, amount: 1, gramWeight: 28.35, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 85331, amount: 1, gramWeight: 28, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 85332, amount: 22, gramWeight: 28, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'chips' },
    ],
    want: { gramWeight: 28, pieces: { perServing: 22, noun: 'chips' } },
  },
  {
    name: 'Hard salami',
    fdcId: 172938,
    description: 'Salami, dry or hard, pork',
    foodPortions: [
      { id: 91725, amount: 1, gramWeight: 10, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'slice (3-1/8" dia x 1/16" thick)' },
      { id: 91724, amount: 1, gramWeight: 113, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'package (4 oz)' },
    ],
    want: { gramWeight: 10, pieces: { perServing: 1, noun: 'slice' } },
  },
  {
    name: 'Cola',
    fdcId: 174852,
    description: 'Beverages, carbonated, cola, regular',
    foodPortions: [
      { id: 95019, amount: 1, gramWeight: 492, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'drink, small (16 fl oz)' },
      { id: 95022, amount: 1, gramWeight: 1353, sequenceNumber: 7, measureUnit: { name: 'undetermined' }, modifier: 'drink, extra large (44 fl oz)' },
      { id: 95016, amount: 1, gramWeight: 30.7, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'fl oz' },
      { id: 95017, amount: 1, gramWeight: 370, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'can or bottle (12 fl oz)' },
      { id: 95021, amount: 1, gramWeight: 984, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'drink, large (32 fl oz)' },
      { id: 95020, amount: 1, gramWeight: 676, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'drink, medium (22 fl oz)' },
      { id: 95018, amount: 1, gramWeight: 492, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'can or bottle (16 fl oz)' },
    ],
    want: { gramWeight: 370, pieces: { perServing: 1, noun: 'can' } },
  },
  {
    name: 'Rotisserie chicken breast',
    fdcId: 171518,
    description: 'Chicken, broilers or fryers, rotisserie, original seasoning, breast, meat only, cooked',
    foodPortions: [
      { id: 88909, amount: 1, gramWeight: 483, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'breast breast with skin and bone' },
      { id: 88910, amount: 1, gramWeight: 28.35, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 88908, amount: 3, gramWeight: 85, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
    ],
    want: null,
  },
  {
    name: 'Orange',
    fdcId: 169097,
    description: 'Oranges, raw, all commercial varieties',
    foodPortions: [
      { id: 84229, amount: 1, gramWeight: 96, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'small (2-3/8" dia)' },
      { id: 84228, amount: 1, gramWeight: 184, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'large (3-1/16" dia)' },
      { id: 84227, amount: 1, gramWeight: 180, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, sections' },
      { id: 84230, amount: 1, gramWeight: 131, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'fruit (2-5/8" dia)' },
    ],
    want: { gramWeight: 131, pieces: { perServing: 1, noun: 'fruit' } },
  },
  {
    name: 'Milk chocolate',
    fdcId: 167587,
    description: 'Candies, milk chocolate',
    foodPortions: [
      { id: 81684, amount: 1, gramWeight: 7, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'bar, miniature' },
      { id: 81686, amount: 1, gramWeight: 168, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'cup chips' },
      { id: 81685, amount: 1, gramWeight: 44, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'bar (1.55 oz)' },
    ],
    want: { gramWeight: 44, pieces: { perServing: 1, noun: 'bar' } },
  },
  {
    name: 'Banana',
    fdcId: 173944,
    description: 'Bananas, raw',
    foodPortions: [
      { id: 93518, amount: 1, gramWeight: 126, sequenceNumber: 8, measureUnit: { name: 'undetermined' }, modifier: 'NLEA serving' },
      { id: 93517, amount: 1, gramWeight: 152, sequenceNumber: 7, measureUnit: { name: 'undetermined' }, modifier: 'extra large (9" or longer)' },
      { id: 93516, amount: 1, gramWeight: 136, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'large (8" to 8-7/8" long)' },
      { id: 93512, amount: 1, gramWeight: 150, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup, sliced' },
      { id: 93514, amount: 1, gramWeight: 101, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'small (6" to 6-7/8" long)' },
      { id: 93513, amount: 1, gramWeight: 81, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'extra small (less than 6" long)' },
      { id: 93515, amount: 1, gramWeight: 118, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'medium (7" to 7-7/8" long)' },
      { id: 93511, amount: 1, gramWeight: 225, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, mashed' },
    ],
    want: { gramWeight: 118, pieces: { perServing: 1, noun: 'medium' } },
  },
  {
    name: 'Apple',
    fdcId: 171688,
    description: "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)",
    foodPortions: [
      { id: 89191, amount: 1, gramWeight: 109, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup slices' },
      { id: 89193, amount: 1, gramWeight: 182, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'medium (3" dia)' },
      { id: 89194, amount: 1, gramWeight: 149, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'small (2-3/4" dia)' },
      { id: 89196, amount: 1, gramWeight: 242, sequenceNumber: 7, measureUnit: { name: 'undetermined' }, modifier: 'NLEA serving' },
      { id: 89190, amount: 1, gramWeight: 125, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, quartered or chopped' },
      { id: 89195, amount: 1, gramWeight: 101, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'extra small (2-1/2" dia)' },
      { id: 89192, amount: 1, gramWeight: 223, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'large (3-1/4" dia)' },
    ],
    want: { gramWeight: 182, pieces: { perServing: 1, noun: 'medium' } },
  },
  {
    name: 'Egg white',
    fdcId: 172183,
    description: 'Egg, white, raw, fresh',
    foodPortions: [
      { id: 90044, amount: 1, gramWeight: 243, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
      { id: 90043, amount: 1, gramWeight: 33, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'large' },
    ],
    want: { gramWeight: 33, pieces: { perServing: 1, noun: 'large' } },
  },
  {
    name: 'Tomato',
    fdcId: 170457,
    description: 'Tomatoes, red, ripe, raw, year round average',
    foodPortions: [
      { id: 86686, amount: 1, gramWeight: 123, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'medium whole (2-3/5" dia)' },
      { id: 86687, amount: 1, gramWeight: 20, sequenceNumber: 7, measureUnit: { name: 'undetermined' }, modifier: 'slice, medium (1/4" thick)' },
      { id: 86685, amount: 1, gramWeight: 182, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'large whole (3" dia)' },
      { id: 86684, amount: 1, gramWeight: 17, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'cherry' },
      { id: 86683, amount: 1, gramWeight: 62, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'Italian tomato' },
      { id: 86692, amount: 1, gramWeight: 15, sequenceNumber: 12, measureUnit: { name: 'undetermined' }, modifier: 'slice, thin/small' },
      { id: 86682, amount: 1, gramWeight: 180, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup, chopped or sliced' },
      { id: 86689, amount: 1, gramWeight: 91, sequenceNumber: 9, measureUnit: { name: 'undetermined' }, modifier: 'small whole (2-2/5" dia)' },
      { id: 86690, amount: 1, gramWeight: 27, sequenceNumber: 10, measureUnit: { name: 'undetermined' }, modifier: 'slice, thick/large (1/2" thick)' },
      { id: 86681, amount: 1, gramWeight: 149, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup cherry tomatoes' },
      { id: 86691, amount: 1, gramWeight: 31, sequenceNumber: 11, measureUnit: { name: 'undetermined' }, modifier: 'wedge (1/4 of medium tomato)' },
      { id: 86693, amount: 1, gramWeight: 148, sequenceNumber: 13, measureUnit: { name: 'undetermined' }, modifier: 'NLEA serving' },
      { id: 86688, amount: 1, gramWeight: 62, sequenceNumber: 8, measureUnit: { name: 'undetermined' }, modifier: 'plum tomato' },
    ],
    want: { gramWeight: 123, pieces: { perServing: 1, noun: 'medium' } },
  },
  {
    name: 'Nectarine',
    fdcId: 327357,
    description: 'Nectarines, raw',
    foodPortions: [
      { id: 119531, amount: 1, gramWeight: 129, sequenceNumber: 2, measureUnit: { name: 'each' }, modifier: '2-1/3" dia' },
      { id: 119533, amount: 1, gramWeight: 156, sequenceNumber: 4, measureUnit: { name: 'each' }, modifier: '2-3/4" dia' },
      { id: 119532, amount: 1, gramWeight: 142, sequenceNumber: 3, measureUnit: { name: 'each' }, modifier: ' 2-1/2" dia' },
      { id: 119534, amount: 1, gramWeight: 140, sequenceNumber: 5, measureUnit: { name: 'serving' }, modifier: 'NLEA' },
      { id: 119530, amount: 1, gramWeight: 143, sequenceNumber: 1, measureUnit: { name: 'cup' }, modifier: ' slices' },
      { id: 312679, amount: 1, gramWeight: 140, sequenceNumber: 1, measureUnit: { name: 'RACC' } },
    ],
    want: null,
  },
  {
    name: 'Onion',
    fdcId: 170000,
    description: 'Onions, raw',
    foodPortions: [
      { id: 85855, amount: 1, gramWeight: 160, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, chopped' },
      { id: 85861, amount: 1, gramWeight: 14, sequenceNumber: 7, measureUnit: { name: 'undetermined' }, modifier: 'slice, medium (1/8" thick)' },
      { id: 85860, amount: 1, gramWeight: 110, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'medium (2-1/2" dia)' },
      { id: 85858, amount: 1, gramWeight: 150, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'large' },
      { id: 85864, amount: 10, gramWeight: 60, sequenceNumber: 10, measureUnit: { name: 'undetermined' }, modifier: 'rings' },
      { id: 85857, amount: 1, gramWeight: 10, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'tbsp chopped' },
      { id: 85856, amount: 1, gramWeight: 115, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup, sliced' },
      { id: 85863, amount: 1, gramWeight: 9, sequenceNumber: 9, measureUnit: { name: 'undetermined' }, modifier: 'slice, thin' },
      { id: 85862, amount: 1, gramWeight: 70, sequenceNumber: 8, measureUnit: { name: 'undetermined' }, modifier: 'small' },
      { id: 85859, amount: 1, gramWeight: 38, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'slice, large (1/4" thick)' },
    ],
    want: { gramWeight: 110, pieces: { perServing: 1, noun: 'medium' } },
  },
  {
    name: 'Cantaloupe',
    fdcId: 746770,
    description: 'Melons, cantaloupe, raw',
    foodPortions: [
      { id: 187508, amount: 1, gramWeight: 69, sequenceNumber: 6, measureUnit: { name: 'wedge' }, modifier: 'medium (1/8 of medium melon)' },
      { id: 187506, amount: 1, gramWeight: 102, sequenceNumber: 4, measureUnit: { name: 'wedge' }, modifier: 'large (1/8 of large melon)' },
      { id: 187509, amount: 1, gramWeight: 441, sequenceNumber: 7, measureUnit: { name: 'each' }, modifier: 'small (about 4-1/4" dia)' },
      { id: 187505, amount: 1, gramWeight: 814, sequenceNumber: 3, measureUnit: { name: 'each' }, modifier: 'large (about 6-1/2" dia)' },
      { id: 187503, amount: 1, gramWeight: 160, sequenceNumber: 1, measureUnit: { name: 'cup' }, modifier: 'cubes' },
      { id: 187511, amount: 10, gramWeight: 138, sequenceNumber: 9, measureUnit: { name: 'pieces' }, modifier: 'balls' },
      { id: 187504, amount: 1, gramWeight: 156, sequenceNumber: 2, measureUnit: { name: 'cup' }, modifier: 'diced' },
      { id: 187507, amount: 1, gramWeight: 552, sequenceNumber: 5, measureUnit: { name: 'each' }, modifier: 'medium (about 5" dia)' },
      { id: 187510, amount: 1, gramWeight: 55, sequenceNumber: 8, measureUnit: { name: 'wedge' }, modifier: 'small (1/8 of small melon)' },
      { id: 312677, amount: 1, gramWeight: 140, sequenceNumber: 1, measureUnit: { name: 'RACC' } },
    ],
    want: { gramWeight: 69, pieces: { perServing: 1, noun: 'wedge' } },
  },
  {
    name: 'Leek',
    fdcId: 169246,
    description: 'Leeks, (bulb and lower leaf-portion), raw',
    foodPortions: [
      { id: 84503, amount: 1, gramWeight: 89, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
      { id: 84504, amount: 1, gramWeight: 89, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'leek' },
      { id: 84505, amount: 1, gramWeight: 6, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'slice' },
    ],
    want: { gramWeight: 89, pieces: { perServing: 1, noun: 'leek' } },
  },
  {
    name: 'Lemon',
    fdcId: 167746,
    description: 'Lemons, raw, without peel',
    foodPortions: [
      { id: 81882, amount: 1, gramWeight: 212, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, sections' },
      { id: 81884, amount: 1, gramWeight: 84, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'fruit (2-3/8" dia)' },
      { id: 81883, amount: 1, gramWeight: 58, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'fruit (2-1/8" dia)' },
      { id: 81886, amount: 1, gramWeight: 58, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'NLEA serving' },
      { id: 81885, amount: 1, gramWeight: 7, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'wedge or slice (1/8 of one 2-1/8" dia lemon)' },
    ],
    want: { gramWeight: 7, pieces: { perServing: 1, noun: 'wedge' } },
  },
  {
    name: 'Bread (white)',
    fdcId: 174924,
    description: 'Bread, white, commercially prepared (includes soft bread crumbs)',
    foodPortions: [
      { id: 95169, amount: 1, gramWeight: 29, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'slice' },
      { id: 95175, amount: 1, gramWeight: 12, sequenceNumber: 7, measureUnit: { name: 'undetermined' }, modifier: 'slice crust not eaten' },
      { id: 95172, amount: 1, gramWeight: 35, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'cup, cubes' },
      { id: 95171, amount: 1, gramWeight: 45, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'cup, crumbs' },
      { id: 95176, amount: 1, gramWeight: 20, sequenceNumber: 8, measureUnit: { name: 'undetermined' }, modifier: 'slice, thin' },
      { id: 95178, amount: 1, gramWeight: 15, sequenceNumber: 10, measureUnit: { name: 'undetermined' }, modifier: 'slice, very thin' },
      { id: 95174, amount: 1, gramWeight: 25, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'slice' },
      { id: 95173, amount: 1, gramWeight: 30, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'slice, large' },
      { id: 95177, amount: 1, gramWeight: 9, sequenceNumber: 9, measureUnit: { name: 'undetermined' }, modifier: 'slice thin, crust not eaten' },
      { id: 95170, amount: 1, gramWeight: 28.35, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
    ],
    want: { gramWeight: 25, pieces: { perServing: 1, noun: 'slice' } },
  },
  {
    name: 'Tortilla (corn)',
    fdcId: 175036,
    description: 'Tortillas, ready-to-bake or -fry, corn',
    foodPortions: [
      { id: 95471, amount: 1, gramWeight: 19, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'enchilada' },
      { id: 95470, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 95472, amount: 1, gramWeight: 24, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'tortilla' },
    ],
    want: { gramWeight: 24, pieces: { perServing: 1, noun: 'tortilla' } },
  },
  {
    name: 'Watermelon',
    fdcId: 167765,
    description: 'Watermelon, raw',
    foodPortions: [
      { id: 81937, amount: 1, gramWeight: 280, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'NLEA serving' },
      { id: 81933, amount: 1, gramWeight: 152, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup, diced' },
      { id: 81936, amount: 10, gramWeight: 122, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'watermelon balls' },
      { id: 81932, amount: 1, gramWeight: 154, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, balls' },
      { id: 81935, amount: 1, gramWeight: 286, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'wedge (approx 1/16 of melon)' },
      { id: 81934, amount: 1, gramWeight: 4518, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'melon (15" long x 7-1/2" dia)' },
    ],
    want: { gramWeight: 286, pieces: { perServing: 1, noun: 'wedge' } },
  },
  {
    name: 'Butter',
    fdcId: 173410,
    description: 'Butter, salted',
    foodPortions: [
      { id: 92456, amount: 1, gramWeight: 5, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'pat (1" sq, 1/3" high)' },
      { id: 92459, amount: 1, gramWeight: 113, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'stick' },
      { id: 92458, amount: 1, gramWeight: 227, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
      { id: 92457, amount: 1, gramWeight: 14.2, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'tbsp' },
    ],
    want: { gramWeight: 5, pieces: { perServing: 1, noun: 'pat' } },
  },
  {
    name: 'Crackers (saltine)',
    fdcId: 172746,
    description: 'Crackers, saltines (includes oyster, soda, soup)',
    foodPortions: [
      { id: 91262, amount: 1, gramWeight: 3, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'cracker square' },
      { id: 91266, amount: 1, gramWeight: 45, sequenceNumber: 9, measureUnit: { name: 'undetermined' }, modifier: 'cup oyster crackers' },
      { id: 91258, amount: 5, gramWeight: 14.9, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'crackers' },
      { id: 91260, amount: 1, gramWeight: 70, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'cup, crushed' },
      { id: 91261, amount: 5, gramWeight: 15, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'crackers square (1 serving)' },
      { id: 91263, amount: 1, gramWeight: 10, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'cracker, round large' },
      { id: 91259, amount: 0.5, gramWeight: 14.2, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 91264, amount: 1, gramWeight: 1, sequenceNumber: 7, measureUnit: { name: 'undetermined' }, modifier: 'cracker, oyster' },
      { id: 91265, amount: 1, gramWeight: 6, sequenceNumber: 8, measureUnit: { name: 'undetermined' }, modifier: 'cracker, rectangle' },
    ],
    want: { gramWeight: 14.9, pieces: { perServing: 5, noun: 'crackers' } },
  },
  {
    name: 'Shoestring fries',
    fdcId: 170452,
    description: 'Potatoes, french fried, shoestring, salt added in processing, frozen, oven-heated',
    foodPortions: [
      { id: 86674, amount: 10, gramWeight: 21, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'strip' },
    ],
    want: { gramWeight: 21, pieces: { perServing: 10, noun: 'strips' } },
  },
  {
    name: 'Cherry pie',
    fdcId: 172780,
    description: 'Pie, cherry, commercially prepared',
    foodPortions: [
      { id: 91380, amount: 1, gramWeight: 117, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'piece (1/6 of 8" pie)' },
      { id: 91378, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 91379, amount: 1, gramWeight: 125, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'piece (1/8 of 9" dia)' },
    ],
    want: { gramWeight: 117, pieces: { perServing: 1, noun: 'piece' } },
  },
  {
    // "the food itself" only breaks a tie between candidates within 1.5x of
    // each other's weight: fish (332g) is over 2x the filet (149g),
    // so the tie goes to the lighter, more natural "1 filet" instead.
    name: 'Brook trout (raw)',
    fdcId: 175181,
    description: 'Fish, trout, brook, raw, New York State',
    foodPortions: [
      { id: 95808, amount: 1, gramWeight: 149, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'filet' },
      { id: 95809, amount: 1, gramWeight: 332, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'fish' },
    ],
    want: { gramWeight: 149, pieces: { perServing: 1, noun: 'filet' } },
  },
  {
    // State agreement: "cooked from 4 oz raw" states this candidate is the
    // opposite state from the row (raw ground game meat) — dropped, leaving
    // no valid piece.
    name: 'Deer (ground, raw)',
    fdcId: 172602,
    description: 'Game meat, deer, ground, raw',
    foodPortions: [
      { id: 90942, amount: 1, gramWeight: 85, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'patty (cooked from 4 oz raw)' },
      { id: 90943, amount: 1, gramWeight: 28.35, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
    ],
    want: null,
  },
  {
    // Skin agreement: "thigh with skin" and "thigh without skin" tie on
    // class and tier; the row's own "meat and skin" description breaks the
    // tie toward the candidate that agrees (137 g, not 116 g).
    name: 'Chicken thigh (meat and skin, roasted)',
    fdcId: 173625,
    description: 'Chicken, broilers or fryers, thigh, meat and skin, cooked, roasted',
    foodPortions: [
      { id: 92972, amount: 1, gramWeight: 137, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'thigh with skin' },
      { id: 92973, amount: 1, gramWeight: 116, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'thigh without skin' },
      { id: 92971, amount: 3, gramWeight: 85, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
    ],
    want: { gramWeight: 137, pieces: { perServing: 1, noun: 'thigh' } },
  },
  {
    // A typical-size word ("regular") ranks like medium, ahead of an
    // other-size word ("thin") — Swiss cheese keeps its 21.9 g regular
    // slice, not the 10.9 g thin one.
    name: 'Swiss cheese',
    fdcId: 746767,
    description: 'Cheese, swiss',
    foodPortions: [
      { id: 187498, amount: 1, gramWeight: 21.9, sequenceNumber: 1, measureUnit: { name: 'slice' }, modifier: 'regular' },
      { id: 187499, amount: 1, gramWeight: 10.9, sequenceNumber: 2, measureUnit: { name: 'slice' }, modifier: 'thin' },
      { id: 312631, amount: 1, gramWeight: 30, sequenceNumber: 1, measureUnit: { name: 'RACC' }, modifier: '' },
    ],
    want: { gramWeight: 21.9, pieces: { perServing: 1, noun: 'slice' } },
  },
  {
    // "snack-size" and "thin" both rank as other-size, below "regular" —
    // Rye bread keeps its 32 g regular slice over both, including the 25 g
    // thin one, its closer competitor by weight.
    name: 'Rye bread',
    fdcId: 172684,
    description: 'Bread, rye',
    foodPortions: [
      { id: 91099, amount: 1, gramWeight: 7, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'slice, snack-size' },
      { id: 91100, amount: 1, gramWeight: 25, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'slice, thin' },
      { id: 91097, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 91098, amount: 1, gramWeight: 32, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'slice, regular' },
    ],
    want: { gramWeight: 32, pieces: { perServing: 1, noun: 'slice' } },
  },
  {
    // Yield scope: "chop without refuse (Yield from ...)" names the piece
    // itself (chop isn't a generic yield noun), so it survives — this is the
    // cooked chop's own edible weight, not a batch yield.
    name: 'Pork chop (cooked)',
    fdcId: 167827,
    description: 'Pork, fresh, loin, center loin (chops), bone-in, separable lean and fat, cooked, broiled',
    foodPortions: [
      { id: 82043, amount: 3, gramWeight: 85, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 82044, amount: 1, gramWeight: 157, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'chop without refuse (Yield from 1 cooked chop, with refuse, weighing 209g)' },
    ],
    want: { gramWeight: 157, pieces: { perServing: 1, noun: 'chop' } },
  },
  {
    // "patty (yield from 135.8 g raw meat)" names the patty itself, and
    // "raw" here follows "from" rather than leading into it — this isn't a
    // state mismatch, just a derivation note. The patty survives.
    name: 'Emu (ground, cooked)',
    fdcId: 172833,
    description: 'Emu, ground, cooked, pan-broiled',
    foodPortions: [
      { id: 91526, amount: 1, gramWeight: 85, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'serving ( 3 oz )' },
      { id: 91525, amount: 1, gramWeight: 109, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'patty (yield from 135.8 g raw meat)' },
    ],
    want: { gramWeight: 109, pieces: { perServing: 1, noun: 'patty' } },
  },
  {
    // "ear, medium (...) yields" survives the yield scope (ear is in the
    // cut set) and combines with the medium size word — but the typical-size
    // word then drops since "ear" is a real noun, leaving "ear" alone.
    name: 'Corn (raw, on the cob)',
    fdcId: 169998,
    description: 'Corn, sweet, yellow, raw',
    foodPortions: [
      { id: 85848, amount: 1, gramWeight: 102, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'ear, medium (6-3/4" to 7-1/2" long) yields' },
      { id: 85846, amount: 1, gramWeight: 145, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
      { id: 85849, amount: 1, gramWeight: 73, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'ear, small (5-1/2" to 6-1/2" long)' },
      { id: 85847, amount: 1, gramWeight: 143, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'ear, large (7-3/4" to 9" long) yields' },
    ],
    want: { gramWeight: 102, pieces: { perServing: 1, noun: 'ear' } },
  },
  {
    // Whole head phrase: "midget Gherkin" isn't brand filler — it's a
    // lowercase qualifier plus a capitalized head noun, so both survive,
    // lowercased, as one noun.
    name: 'Sweet pickles (gherkin)',
    fdcId: 169378,
    description: 'Pickles, cucumber, sweet (includes bread and butter pickles)',
    foodPortions: [
      { id: 84735, amount: 1, gramWeight: 160, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, chopped' },
      { id: 84736, amount: 1, gramWeight: 153, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup sliced or chips' },
      { id: 84737, amount: 1, gramWeight: 35, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'large Gherkin (3" long)' },
      { id: 84738, amount: 1, gramWeight: 25, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'Gherkin (2-3/4" long)' },
      { id: 84739, amount: 1, gramWeight: 6, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'midget Gherkin (2-1/8" long)' },
      { id: 84740, amount: 1, gramWeight: 7.5, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'chip' },
      { id: 84741, amount: 1, gramWeight: 15, sequenceNumber: 7, measureUnit: { name: 'undetermined' }, modifier: 'small Gherkin (2-1/2" long)' },
      { id: 84742, amount: 1, gramWeight: 20, sequenceNumber: 8, measureUnit: { name: 'undetermined' }, modifier: 'spear Gherkin' },
    ],
    want: { gramWeight: 6, pieces: { perServing: 1, noun: 'midget gherkin' } },
  },
  {
    // A hyphenated head word stays whole rather than being split into two
    // tokens.
    name: 'Balsam-pear',
    fdcId: 168393,
    description: 'Balsam-pear (bitter gourd), pods, raw',
    foodPortions: [
      { id: 83023, amount: 1, gramWeight: 93, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup (1/2" pieces)' },
      { id: 83024, amount: 1, gramWeight: 124, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'balsam-pear' },
    ],
    want: { gramWeight: 124, pieces: { perServing: 1, noun: 'balsam-pear' } },
  },
  {
    // The whole head phrase is a natural compound noun ("hush puppy"), not
    // a size word plus a bare noun.
    name: 'Hush puppies',
    fdcId: 174999,
    description: 'Hush puppies, prepared from recipe',
    foodPortions: [
      { id: 95381, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 95383, amount: 1, gramWeight: 22, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'hush puppy' },
      { id: 95382, amount: 1, gramWeight: 152, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
    ],
    want: { gramWeight: 22, pieces: { perServing: 1, noun: 'hush puppy' } },
  },
  {
    // A multi-word noun already plural in the source ("pea pods")
    // singularizes to its base form and pluralizes back correctly for a
    // 10-piece serving.
    name: 'Snow peas (edible-podded)',
    fdcId: 170010,
    description: 'Peas, edible-podded, raw',
    foodPortions: [
      { id: 85890, amount: 1, gramWeight: 98, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, chopped' },
      { id: 85891, amount: 1, gramWeight: 63, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup, whole' },
      { id: 85892, amount: 10, gramWeight: 34, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'pea pods' },
    ],
    want: { gramWeight: 34, pieces: { perServing: 10, noun: 'pea pods' } },
  },
  {
    // Fraction promotion: the "1/8 of 15 oz ring" piece (53 g) is eligible,
    // but its threshold (half of 8x its own weight, 212 g) is well above
    // every whole candidate here (up to 142 g) — none get dropped, so the
    // ordinary "1 pastry" candidate wins on its own tier.
    name: 'Cinnamon danish',
    fdcId: 172753,
    description: 'Danish pastry, cinnamon, enriched',
    foodPortions: [
      { id: 91285, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 91289, amount: 1, gramWeight: 53, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'Toaster Strudel' },
      { id: 91286, amount: 1, gramWeight: 142, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'large (approx 7" dia)' },
      { id: 91288, amount: 1, gramWeight: 65, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'pastry (4-1/4" dia)' },
      { id: 91287, amount: 1, gramWeight: 35, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'small or frozen (approx 3" dia)' },
      { id: 91290, amount: 1, gramWeight: 53, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'piece (1/8 of 15 oz ring)' },
    ],
    want: { gramWeight: 65, pieces: { perServing: 1, noun: 'pastry' } },
  },
  {
    // Accessory drop: "package without flavor packet" names "packet" as a
    // part this row leaves out, so the bare "packet" portion elsewhere in
    // the same row is dropped as a candidate — leaving "package" itself,
    // which then drops too on its own: no reference serving and no cup or
    // fl oz portion give it a reason to ship.
    name: 'Ramen noodles (dry)',
    fdcId: 171177,
    description: 'Soup, ramen noodle, any flavor, dry',
    foodPortions: [
      { id: 88120, amount: 1, gramWeight: 5.8, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'packet' },
      { id: 88119, amount: 1, gramWeight: 81, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'package without flavor packet' },
    ],
    want: null,
  },
  {
    // Counts in asides: "oz (22 whole kernels)" is a measure portion, but
    // its aside states a real piece count directly.
    name: 'Almonds (dry roasted)',
    fdcId: 168596,
    description: 'Nuts, almonds, dry roasted, with salt added',
    foodPortions: [
      { id: 83389, amount: 1, gramWeight: 28.35, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'oz (22 whole kernels)' },
      { id: 83388, amount: 1, gramWeight: 138, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup whole kernels' },
    ],
    want: { gramWeight: 28.35, pieces: { perServing: 22, noun: 'kernels' } },
  },
  {
    // The tiny gate drops the bare 0.7 g "kernel" portion as a trace amount
    // before ranking even happens, leaving the aside-derived "49 kernels"
    // candidate — both classify as sub-piece — as the only survivor.
    name: 'Pistachios (dry roasted)',
    fdcId: 169426,
    description: 'Nuts, pistachio nuts, dry roasted, with salt added',
    foodPortions: [
      { id: 84844, amount: 1, gramWeight: 28.35, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'oz (49 kernels)' },
      { id: 84843, amount: 1, gramWeight: 123, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
      { id: 84845, amount: 1, gramWeight: 0.7, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'kernel' },
    ],
    want: { gramWeight: 28.35, pieces: { perServing: 49, noun: 'kernels' } },
  },
  {
    // "serving (1 hot dog)" is a serving portion, but its aside states a
    // one-piece count with a two-word noun.
    name: 'Frankfurter (meat)',
    fdcId: 172968,
    description: 'Frankfurter, meat',
    foodPortions: [
      { id: 91762, amount: 1, gramWeight: 52, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'serving (1 hot dog)' },
    ],
    want: { gramWeight: 52, pieces: { perServing: 1, noun: 'hot dog' } },
  },
  {
    // Tiny gate: 5 basil leaves weigh 2.5 g in total, under the 3 g floor —
    // the row's other portions are a measure (tbsp) and a volume (cup), not
    // pieces, so this falls back to no piece at all.
    name: 'Basil (fresh)',
    fdcId: 172232,
    description: 'Basil, fresh',
    foodPortions: [
      { id: 90125, amount: 5, gramWeight: 2.5, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'leaves' },
      { id: 90126, amount: 2, gramWeight: 5.3, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'tbsp, chopped' },
      { id: 90127, amount: 0.25, gramWeight: 6, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'cup leaves, whole' },
    ],
    want: null,
  },
  {
    // "Chiclets" alone (no other word) is too uncertain a brand-capitalized
    // word to use as a noun and drops entirely, leaving the bare "stick"
    // portion as the only candidate.
    name: 'Chewing gum',
    fdcId: 168771,
    description: 'Chewing gum',
    foodPortions: [
      { id: 83751, amount: 10, gramWeight: 16, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'Chiclets' },
      { id: 83752, amount: 1, gramWeight: 8, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'block' },
      { id: 83750, amount: 1, gramWeight: 3, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'stick' },
    ],
    want: { gramWeight: 3, pieces: { perServing: 1, noun: 'stick' } },
  },
  {
    // Calorie cap: a whole link is 1,237 cal at this row's own
    // calories/100g — the only other portion ("oz") is a measure, not a
    // piece, so the row falls back to no piece at all.
    name: 'Kielbasa (fully cooked, grilled)',
    fdcId: 173877,
    description: 'Kielbasa, fully cooked, grilled',
    caloriesPer100: 337,
    foodPortions: [
      { id: 93419, amount: 3, gramWeight: 85, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 93420, amount: 1, gramWeight: 367, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'link' },
    ],
    want: null,
  },
  {
    // Calorie cap: this row has no RACC/NLEA/serving portion, so the
    // one-sitting weight gate never engages — the whole bag still fails on
    // calories alone (1,005 cal at this row's own calories/100g).
    name: 'Tortilla chips',
    fdcId: 167558,
    description: 'Snacks, tortilla chips, plain, white corn, salted',
    caloriesPer100: 472,
    foodPortions: [
      { id: 81630, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 81631, amount: 1, gramWeight: 213, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'bag' },
    ],
    want: null,
  },
  {
    // One-sitting weight, isolated from the calorie cap: the can (303 g) is
    // more than double this row's own "serving 1/2 cup" (121 g) reference,
    // yet costs only 197 cal/count — the weight gate is the only thing that
    // removes it, leaving no piece.
    name: 'Tomato soup (canned, condensed, reduced sodium)',
    fdcId: 171587,
    description: 'Soup, tomato, canned, condensed, reduced sodium',
    caloriesPer100: 65,
    foodPortions: [
      { id: 89032, amount: 1, gramWeight: 121, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'serving 1/2 cup' },
      { id: 89033, amount: 1, gramWeight: 303, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'can 10.7 oz' },
    ],
    want: null,
  },
  {
    // Tiny gate: a single peanut weighs 1 g, under the 3 g floor — the
    // row's other portions are measures (oz, cup), not pieces, so it falls
    // back to no piece.
    name: 'Peanuts (dry-roasted, without salt)',
    fdcId: 173806,
    description: 'Peanuts, all types, dry-roasted, without salt',
    caloriesPer100: 587,
    foodPortions: [
      { id: 93280, amount: 1, gramWeight: 146, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
      { id: 93281, amount: 1, gramWeight: 28.35, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 93282, amount: 1, gramWeight: 1, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'peanut' },
    ],
    want: null,
  },
  {
    // Don't apply the one-sitting weight gate to the whole class: the whole
    // avocado (201 g) is well over 2x its own NLEA serving (50 g), but a
    // plain whole is exempt — it ships as "1 avocado", passing both gates
    // (322 cal/count, well under the cap).
    name: 'Avocado',
    fdcId: 171705,
    description: 'Avocados, raw, all commercial varieties',
    caloriesPer100: 160,
    foodPortions: [
      { id: 89223, amount: 1, gramWeight: 150, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, cubes' },
      { id: 89224, amount: 1, gramWeight: 230, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup, pureed' },
      { id: 89225, amount: 1, gramWeight: 146, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'cup, sliced' },
      { id: 89226, amount: 1, gramWeight: 201, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'avocado, NS as to Florida or California' },
      { id: 89227, amount: 1, gramWeight: 50, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'NLEA Serving' },
    ],
    want: { gramWeight: 201, pieces: { perServing: 1, noun: 'avocado' } },
  },
  {
    // Fix 4, yield scope: "lemon yields" and "wedge yields" both name the
    // source fruit rather than a cut in the allow-list (chop, steak, ear,
    // …), so neither survives — this is fresh-squeezed juice, not a piece
    // of it.
    name: 'Lemon juice (raw)',
    fdcId: 167747,
    description: 'Lemon juice, raw',
    caloriesPer100: 22,
    foodPortions: [
      { id: 81887, amount: 1, gramWeight: 244, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
      { id: 81888, amount: 1, gramWeight: 30.5, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'fl oz' },
      { id: 81889, amount: 1, gramWeight: 48, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'lemon yields' },
      { id: 81890, amount: 1, gramWeight: 5.9, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'wedge yields' },
    ],
    want: null,
  },
  {
    // A roast is definitionally a multi-serving joint and never ships as
    // the piece, whatever its own calorie/weight numbers say — the only
    // other candidate ("piece, cooked, excluding refuse (Yield from ...)")
    // is already excluded by the yield-scope cut set ("piece" isn't a cut),
    // so this row falls back to no piece at all.
    name: 'Pork tenderloin (cooked)',
    fdcId: 168250,
    description: 'Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted',
    caloriesPer100: 143,
    foodPortions: [
      { id: 82751, amount: 3, gramWeight: 85, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 82752, amount: 1, gramWeight: 333, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'piece, cooked, excluding refuse (yield from 1 lb raw meat with refuse)' },
      { id: 82753, amount: 1, gramWeight: 402, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'roast' },
    ],
    want: null,
  },
  {
    // Both "block" portions are stated as a fraction (0.25, 0.2) of the
    // whole block — one count of either would be the whole block, not the
    // stated slice, so a multi-class candidate under 1 never ships. The
    // only other portion ("cup") is a volume measure, so this falls back
    // to no piece.
    name: 'Tofu (firm)',
    fdcId: 172448,
    description: 'Tofu, firm, prepared with calcium sulfate and magnesium chloride (nigari)',
    caloriesPer100: 78,
    foodPortions: [
      { id: 90638, amount: 0.5, gramWeight: 126, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
      { id: 90639, amount: 0.25, gramWeight: 81, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'block' },
      { id: 90640, amount: 0.2, gramWeight: 91, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'block' },
    ],
    want: null,
  },
  {
    // Same fractional-multi rule, on a real "0.2 head" row (green
    // cauliflower's only piece-shaped portion).
    name: 'Cauliflower (green, cooked)',
    fdcId: 169390,
    description: 'Cauliflower, green, cooked, no salt added',
    caloriesPer100: 32,
    foodPortions: [
      { id: 84779, amount: 0.2, gramWeight: 90, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'head' },
    ],
    want: null,
  },
  {
    // A container with no reference serving still ships when it's a small
    // packet/stick/envelope under 50 g — a single-serve condiment packet
    // needs no other signal.
    name: 'Soy sauce',
    fdcId: 174277,
    description: 'Soy sauce made from soy and wheat (shoyu)',
    caloriesPer100: 53,
    foodPortions: [
      { id: 94068, amount: 1, gramWeight: 16, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'tbsp' },
      { id: 94069, amount: 1, gramWeight: 5.3, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'tsp' },
      { id: 94070, amount: 1, gramWeight: 255, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
      { id: 94071, amount: 1, gramWeight: 8.9, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'individual packet' },
    ],
    want: { gramWeight: 8.9, pieces: { perServing: 1, noun: 'packet' } },
  },
  {
    // A container with no reference serving, no beverage signal, and no
    // bare 1-cup portion to compare against has no reason to ship —
    // "package (6 oz)" drops even though it's the only piece-shaped
    // candidate on the row.
    name: 'Tilsit cheese',
    fdcId: 170852,
    description: 'Cheese, tilsit',
    caloriesPer100: 340,
    foodPortions: [
      { id: 87403, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 87404, amount: 1, gramWeight: 170, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'package (6 oz)' },
    ],
    want: null,
  },
  {
    // A container's own amount must be exactly 1 — "5 packages" would be
    // five packages' worth in one count, not one package.
    name: 'Romano cheese',
    fdcId: 171249,
    description: 'Cheese, romano',
    caloriesPer100: 387,
    foodPortions: [
      { id: 88267, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 88268, amount: 5, gramWeight: 142, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'package (5 oz)' },
    ],
    want: null,
  },
  {
    // "with skin and bone" excludes this portion (bone is present), even
    // though "bone" and "with" aren't adjacent; "bone and skin removed"
    // states the same boneless piece the row's own nutrition describes and
    // is spared.
    name: 'Chicken breast (cooked)',
    fdcId: 171477,
    description: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
    caloriesPer100: 165,
    foodPortions: [
      { id: 88817, amount: 1, gramWeight: 140, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, chopped or diced' },
      { id: 88818, amount: 1, gramWeight: 52, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'unit (yield from 1 lb ready-to-cook chicken)' },
      { id: 88819, amount: 0.5, gramWeight: 86, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'breast, bone and skin removed' },
    ],
    want: { gramWeight: 86, pieces: { perServing: 0.5, noun: 'breast' } },
  },
  {
    // A sub-piece/multi word is only searched for in the head phrase, before
    // any comma — "round" here qualifies the cut ("round" shape), it isn't
    // the noun, so "waffle" (not "round") ships.
    name: 'Waffle (plain, from recipe)',
    fdcId: 175039,
    description: 'Waffles, plain, prepared from recipe',
    caloriesPer100: 0,
    foodPortions: [
      { id: 95482, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 95483, amount: 1, gramWeight: 75, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'waffle, round (7" dia)' },
    ],
    want: { gramWeight: 75, pieces: { perServing: 1, noun: 'waffle' } },
  },
  {
    // A non-integer count above 1 ships as one count at its per-count
    // weight instead of the literal fraction — a tap logs whole links, not
    // 2.33 of one.
    name: 'Cheese smokie',
    fdcId: 171623,
    description: 'Cheesefurter, cheese smokie, pork, beef',
    caloriesPer100: 328,
    foodPortions: [
      { id: 89090, amount: 2.33, gramWeight: 100, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'links' },
    ],
    want: { gramWeight: 100 / 2.33, pieces: { perServing: 1, noun: 'link' } },
  },
  {
    // Same non-integer-count rule, on a sub-piece noun ("slice") instead of
    // a bare noun.
    name: 'Peppered loaf',
    fdcId: 174574,
    description: 'Peppered loaf, pork, beef',
    caloriesPer100: 149,
    foodPortions: [
      { id: 94606, amount: 3.52, gramWeight: 100, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'slices' },
    ],
    want: { gramWeight: 100 / 3.52, pieces: { perServing: 1, noun: 'slice' } },
  },
  {
    // A noun that only exists because a capitalized word was dropped never
    // ships: "Arrowroot biscuit" drops "Arrowroot" as brand-ish filler, but
    // the "biscuit" left behind is too uncertain to trust on its own — the
    // bare "cracker" portion is too light for the tiny gate, and the
    // "individual box" is a container with no reason to ship, so the row
    // falls back to no piece at all.
    name: 'Animal crackers',
    fdcId: 168014,
    description: 'Cookies, animal crackers (includes arrowroot, tea biscuits)',
    caloriesPer100: 446,
    foodPortions: [
      { id: 82388, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 82389, amount: 1, gramWeight: 4.9, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'Arrowroot biscuit (include Arrowroot cookie)' },
      { id: 82390, amount: 1, gramWeight: 2.5, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'cracker' },
      { id: 82391, amount: 1, gramWeight: 57, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'individual box (2 oz)' },
    ],
    want: null,
  },
  {
    // Only an oz or serving lead can state a piece count in its aside — a
    // cup lead restating the same measure in piece-like words ("cup shelled
    // (50 halves)") never becomes a candidate, leaving the oz-based aside
    // ("14 halves") as the only real piece; the irregular plural "halves"
    // also singularizes back to "half" for the noun.
    name: 'Walnuts (english)',
    fdcId: 170187,
    description: 'Nuts, walnuts, english',
    caloriesPer100: 654,
    foodPortions: [
      { id: 86201, amount: 1, gramWeight: 117, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup, chopped' },
      { id: 86202, amount: 1, gramWeight: 80, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cup, ground' },
      { id: 86203, amount: 1, gramWeight: 28, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'cup, in shell, edible yield (7 nuts)' },
      { id: 86204, amount: 1, gramWeight: 100, sequenceNumber: 4, measureUnit: { name: 'undetermined' }, modifier: 'cup shelled (50 halves)' },
      { id: 86205, amount: 1, gramWeight: 120, sequenceNumber: 5, measureUnit: { name: 'undetermined' }, modifier: 'cup pieces or chips' },
      { id: 86206, amount: 1, gramWeight: 28.35, sequenceNumber: 6, measureUnit: { name: 'undetermined' }, modifier: 'oz (14 halves)' },
    ],
    want: { gramWeight: 28.35, pieces: { perServing: 14, noun: 'halves' } },
  },
  {
    // A "recipe yield (60 pieces)" aside restates a batch yield, not a
    // piece count — its lead word ("recipe") isn't oz or serving, so it
    // never becomes a candidate, leaving the bare "piece" portion as the
    // only one.
    name: 'Chocolate marshmallow fudge (from recipe)',
    fdcId: 169669,
    description: 'Candies, fudge, chocolate marshmallow, prepared-from-recipe',
    caloriesPer100: 453,
    foodPortions: [
      { id: 85320, amount: 1, gramWeight: 20, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'piece' },
      { id: 85321, amount: 1, gramWeight: 1229, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'recipe yield (60 pieces)' },
    ],
    want: { gramWeight: 20, pieces: { perServing: 1, noun: 'piece' } },
  },
  {
    // A whole-class noun absent from the row's own description and heavier
    // than 3x its cup portion is more likely a mis-parsed fragment than a
    // real single piece — "squash" (431 g) is over 3x the 115 g cup here,
    // so it drops, leaving no piece at all.
    name: 'Purslane (cooked)',
    fdcId: 169275,
    description: 'Purslane, cooked, boiled, drained, without salt',
    caloriesPer100: 18,
    foodPortions: [
      { id: 84580, amount: 1, gramWeight: 115, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'cup' },
      { id: 84581, amount: 1, gramWeight: 431, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'squash' },
    ],
    want: null,
  },
  {
    // A MULTI word the row's own description names as the food itself
    // ("fish sticks") ranks as whole, not as a container/multi-serving item
    // — "stick" beats the sub-piece "piece", even though sub-piece normally
    // outranks multi.
    name: 'Fish sticks',
    fdcId: 174195,
    description: 'Fish, fish sticks, frozen, prepared',
    caloriesPer100: 277,
    foodPortions: [
      { id: 93907, amount: 1, gramWeight: 57, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'piece (4" x 2" x 1/2")' },
      { id: 93908, amount: 1, gramWeight: 28, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'stick (4" x 1" x 1/2")' },
    ],
    want: { gramWeight: 28, pieces: { perServing: 1, noun: 'stick' } },
  },
  {
    // The calorie cap gates a candidate's per-count weight (gramWeight /
    // amount), not its stated portion weight — "0.5 bird" states a trace
    // 129 g, but that's 258 g per whole bird, which costs 668 cal at this
    // row's own calories/100g; the "1 bird whole" portion fails the same
    // way, so the row falls back to no piece at all.
    name: 'Cornish hen (meat and skin, roasted)',
    fdcId: 171107,
    description: 'Chicken, cornish game hens, meat and skin, cooked, roasted',
    caloriesPer100: 259,
    foodPortions: [
      { id: 87977, amount: 3, gramWeight: 85, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 87978, amount: 0.5, gramWeight: 129, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'bird' },
      { id: 87979, amount: 1, gramWeight: 257, sequenceNumber: 3, measureUnit: { name: 'undetermined' }, modifier: 'bird whole' },
    ],
    want: null,
  },
  {
    // A Foundation row's own structured unit name ("tomatoes") is a
    // trustworthy noun even with no modifier text at all — it also
    // round-trips through the "-oes" singularize/pluralize rule
    // (tomatoes -> tomato -> tomatoes).
    name: 'Grape tomatoes',
    fdcId: 321360,
    description: 'Tomatoes, grape, raw',
    caloriesPer100: 27,
    foodPortions: [
      { id: 118808, amount: 5, gramWeight: 49.7, sequenceNumber: 1, measureUnit: { name: 'tomatoes' }, modifier: '' },
      { id: 312817, amount: 1, gramWeight: 85, sequenceNumber: 1, measureUnit: { name: 'RACC' } },
      { id: 118809, amount: 1, gramWeight: 152, sequenceNumber: 2, measureUnit: { name: 'cup' }, modifier: '' },
    ],
    want: { gramWeight: 49.7, pieces: { perServing: 5, noun: 'tomatoes' } },
  },
  {
    // A "-fish" noun never pluralizes, even for a 8-count serving — the
    // generic "x/ch/sh/s/z -> +es" suffix rule would otherwise turn
    // "crayfish" into "crayfishes".
    name: 'Crayfish (wild, raw)',
    fdcId: 174206,
    description: 'Crustaceans, crayfish, mixed species, wild, raw',
    caloriesPer100: 77,
    foodPortions: [
      { id: 93932, amount: 3, gramWeight: 85, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 93933, amount: 8, gramWeight: 27, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'crayfish' },
    ],
    want: { gramWeight: 27, pieces: { perServing: 8, noun: 'crayfish' } },
  },
  {
    // A typical-size word next to a real noun is implicit and drops —
    // "cookie, medium" ships as "cookie", the size noun that is the food
    // itself.
    name: 'Oatmeal cookie (special dietary)',
    fdcId: 172734,
    description: 'Cookies, oatmeal, commercially prepared, special dietary',
    caloriesPer100: 449,
    foodPortions: [
      { id: 91222, amount: 1, gramWeight: 28.35, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'oz' },
      { id: 91223, amount: 1, gramWeight: 7, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'cookie, medium (1-5/8" dia)' },
    ],
    want: { gramWeight: 7, pieces: { perServing: 1, noun: 'cookie' } },
  },
  {
    // The NLEA serving is this row's reference weight even though it never
    // becomes a candidate itself — "bunch cooked" (437 g) is well over 2x
    // the 85 g NLEA serving, so it drops, leaving no piece at all.
    name: 'Broccoli rabe (cooked)',
    fdcId: 170382,
    description: 'Broccoli raab, cooked',
    caloriesPer100: 25,
    foodPortions: [
      { id: 86538, amount: 1, gramWeight: 85, sequenceNumber: 1, measureUnit: { name: 'undetermined' }, modifier: 'NLEA serving' },
      { id: 86539, amount: 1, gramWeight: 437, sequenceNumber: 2, measureUnit: { name: 'undetermined' }, modifier: 'bunch cooked' },
    ],
    want: null,
  },
];
