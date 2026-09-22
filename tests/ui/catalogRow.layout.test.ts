import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { FoodMatch } from '../../src/ui/search.js';
import type { Food, SourcedFood } from '../../src/domain/types.js';
import { baseVm, catalogHits, loadStyles, noopHandlers, seedTestState } from '../_helpers.js';

// body's 2rem padding leaves main this wide on the narrowest phone we support.
const PHONE_MAIN_WIDTH = '256px';

// The browser's largest text setting, which is what squeezes a row hardest.
const ZOOMED_TEXT = '32px';

function mountMain(): HTMLElement {
  const main = document.createElement('main');
  main.style.width = PHONE_MAIN_WIDTH;
  main.style.fontSize = ZOOMED_TEXT;
  document.body.appendChild(main);
  return main;
}

function match(food: SourcedFood): FoodMatch<SourcedFood> {
  return { food, tier: 0, indices: [], brandIndices: [] };
}

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

const wideCookies: SourcedFood = {
  id: 'brand:store:1', name: 'Chocolate Chunk Sandwich Cookies', brand: 'Great Value',
  source: 'brand:store', sourceId: '1',
  nutritionFacts: { calories: 160, protein: 2, carbs: 21, fat: 8 },
  servingSize: 30, servingUnit: 'g', pieces: { perServing: 11, noun: 'pieces' },
};

// Every word of the name stays visible and clear of the calories and the
// row's buttons; the brand/serving line keeps most of the width left of the
// buttons (the calories wrap below it rather than squeezing it into
// letter-by-letter lines) and never runs under the calories.
function expectReadableRow(row: Element, parts: { name: string; cal: string; actions: string; detail: string }): void {
  const name = row.querySelector(parts.name)!;
  const nameBox = name.getBoundingClientRect();
  const calBox = row.querySelector(parts.cal)!.getBoundingClientRect();
  const actionsBox = row.querySelector(parts.actions)!.getBoundingClientRect();
  const detailBox = row.querySelector(parts.detail)!.getBoundingClientRect();

  expect(name.scrollWidth, 'the name is never clipped').to.be.at.most(name.clientWidth + 1);
  expect(overlaps(nameBox, calBox), 'the name clears the calories').to.equal(false);
  expect(overlaps(nameBox, actionsBox), 'the name clears the buttons').to.equal(false);
  expect(overlaps(detailBox, calBox), 'the brand/serving line clears the calories').to.equal(false);
  expect(overlaps(calBox, actionsBox), 'the calories clear the buttons').to.equal(false);
  expect(detailBox.width, 'the brand/serving line is not squeezed').to.be.at.least(nameBox.width / 2);
}

describe('food rows — layout at phone-zoom width', () => {
  before(loadStyles);

  let main: HTMLElement;

  beforeEach(() => { main = mountMain(); });

  afterEach(() => main.remove());

  it('keeps a catalog row readable', () => {
    render(main, { ...baseVm, view: 'catalog', catalogHits: catalogHits([match(wideCookies)]) }, noopHandlers);

    expectReadableRow(main.querySelector('[data-testid="catalog-result-row"]')!, {
      name: '.row-name', cal: '.row-summary', actions: '.catalog-add', detail: '.row-detail',
    });
  });

  it('keeps a Foods list row readable', () => {
    const state = seedTestState();
    const food: Food = {
      ...wideCookies, id: 'cookies', createdAt: '2026-05-01T00:00:00Z', deletedAt: null,
    };
    state.foods = [food];
    render(main, { ...baseVm, view: 'foods', state }, noopHandlers);

    expectReadableRow(main.querySelector('[data-testid="food-row"]')!, {
      name: '.row-name', cal: '.row-summary', actions: '.row-actions', detail: '.row-detail',
    });
  });
});
