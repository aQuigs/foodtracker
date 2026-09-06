import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { render } from '../../src/ui/view.js';
import type { Recipe } from '../../src/domain/types.js';
import { baseVm, loadStyles, noopHandlers, seedTestState } from '../_helpers.js';

const omelette: Recipe = {
  id: 'r1', name: 'Omelette',
  items: [{ foodId: 'seed-egg', amount: 3, unit: 'count' }],
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

// The page shell from index.html: the stylesheet pads the body and caps main,
// so a phone viewport squeezes the row the way it does on the live site.
function mountMain(): HTMLElement {
  const main = document.createElement('main');
  document.body.appendChild(main);
  return main;
}

function logRow(main: HTMLElement): { row: DOMRect; search: DOMRect; amount: DOMRect; servings: DOMRect; button: DOMRect } {
  const button = main.querySelector('[data-testid="log-button"]') as HTMLElement;
  const search = main.querySelector('[data-testid="search-input"]') as HTMLElement;
  const amount = main.querySelector('[data-testid="amount-input"]') as HTMLElement;
  const servings = main.querySelector('[data-testid="servings-input"]') as HTMLElement;
  return {
    row: button.parentElement!.getBoundingClientRect(),
    search: search.getBoundingClientRect(),
    amount: amount.getBoundingClientRect(),
    servings: servings.getBoundingClientRect(),
    button: button.getBoundingClientRect(),
  };
}

describe('log row — layout', () => {
  before(loadStyles);

  for (const viewport of [1280, 480, 375, 320]) {
    describe(`at a ${viewport}px viewport`, () => {
      let main: HTMLElement;

      before(() => setViewport({ width: viewport, height: 800 }));

      beforeEach(() => {
        main = mountMain();
      });

      afterEach(() => main.remove());

      it('keeps the Amount field flush with the search box and Log it at the far end while logging a food', () => {
        render(main, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);
        const { row, search, amount, button } = logRow(main);
        expect(amount.left, `Amount starts ${Math.round(search.left - amount.left)}px left of the search box`)
          .to.be.closeTo(search.left, 0.5);
        // At least, not exactly: on a narrow phone the unit buttons already
        // push the row past its box, and Log it goes with them.
        expect(button.right, 'Log it stops short of the right edge').to.be.at.least(row.right - 0.5);
      });

      it("keeps Servings right beside Log it at the row's right edge while a recipe is selected", () => {
        const state = { ...seedTestState(), recipes: [omelette] };
        render(main, {
          ...baseVm, state, recipeDraft: { recipeId: 'r1', amounts: { 'seed-egg': '3' }, servings: '1' },
        }, noopHandlers);
        const { row, servings, button } = logRow(main);
        expect(button.right, 'Log it sits away from the right edge').to.be.closeTo(row.right, 0.5);
        expect(button.left - servings.right, `Servings sits ${Math.round(button.left - servings.right)}px from Log it`)
          .to.be.within(0, 12);
        expect(servings.width, 'Servings stretches across the row').to.be.below(row.width / 2);
      });
    });
  }
});
