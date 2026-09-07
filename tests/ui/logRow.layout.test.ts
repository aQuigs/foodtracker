import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { render } from '../../src/ui/view.js';
import { baseVm, loadStyles, noopHandlers } from '../_helpers.js';

// The page shell from index.html: the stylesheet pads the body and caps main,
// so a phone viewport squeezes the row the way it does on the live site.
function mountMain(): HTMLElement {
  const main = document.createElement('main');
  document.body.appendChild(main);
  return main;
}

function logRow(main: HTMLElement): { row: DOMRect; unitGroup: DOMRect; unitButton: DOMRect; button: DOMRect } {
  const button = main.querySelector('[data-testid="log-button"]') as HTMLElement;
  const unitGroup = main.querySelector('[data-testid="log-unit-group"]') as HTMLElement;
  const unitButton = unitGroup.querySelector('.toggle-group-button') as HTMLElement;
  return {
    row: button.parentElement!.getBoundingClientRect(),
    unitGroup: unitGroup.getBoundingClientRect(),
    unitButton: unitButton.getBoundingClientRect(),
    button: button.getBoundingClientRect(),
  };
}

describe('log row — layout', () => {
  before(loadStyles);

  for (const viewport of [1280, 480, 414, 390, 375, 360, 320]) {
    describe(`at a ${viewport}px viewport`, () => {
      let main: HTMLElement;

      before(() => setViewport({ width: viewport, height: 800 }));

      beforeEach(() => {
        main = mountMain();
        render(main, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);
      });

      afterEach(() => main.remove());

      it('keeps the unit buttons on a single line', () => {
        const { unitGroup, unitButton } = logRow(main);
        expect(unitGroup.height, `the unit buttons stack ${Math.round(unitGroup.height / unitButton.height)} rows deep`)
          .to.be.at.most(unitButton.height + 1);
      });

      it('keeps the whole Log it button inside the row', () => {
        const { row, button, unitButton } = logRow(main);
        expect(button.right, `Log it runs ${Math.round(button.right - row.right)}px past the row`)
          .to.be.at.most(row.right + 0.5);
        expect(button.height, 'Log it breaks onto a second line')
          .to.be.at.most(unitButton.height + 6);
      });

      it('never pushes the page into a sideways scroll', () => {
        expect(document.documentElement.scrollWidth, 'the page scrolls sideways')
          .to.be.at.most(viewport);
      });
    });
  }
});
