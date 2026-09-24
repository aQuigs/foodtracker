import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { render } from '../../src/ui/view.js';
import type { ViewModel } from '../../src/ui/view.js';
import type { Food, Recipe } from '../../src/domain/types.js';
import { BAR, MILK, baseVm, boxOf, loadStyles, mountMain, noopHandlers, seedTestState } from '../_helpers.js';

const omelette: Recipe = {
  id: 'r1', name: 'Omelette',
  items: [{ foodId: 'seed-egg', amount: 3, unit: 'count' }],
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

// A drink that's also sold in pieces (e.g. bottles), so it offers count, ml
// and fl oz — 3 buttons, one more than a plain drink like MILK.
const bottledDrink: Food = { ...MILK, id: 'bottled-drink', pieces: { perServing: 1, noun: 'bottle' } };

function visibleUnitButtons(main: HTMLElement): HTMLElement[] {
  const group = main.querySelector('[data-testid="log-unit-group"]') as HTMLElement;
  return Array.from(group.querySelectorAll<HTMLElement>('.toggle-group-button:not([hidden])'));
}

const drinkState = { ...seedTestState(), foods: [...seedTestState().foods, MILK] };
const solidState = { ...seedTestState(), foods: [...seedTestState().foods, BAR] };
const bottledState = { ...seedTestState(), foods: [...seedTestState().foods, bottledDrink] };
const recipeState = { ...seedTestState(), recipes: [omelette] };
const draft = { recipeId: 'r1', amounts: { 'seed-egg': '3' }, servings: '1' };

type Scenario = { name: string; extra: Partial<ViewModel>; slot: 'amount-input' | 'servings-input' };

const scenarios: Scenario[] = [
  { name: 'no food selected', extra: { selectedFoodId: null }, slot: 'amount-input' },
  { name: 'a solid food with pieces', extra: { state: solidState, selectedFoodId: BAR.id }, slot: 'amount-input' },
  { name: 'a g food', extra: { selectedFoodId: 'seed-banana' }, slot: 'amount-input' },
  { name: 'a counted food', extra: { selectedFoodId: 'seed-egg' }, slot: 'amount-input' },
  { name: 'a drink', extra: { state: drinkState, selectedFoodId: MILK.id }, slot: 'amount-input' },
  { name: 'an ml food with pieces', extra: { state: bottledState, selectedFoodId: bottledDrink.id }, slot: 'amount-input' },
  { name: 'a recipe draft', extra: { state: recipeState, recipeDraft: draft, selectedFoodId: null }, slot: 'servings-input' },
];

describe('log row — layout', () => {
  before(loadStyles);

  // The row has no breakpoints, so only the narrowest and widest viewports
  // are exercised — the ones in between add nothing.
  for (const viewport of [1280, 320]) {
    for (const fontSize of ['16px', '18px']) {
      describe(`at ${viewport}px / ${fontSize} root text`, () => {
        let main: HTMLElement;

        beforeEach(async () => {
          await setViewport({ width: viewport, height: 800 });
          document.documentElement.style.fontSize = fontSize;
          main = mountMain();
        });

        afterEach(() => {
          document.documentElement.style.fontSize = '';
          main.remove();
        });

        for (const { name, extra, slot } of scenarios) {
          const hasUnit = slot === 'amount-input';

          it(`stacks Amount/Servings, Unit and Log it in order, left-aligned, for ${name}`, () => {
            render(main, { ...baseVm, ...extra }, noopHandlers);

            const row = boxOf(main, 'log-row');
            const field = boxOf(main, slot);
            const logBtn = boxOf(main, 'log-button');

            expect(field.left, 'the field is not flush with the row').to.be.closeTo(row.left, 0.5);
            expect(field.width, 'the field is not the full row width').to.be.closeTo(row.width, 0.5);
            expect(logBtn.left, 'Log it is not flush with the row').to.be.closeTo(row.left, 0.5);

            if (!hasUnit) {
              expect(logBtn.top, 'Log it is not below the field').to.be.at.least(field.bottom - 1);
              return;
            }

            const boxes = visibleUnitButtons(main).map((b) => b.getBoundingClientRect());
            expect(boxes.length, 'no unit buttons are visible').to.be.greaterThan(0);
            const unitTop = boxes[0]!.top;

            for (const box of boxes) {
              expect(box.top, 'a unit button split onto its own line').to.be.closeTo(unitTop, 1);
            }

            expect(boxes[0]!.left, 'the unit group is not flush with the row').to.be.closeTo(row.left, 0.5);
            expect(unitTop, 'the unit group is not below the field').to.be.at.least(field.bottom - 1);
            expect(logBtn.top, 'Log it is not below the unit group').to.be.at.least(boxes[0]!.bottom - 1);
          });
        }
      });
    }
  }

  it('keeps the Amount field flush with the search box while logging a food', async () => {
    await setViewport({ width: 375, height: 800 });
    const main = mountMain();
    try {
      render(main, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);
      const search = boxOf(main, 'search-input');
      const amount = boxOf(main, 'amount-input');
      expect(amount.left, `Amount starts ${Math.round(search.left - amount.left)}px left of the search box`)
        .to.be.closeTo(search.left, 0.5);
    } finally {
      main.remove();
    }
  });

  const extremeCases = [
    { viewport: 320, fontSize: '16px' },
    { viewport: 320, fontSize: '24px' },
    { viewport: 375, fontSize: '32px' },
  ];

  for (const { viewport, fontSize } of extremeCases) {
    it(`never pushes the page into a sideways scroll at ${viewport}px / ${fontSize} root text`, async () => {
      await setViewport({ width: viewport, height: 900 });
      document.documentElement.style.fontSize = fontSize;
      const main = mountMain();
      try {
        render(main, { ...baseVm, state: solidState, selectedFoodId: BAR.id }, noopHandlers);
        expect(document.documentElement.scrollWidth, 'the page scrolls sideways').to.be.at.most(viewport);
      } finally {
        document.documentElement.style.fontSize = '';
        main.remove();
      }
    });
  }
});
