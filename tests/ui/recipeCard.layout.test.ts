import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { createRecipeCard } from '../../src/ui/recipeCard.js';
import { draftForRecipe } from '../../src/ui/recipeIntents.js';
import type { Food, Recipe } from '../../src/domain/types.js';
import { SEED_AT, draftItemRows, loadStyles, seedTestFoods, servingsInput } from '../_helpers.js';

const cheddar: Food = {
  id: 'cheddar', name: 'Shredded cheese, 3 state cheddar', source: 'meijer',
  nutritionFacts: { calories: 110, protein: 7, carbs: 1, fat: 9 },
  servingSize: 1, servingUnit: 'oz', createdAt: SEED_AT, deletedAt: null,
};

const marshmallows: Food = {
  id: 'marshmallows', name: 'Marshmallows',
  nutritionFacts: { calories: 23, protein: 0.1, carbs: 5.8, fat: 0 },
  servingSize: 1, servingUnit: 'count', createdAt: SEED_AT, deletedAt: null,
};

const milk: Food = {
  id: 'milk', name: 'Milk', source: 'safeway',
  nutritionFacts: { calories: 18, protein: 1, carbs: 1.5, fat: 1 },
  servingSize: 1, servingUnit: 'oz', createdAt: SEED_AT, deletedAt: null,
};

// A brand tag that has to drop under its long name, a single word wider than
// a phone's name column, and the widest brand tag on a name too short to
// leave it any room.
const cheddarOmelette: Recipe = {
  id: 'r-cheddar', name: 'Cheddar omelette',
  items: [
    { foodId: 'seed-egg', amount: 3, unit: 'count' },
    { foodId: 'cheddar', amount: 5, unit: 'oz' },
    { foodId: 'marshmallows', amount: 5, unit: 'count' },
    { foodId: 'milk', amount: 8, unit: 'oz' },
  ],
  createdAt: SEED_AT, deletedAt: null,
};

// One short name leaves the row plenty of free width to misplace.
const eggOnly: Recipe = {
  ...cheddarOmelette, id: 'r-egg', items: [{ foodId: 'seed-egg', amount: 3, unit: 'count' }],
};

// `main` is capped at 32rem and the body pads 2rem a side, so the picker is
// 512px on a desktop and the viewport minus 64px below that. Rows stack at
// the same 480px the food card stacks at, so 481px is the narrowest viewport
// that still keeps a name beside the numbers.
const CASES = [
  { viewport: 1280, picker: 512, stacked: false },
  { viewport: 481, picker: 417, stacked: false },
  { viewport: 375, picker: 311, stacked: true },
];

type Cells = { name: HTMLElement; amount: HTMLElement; unit: HTMLElement; cal: HTMLElement };

function contentRect(node: Element): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getBoundingClientRect();
}

function lineCount(node: Element): number {
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getClientRects().length;
}

function middle(r: DOMRect): number {
  return (r.top + r.bottom) / 2;
}

// Horizontal only: a brand tag's pill is a shade taller than the text line it
// sits on, and the cells it can hide behind are all to its right.
function containsHorizontally(outer: DOMRect, inner: DOMRect): boolean {
  const slack = 0.5;
  return inner.left >= outer.left - slack && inner.right <= outer.right + slack;
}

function cell(row: HTMLElement, testid: string): HTMLElement {
  return row.querySelector(`[data-testid="${testid}"]`) as HTMLElement;
}

function cells(row: HTMLElement): Cells {
  return {
    name: cell(row, 'recipe-draft-item-name'),
    amount: cell(row, 'recipe-draft-amount'),
    unit: cell(row, 'recipe-draft-item-unit'),
    cal: cell(row, 'recipe-draft-item-cal'),
  };
}

// The food's own name is the cell's first text node. The name column never
// shrinks below its longest word, so that word only breaks if a rule such as
// `overflow-wrap: anywhere` is added to let it.
function longestWordRects(name: HTMLElement): DOMRectList {
  const text = name.firstChild as Text;
  const longest = text.data.split(' ').reduce((a, b) => (b.length > a.length ? b : a));
  const start = text.data.indexOf(longest);

  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, start + longest.length);
  return range.getClientRects();
}

function mountPicker(width: number, recipe = cheddarOmelette): HTMLElement {
  const picker = document.createElement('ul');
  picker.className = 'picker';
  picker.style.width = `${width}px`;
  document.body.appendChild(picker);

  const card = createRecipeCard({ onRecipeDraftAmountChange: () => {}, onServingsChange: () => {} });
  const foodsById = new Map([...seedTestFoods(), cheddar, marshmallows, milk].map((f) => [f.id, f]));
  card.render({
    recipe,
    draft: { ...draftForRecipe(recipe), servings: '4' },
    foodsById,
    detailId: 'd1',
  });
  picker.appendChild(card.node);

  return picker;
}

