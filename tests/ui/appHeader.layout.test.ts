import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { render } from '../../src/ui/view.js';
import { baseVm, loadStyles, noopHandlers } from '../_helpers.js';

// The page shell from index.html: the stylesheet pads the body and caps main,
// so a phone viewport squeezes the header the way it does on the live site.
function mountMain(): HTMLElement {
  const main = document.createElement('main');
  document.body.appendChild(main);
  return main;
}

describe('app header — layout', () => {
  before(loadStyles);

  for (const viewport of [430, 390, 375, 360, 320]) {
    describe(`at a ${viewport}px viewport`, () => {
      let main: HTMLElement;

      before(() => setViewport({ width: viewport, height: 800 }));

      beforeEach(() => {
        main = mountMain();
        render(main, baseVm, noopHandlers);
      });

      afterEach(() => main.remove());

      it('keeps every tab inside the viewport', () => {
        const tabs = Array.from(main.querySelectorAll('[data-testid^="view-toggle-"]')) as HTMLElement[];
        expect(tabs.length, 'the header renders a tab per view').to.be.at.least(4);

        for (const tab of tabs) {
          const right = tab.getBoundingClientRect().right;
          expect(right, `the ${tab.textContent} tab runs ${Math.round(right - viewport)}px past the right edge`)
            .to.be.at.most(viewport);
        }
      });

      it('wraps the tab strip instead of overflowing it', () => {
        const nav = main.querySelector('nav.view-toggle') as HTMLElement;
        expect(nav.scrollWidth, `the tab strip overflows its box by ${nav.scrollWidth - nav.clientWidth}px`)
          .to.be.at.most(nav.clientWidth);
      });
    });
  }
});
