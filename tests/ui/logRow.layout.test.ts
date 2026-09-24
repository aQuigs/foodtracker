import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { render } from '../../src/ui/view.js';
import type { ViewModel } from '../../src/ui/view.js';
import type { Recipe } from '../../src/domain/types.js';
import { BAR, MILK, baseVm, boxOf, loadStyles, mountMain, noopHandlers, seedTestState } from '../_helpers.js';

const omelette: Recipe = {
  id: 'r1', name: 'Omelette',
  items: [{ foodId: 'seed-egg', amount: 3, unit: 'count' }],
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

function rowBox(main: HTMLElement): DOMRect {
  return (main.querySelector('[data-testid="log-row"]') as HTMLElement).getBoundingClientRect();
}

function visibleUnitButtons(main: HTMLElement): HTMLElement[] {
  const group = main.querySelector('[data-testid="log-unit-group"]') as HTMLElement;
  return Array.from(group.querySelectorAll<HTMLElement>('.toggle-group-button:not([hidden])'));
}

function unitButtonBox(main: HTMLElement): DOMRect {
  return visibleUnitButtons(main)[0]!.getBoundingClientRect();
}

const drinkState = { ...seedTestState(), foods: [...seedTestState().foods, MILK] };
const solidState = { ...seedTestState(), foods: [...seedTestState().foods, BAR] };

const unitScenarios: Array<{ name: string; extra: Partial<ViewModel> }> = [
  { name: 'no food selected', extra: { selectedFoodId: null } },
  { name: 'a solid food with pieces', extra: { state: solidState, selectedFoodId: BAR.id } },
  { name: 'a drink', extra: { state: drinkState, selectedFoodId: MILK.id } },
];

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

      for (const { name, extra } of unitScenarios) {
        it(`fits the units and Log it on one line for ${name}`, () => {
          render(main, { ...baseVm, ...extra }, noopHandlers);

          const boxes = visibleUnitButtons(main).map((b) => b.getBoundingClientRect());
          expect(boxes.length, 'no unit buttons are visible').to.be.greaterThan(0);
          const top = boxes[0]!.top;
          const bottom = boxes[0]!.bottom;
          for (const box of boxes) {
            expect(box.top, 'a unit button wrapped onto its own line').to.be.closeTo(top, 1);
          }

          // .log-row aligns its children to flex-end, so a button beside the
          // units (no label above it) shares their bottom, not their top.
          const logBtn = boxOf(main, 'log-button');
          if (viewport > 320) {
            expect(logBtn.bottom, 'Log it dropped below the units').to.be.closeTo(bottom, 1);
            return;
          }

          // At 320px the fit comes down to the font's width, so Log it may
          // wrap, but only as a whole line below the units.
          const beside = Math.abs(logBtn.bottom - bottom) <= 1;
          expect(beside || logBtn.top >= bottom, 'Log it overlaps the unit line').to.equal(true);
        });
      }

      it('keeps the whole Log it button inside the row', () => {
        render(main, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);
        const row = rowBox(main);
        const button = boxOf(main, 'log-button');
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
        const search = boxOf(main, 'search-input');
        const amount = boxOf(main, 'amount-input');
        expect(amount.left, `Amount starts ${Math.round(search.left - amount.left)}px left of the search box`)
          .to.be.closeTo(search.left, 0.5);
      });

      it("keeps Servings right beside Log it at the end of the row while a recipe is selected", () => {
        const state = { ...seedTestState(), recipes: [omelette] };
        render(main, {
          ...baseVm, state, recipeDraft: { recipeId: 'r1', amounts: { 'seed-egg': '3' }, servings: '1' },
        }, noopHandlers);
        const row = rowBox(main);
        const servings = boxOf(main, 'servings-input');
        const button = boxOf(main, 'log-button');
        expect(button.right, 'Log it sits away from the right edge').to.be.closeTo(row.right, 0.5);
        expect(button.left - servings.right, `Servings sits ${Math.round(button.left - servings.right)}px from Log it`)
          .to.be.within(0, 12);
        expect(servings.width, 'Servings stretches across the row').to.be.below(row.width / 2);
      });
    });
  }
});
