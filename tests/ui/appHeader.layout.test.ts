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

      it('keeps every tab inside the page column', () => {
        const tabs = Array.from(main.querySelectorAll('[data-testid^="view-toggle-"]')) as HTMLElement[];
        expect(tabs.length, 'the header renders a tab per view').to.be.at.least(4);
        const column = main.getBoundingClientRect().right;

        for (const tab of tabs) {
          const right = tab.getBoundingClientRect().right;
          expect(right, `the ${tab.textContent} tab runs ${Math.round(right - column)}px past the page column`)
            .to.be.at.most(column + 0.5);
        }
      });

      it('keeps the title whole rather than breaking it across lines', () => {
        const title = main.querySelector('.app-header h1') as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(title);
        const lines = range.getClientRects().length;
        expect(lines, `"${title.textContent}" breaks across ${lines} lines`).to.equal(1);
      });

      it('wraps the tab strip instead of overflowing the header', () => {
        const header = main.querySelector('.app-header') as HTMLElement;
        const nav = main.querySelector('nav.view-toggle') as HTMLElement;
        const overflow = nav.getBoundingClientRect().right - header.getBoundingClientRect().right;
        expect(overflow, `the tab strip overflows the header by ${Math.round(overflow)}px`).to.be.at.most(0.5);
      });
    });
  }
});
