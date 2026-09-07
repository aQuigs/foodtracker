import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { render } from '../../src/ui/view.js';
import type { ViewModel } from '../../src/ui/view.js';
import type { SourcedFood } from '../../src/domain/types.js';
import { baseVm, catalogHits, entryOn, loadStyles, noopHandlers, stateWithEntries } from '../_helpers.js';

// Apple and Android both put the smallest comfortable touch target at 44px.
const FLOOR = 44;
const WIDTH = 375;

const CONTROLS = 'button, [role="button"], .source-option label';

// Not today, so the day the entry sits on is also the day that paints Today.
const LOGGED_DATE = '2026-05-22';

function hit(): SourcedFood {
  return {
    id: 'usda:1', name: 'Rye bread', source: 'usda', sourceId: '1',
    nutritionFacts: { calories: 250, protein: 8, carbs: 48, fat: 3 },
    servingSize: 100, servingUnit: 'g',
  };
}

function controls(main: HTMLElement): HTMLElement[] {
  return [...main.querySelectorAll<HTMLElement>(CONTROLS)]
    .filter((node) => node.getBoundingClientRect().width > 0);
}

function name(node: HTMLElement): string {
  return node.dataset['testid'] || node.className || node.localName;
}

function undersized(main: HTMLElement): string[] {
  return controls(main)
    .map((node) => ({ node, rect: node.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width < FLOOR || rect.height < FLOOR)
    .map(({ node, rect }) => `${name(node)}: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
}

function squeezed(main: HTMLElement): string[] {
  return controls(main)
    .filter((node) => node.scrollWidth > node.clientWidth)
    .map((node) => `${name(node)}: ${node.scrollWidth - node.clientWidth}px of label outside it`);
}

const views: Array<[string, Partial<ViewModel>]> = [
  ['log', {
    view: 'log',
    state: stateWithEntries([entryOn('e1', LOGGED_DATE)]),
    selectedDate: LOGGED_DATE,
    selectedFoodId: 'seed-banana',
    amount: '100',
  }],
  ['foods', { view: 'foods' }],
  ['catalog', {
    view: 'catalog',
    sourcesExpanded: true,
    catalogHits: catalogHits([{ food: hit(), tier: 0, indices: [], brandIndices: [] }]),
  }],
  ['trends', { view: 'trends' }],
];

describe('tap targets — layout', () => {
  let main: HTMLElement;

  before(loadStyles);

  beforeEach(() => {
    main = document.createElement('main');
    document.body.appendChild(main);
  });

  afterEach(() => main.remove());

  describe(`at a ${WIDTH}px viewport`, () => {
    before(() => setViewport({ width: WIDTH, height: 1200 }));

    for (const [view, patch] of views) {
      it(`gives every ${view} control a ${FLOOR}px box`, () => {
        render(main, { ...baseVm, ...patch }, noopHandlers);

        expect(undersized(main)).to.deep.equal([]);
      });
    }
  });

  // A width floor must never squeeze a control narrower than the word on it.
  for (const width of [WIDTH, 320]) {
    describe(`at a ${width}px viewport`, () => {
      before(() => setViewport({ width, height: 1200 }));

      for (const [view, patch] of views) {
        it(`keeps every ${view} label inside its own control`, () => {
          render(main, { ...baseVm, ...patch }, noopHandlers);

          expect(squeezed(main)).to.deep.equal([]);
        });
      }
    });
  }
});
