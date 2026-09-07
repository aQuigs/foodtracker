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

function box(main: HTMLElement, testid: string): DOMRect {
  return (main.querySelector(`[data-testid="${testid}"]`) as HTMLElement).getBoundingClientRect();
}

function rowBox(main: HTMLElement): DOMRect {
  const button = main.querySelector('[data-testid="log-button"]') as HTMLElement;
  return button.parentElement!.getBoundingClientRect();
}

function unitButtonBox(main: HTMLElement): DOMRect {
  const group = main.querySelector('[data-testid="log-unit-group"]') as HTMLElement;
  return (group.querySelector('.toggle-group-button') as HTMLElement).getBoundingClientRect();
}

describe('log row — layout', () => {
  before(loadStyles);

  for (const viewport of [1280, 480, 414, 390, 375, 360, 320]) {
    describe(`at a ${viewport}px viewport`, () => {
      let main: HTMLElement;

      beforeEach(async () => {
        await setViewport({ width: viewport, height: 800 });
        main = mountMain();
      });

      afterEach(() => main.remove());

      it('keeps the unit buttons on a single line', () => {
        render(main, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);
        const group = box(main, 'log-unit-group');
        const unit = unitButtonBox(main);
        expect(group.height, `the unit buttons stack ${Math.round(group.height / unit.height)} rows deep`)
          .to.be.at.most(unit.height + 1);
      });

      it('keeps the whole Log it button inside the row', () => {
        render(main, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);
        const row = rowBox(main);
        const button = box(main, 'log-button');
        expect(button.right, `Log it runs ${Math.round(button.right - row.right)}px past the row`)
          .to.be.at.most(row.right + 0.5);
        expect(button.height, 'Log it breaks onto a second line')
          .to.be.at.most(unitButtonBox(main).height + 6);
      });

      it('never pushes the page into a sideways scroll', () => {
        render(main, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);
        expect(document.documentElement.scrollWidth, 'the page scrolls sideways')
          .to.be.at.most(viewport);
      });

      it('keeps the Amount field flush with the search box while logging a food', () => {
        render(main, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);
        const search = box(main, 'search-input');
        const amount = box(main, 'amount-input');
        expect(amount.left, `Amount starts ${Math.round(search.left - amount.left)}px left of the search box`)
          .to.be.closeTo(search.left, 0.5);
      });

      it("keeps Servings right beside Log it at the end of the row while a recipe is selected", () => {
        const state = { ...seedTestState(), recipes: [omelette] };
        render(main, {
          ...baseVm, state, recipeDraft: { recipeId: 'r1', amounts: { 'seed-egg': '3' }, servings: '1' },
        }, noopHandlers);
        const row = rowBox(main);
        const servings = box(main, 'servings-input');
        const button = box(main, 'log-button');
        expect(button.right, 'Log it sits away from the right edge').to.be.closeTo(row.right, 0.5);
        expect(button.left - servings.right, `Servings sits ${Math.round(button.left - servings.right)}px from Log it`)
          .to.be.within(0, 12);
        expect(servings.width, 'Servings stretches across the row').to.be.below(row.width / 2);
      });
    });
  }
});
