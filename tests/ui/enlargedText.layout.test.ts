import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { render } from '../../src/ui/view.js';
import type { CatalogHits } from '../../src/ui/view.js';
import type { SourcedFood } from '../../src/domain/types.js';
import { baseVm, loadStyles, noopHandlers } from '../_helpers.js';

// A phone at double the default text size: every control is at its widest
// relative to the screen, so anything that cannot wrap runs off the page.
const WIDTH = 375;

function mountMain(): HTMLElement {
  const main = document.createElement('main');
  document.body.appendChild(main);
  return main;
}

function brandFold(): CatalogHits {
  const food: SourcedFood = {
    id: 'safeway:1', name: 'Wheat bread', source: 'safeway', sourceId: '1',
    nutritionFacts: { calories: 100, protein: 5, carbs: 10, fat: 2 },
    servingSize: 100, servingUnit: 'g',
  };
  const shown = [{ food, tier: 0, indices: [], brandIndices: [] }];
  return { query: 'bread', groups: [{ source: 'safeway', shown, alreadyAdded: 0 }] };
}

describe('enlarged text — layout', () => {
  let main: HTMLElement;

  before(loadStyles);
  before(() => setViewport({ width: WIDTH, height: 800 }));
  before(() => { document.documentElement.style.fontSize = '32px'; });

  after(() => { document.documentElement.style.fontSize = ''; });

  beforeEach(() => { main = mountMain(); });

  afterEach(() => main.remove());

  it('keeps the log unit buttons inside the page', () => {
    render(main, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);

    const group = main.querySelector('[data-testid="log-unit-group"]')!.getBoundingClientRect();
    expect(group.right, `the unit buttons run ${Math.round(group.right - WIDTH)}px past the page`)
      .to.be.at.most(main.getBoundingClientRect().right + 0.5);
  });

  for (const view of ['foods', 'trends'] as const) {
    it(`keeps the ${view} view inside the page`, () => {
      render(main, { ...baseVm, view }, noopHandlers);

      expect(document.documentElement.scrollWidth, `the ${view} view scrolls sideways`)
        .to.be.at.most(WIDTH);
    });
  }

  it('wraps a long catalog fold header instead of clipping it', () => {
    render(main, {
      ...baseVm, view: 'catalog',
      catalogSources: ['safeway'], enabledSources: ['safeway'],
      catalogHits: brandFold(),
    }, noopHandlers);

    const toggle = main.querySelector('[data-testid="catalog-fold-toggle"]') as HTMLElement;
    expect(toggle.scrollWidth, 'the fold label is clipped by its button')
      .to.be.at.most(toggle.clientWidth);
  });
});