describe('recipe card — row layout', () => {
  before(loadStyles);

  for (const { viewport, picker: width, stacked } of CASES) {
    describe(`at a ${viewport}px viewport`, () => {
      let picker: HTMLElement;

      before(() => setViewport({ width: viewport, height: 800 }));

      beforeEach(() => {
        picker = mountPicker(width);
      });

      afterEach(() => picker.remove());

      it('fits the picker without a horizontal scrollbar', () => {
        const overflow = picker.scrollWidth - picker.clientWidth;
        expect(overflow, `the card runs ${overflow}px past the picker`).to.be.at.most(0);
      });

      it("keeps each cell's text within its own column", () => {
        for (const row of draftItemRows(picker)) {
          const { name, unit, cal } = cells(row);
          for (const c of [name, unit, cal]) {
            const fits = containsHorizontally(c.getBoundingClientRect(), contentRect(c));
            expect(fits, `"${c.textContent}" spills out of its cell`).to.equal(true);
          }
        }
      });

      it('keeps every word of a name whole', () => {
        for (const row of draftItemRows(picker)) {
          const { name } = cells(row);
          expect(longestWordRects(name).length, `"${name.textContent}" breaks mid-word`).to.equal(1);
        }
      });

      it('keeps the unit and calories each on one line', () => {
        for (const row of draftItemRows(picker)) {
          const { unit, cal } = cells(row);
          for (const c of [unit, cal]) {
            expect(lineCount(c), `"${c.textContent}"`).to.equal(1);
          }
        }
      });

      it('centres the unit and calories on the amount input', () => {
        for (const row of draftItemRows(picker)) {
          const { amount, unit, cal } = cells(row);
          const amountMid = middle(amount.getBoundingClientRect());

          for (const c of [unit, cal]) {
            const offset = Math.abs(middle(contentRect(c)) - amountMid);
            expect(offset, `"${c.textContent}" sits off the amount's centre`).to.be.below(1.5);
          }
        }
      });

      it('gives the amount input the same height in every row', () => {
        const heights = draftItemRows(picker).map((row) => Math.round(cells(row).amount.getBoundingClientRect().height));
        expect(new Set(heights).size, `amount heights ${heights.join(', ')}`).to.equal(1);
      });

      it('puts the Servings input in the amount column, above the first row', () => {
        const servings = servingsInput(picker).getBoundingClientRect();
        const first = cells(draftItemRows(picker)[0]).amount.getBoundingClientRect();
        expect(servings.left, 'Servings sits off the amount column').to.be.closeTo(first.left, 0.5);
        expect(servings.width, 'Servings is not the amount column wide').to.be.closeTo(first.width, 0.5);
        expect(servings.bottom, 'Servings is not above the first row').to.be.at.most(first.top);
      });

      if (stacked) {
        it('gives the name its own line above the numbers, the full width of the row', () => {
          for (const row of draftItemRows(picker)) {
            const { name, amount } = cells(row);
            const nameBox = name.getBoundingClientRect();
            const rowWidth = row.getBoundingClientRect().width;

            expect(nameBox.bottom, `"${name.textContent}" shares a line with the amount`)
              .to.be.at.most(amount.getBoundingClientRect().top + 0.5);
            expect(nameBox.width, `"${name.textContent}" leaves row width unused`).to.be.at.least(rowWidth - 1);
          }
        });
      } else {
        it('sits the name beside the amount, centred on it', () => {
          for (const row of draftItemRows(picker)) {
            const { name, amount } = cells(row);
            const offset = Math.abs(middle(contentRect(name)) - middle(amount.getBoundingClientRect()));
            expect(offset, `"${name.textContent}" sits off the amount's centre`).to.be.below(1.5);
          }
        });

        it("pins the calories to the card's right edge, whatever the names are", () => {
          for (const recipe of [cheddarOmelette, eggOnly]) {
            picker.remove();
            picker = mountPicker(width, recipe);

            // A row's box grows with any overflow, so measure against the
            // card's own content edge, which does not.
            const card = picker.querySelector('[data-testid="recipe-detail"]') as HTMLElement;
            const edge = card.getBoundingClientRect().right - parseFloat(getComputedStyle(card).paddingRight);
            expect(picker.scrollWidth - picker.clientWidth, `${recipe.name} runs past the picker`).to.be.at.most(0);

            for (const row of draftItemRows(picker)) {
              const { cal } = cells(row);
              const gap = edge - cal.getBoundingClientRect().right;
              expect(Math.abs(gap), `"${cal.textContent}" of ${recipe.name} sits ${Math.round(gap)}px off the card's edge`).to.be.below(1);
            }
          }
        });
      }
    });
  }
});
