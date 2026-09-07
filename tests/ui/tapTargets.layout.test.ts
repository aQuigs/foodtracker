import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { render } from '../../src/ui/view.js';
import type { ViewModel } from '../../src/ui/view.js';
import { baseVm, loadStyles, noopHandlers, withMealsFromEntries } from '../_helpers.js';
import type { Entry, State } from '../../src/domain/types.js';

// Apple and Android both put the smallest comfortable touch target at 44px.
const FLOOR = 44;
const WIDTH = 375;

const CONTROLS = 'button, [role="button"], .source-option label';

function loggedState(): State {
  const entry: Entry = {
    id: 'e1', mealId: '', foodId: 'seed-banana', amount: 100, unit: 'g',
    date: baseVm.today, createdAt: `${baseVm.today}T08:00:00.000Z`,
  };
  return withMealsFromEntries({ ...baseVm.state, entries: [entry] });
}

function undersized(main: HTMLElement): string[] {
  return [...main.querySelectorAll<HTMLElement>(CONTROLS)]
    .map((node) => ({ node, rect: node.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0)
    .filter(({ rect }) => rect.width < FLOOR || rect.height < FLOOR)
    .map(({ node, rect }) =>
      `${node.dataset['testid'] ?? node.className}: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
}

describe('tap targets — layout', () => {
  let main: HTMLElement;

  before(loadStyles);
  before(() => setViewport({ width: WIDTH, height: 1200 }));

  beforeEach(() => {
    main = document.createElement('main');
    document.body.appendChild(main);
  });

  afterEach(() => main.remove());

  const views: Array<[string, Partial<ViewModel>]> = [
    ['log', { view: 'log', state: loggedState(), selectedFoodId: 'seed-banana', amount: '100' }],
    ['foods', { view: 'foods' }],
    ['catalog', { view: 'catalog', sourcesExpanded: true }],
  ];

  for (const [name, patch] of views) {
    it(`gives every ${name} control a ${FLOOR}px box`, () => {
      render(main, { ...baseVm, ...patch }, noopHandlers);

      expect(undersized(main)).to.deep.equal([]);
    });
  }
});
