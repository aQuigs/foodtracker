import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { createRecipeEditor, EMPTY_RECIPE_FORM } from '../../src/ui/recipeEditor.js';
import type { Food } from '../../src/domain/types.js';
import { BAR, MILK, loadStyles, makeContainer, mountMain } from '../_helpers.js';
import { egg, noopHandlers, vm } from './recipeEditorFixtures.js';

// A drink that's also sold in pieces (e.g. bottles), so it offers count, ml
// and fl oz — 3 buttons, one more than a plain drink like MILK.
const bottledDrink: Food = { ...MILK, id: 'bottled-drink', pieces: { perServing: 1, noun: 'bottle' } };

const cases: Array<{ name: string; food: Food; unit: string }> = [
  { name: "a counted food's 1 unit button", food: egg, unit: 'count' },
  { name: "a plain drink's 2 unit buttons", food: MILK, unit: 'ml' },
  { name: "a solid food's 4 unit buttons", food: BAR, unit: 'count' },
  { name: "a bottled drink's 3 unit buttons", food: bottledDrink, unit: 'ml' },
];

function renderItem(container: HTMLElement, food: Food, unit: string): void {
  const editor = createRecipeEditor(noopHandlers());
  container.append(editor.node);
  editor.render(vm({
    foods: [food],
    form: { ...EMPTY_RECIPE_FORM, items: [{ foodId: food.id, amount: '1', unit }] },
  }));
}

function unitButtonBoxes(root: HTMLElement, foodId: string): DOMRect[] {
  const group = root.querySelector(`[data-testid="recipe-form-unit-${foodId}"]`) as HTMLElement;
  return Array.from(group.querySelectorAll<HTMLElement>('.toggle-group-button:not([hidden])')).map((b) => b.getBoundingClientRect());
}

// The item row is a fixed stack — the amount, then its unit group below it —
// identical for every food and width.
describe('recipe editor — item row layout', () => {
  before(loadStyles);

  let container: HTMLElement;

  afterEach(() => {
    document.documentElement.style.fontSize = '';
    container.remove();
  });

  // The row has no breakpoints, so only the narrowest width is exercised.
  for (const width of [320]) {
    for (const fontSize of ['16px', '18px']) {
      for (const { name, food, unit } of cases) {
        it(`stacks the amount above ${name}, left-aligned, at ${width}px / ${fontSize} root text`, () => {
          document.documentElement.style.fontSize = fontSize;
          container = makeContainer();
          container.style.width = `${width}px`;
          renderItem(container, food, unit);

          const amount = (container.querySelector('[data-testid="recipe-form-amount"]') as HTMLElement).getBoundingClientRect();
          const boxes = unitButtonBoxes(container, food.id);
          expect(boxes, 'no unit buttons found').to.not.be.empty;

          const unitTop = boxes[0]!.top;
          for (const box of boxes) {
            expect(box.top, 'a unit button split onto its own line').to.be.closeTo(unitTop, 1);
          }

          expect(unitTop, 'the unit group is not below the amount').to.be.at.least(amount.bottom - 1);
          expect(boxes[0]!.left, 'the unit group is not left-aligned with the amount').to.be.closeTo(amount.left, 0.5);
        });
      }
    }
  }
});

describe('recipe editor — no page overflow at enlarged text', () => {
  before(loadStyles);

  const extremeCases = [
    { viewport: 320, fontSize: '24px' },
    { viewport: 375, fontSize: '32px' },
  ];

  for (const { viewport, fontSize } of extremeCases) {
    it(`keeps the unit group inside the row at ${viewport}px / ${fontSize} root text`, async () => {
      await setViewport({ width: viewport, height: 900 });
      document.documentElement.style.fontSize = fontSize;
      const main = mountMain();
      try {
        const editor = createRecipeEditor(noopHandlers());
        main.append(editor.node);
        editor.render(vm({
          foods: [BAR],
          form: { ...EMPTY_RECIPE_FORM, items: [{ foodId: BAR.id, amount: '1', unit: 'count' }] },
        }));

        const row = main.querySelector('[data-testid="recipe-form-item"]') as HTMLElement;
        const rowBox = row.getBoundingClientRect();
        const group = (main.querySelector(`[data-testid="recipe-form-unit-${BAR.id}"]`) as HTMLElement).getBoundingClientRect();
        const rowOverflow = row.scrollWidth - row.clientWidth;

        expect(rowBox.right, `the unit group runs ${Math.round(group.right - rowBox.right)}px past the row`)
          .to.be.at.least(group.right - 0.5);
        expect(rowOverflow, `the row runs ${rowOverflow}px past its column`).to.be.at.most(0);
        expect(document.documentElement.scrollWidth, 'the page scrolls sideways').to.be.at.most(viewport);
      } finally {
        document.documentElement.style.fontSize = '';
        main.remove();
      }
    });
  }
});
