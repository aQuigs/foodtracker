import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { createRecipeEditor, EMPTY_RECIPE_FORM } from '../../src/ui/recipeEditor.js';
import type { Food } from '../../src/domain/types.js';
import { BAR, MILK, loadStyles, makeContainer, mountMain } from '../_helpers.js';
import { noopHandlers, vm } from './recipeEditorFixtures.js';

const omelette = vm({
  form: { ...EMPTY_RECIPE_FORM, name: 'Omelette', items: [{ foodId: 'egg', amount: '3', unit: 'count' }] },
});

describe('recipe editor — item row layout', () => {
  before(loadStyles);

  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
    container.style.width = '480px';
    const editor = createRecipeEditor(noopHandlers());
    container.append(editor.node);
    editor.render(omelette);
  });

  afterEach(() => container.remove());

  it('sits the unit buttons next to the amount they apply to', () => {
    const amount = (container.querySelector('[data-testid="recipe-form-amount"]') as HTMLElement).getBoundingClientRect();
    const units = (container.querySelector('[data-testid="recipe-form-unit-egg"]') as HTMLElement).getBoundingClientRect();
    const gap = units.left - amount.right;

    expect(gap, `${Math.round(gap)}px between the amount and its units`).to.be.within(0, 24);
    expect(units.top, 'the units sit below the amount rather than beside it').to.be.below(amount.bottom);
    expect(amount.top, 'the amount sits below the units rather than beside them').to.be.below(units.bottom);
  });

  it('fits the row without a horizontal scrollbar', () => {
    const row = container.querySelector('[data-testid="recipe-form-item"]') as HTMLElement;
    const overflow = row.scrollWidth - row.clientWidth;

    expect(overflow, `the row runs ${overflow}px past its column`).to.be.at.most(0);
  });
});

// A drink that's also sold in pieces (e.g. bottles), so it offers count, ml
// and fl oz — 3 buttons, one more than a plain drink like MILK.
const bottledDrink: Food = { ...MILK, id: 'bottled-drink', pieces: { perServing: 1, noun: 'bottle' } };

describe('recipe editor — unit group wraps as a block, not its own buttons', () => {
  before(loadStyles);

  let container: HTMLElement;
  afterEach(() => container.remove());

  function renderItem(food: Food, unit: string, width: number): HTMLElement {
    container = makeContainer();
    container.style.width = `${width}px`;
    const editor = createRecipeEditor(noopHandlers());
    container.append(editor.node);
    editor.render(vm({
      foods: [food],
      form: { ...EMPTY_RECIPE_FORM, items: [{ foodId: food.id, amount: '1', unit }] },
    }));
    return container;
  }

  function unitButtonTops(root: HTMLElement, foodId: string): number[] {
    const group = root.querySelector(`[data-testid="recipe-form-unit-${foodId}"]`) as HTMLElement;
    return Array.from(group.querySelectorAll<HTMLElement>('.toggle-group-button:not([hidden])'))
      .map((b) => b.getBoundingClientRect().top);
  }

  const cases: Array<{ name: string; food: Food; unit: string }> = [
    { name: "a solid food's 4 unit buttons", food: BAR, unit: 'count' },
    { name: "a drink's 3 unit buttons", food: bottledDrink, unit: 'ml' },
  ];

  for (const width of [320, 375]) {
    for (const { name, food, unit } of cases) {
      it(`keeps ${name} on one line at ${width}px`, () => {
        const root = renderItem(food, unit, width);
        const tops = unitButtonTops(root, food.id);
        expect(tops, 'no unit buttons found').to.not.be.empty;
        expect(new Set(tops).size, 'a unit button split onto its own line').to.equal(1);
      });
    }
  }
});

describe('recipe editor — no page overflow at enlarged text', () => {
  before(loadStyles);

  const cases = [
    { viewport: 320, fontSize: '24px' },
    { viewport: 375, fontSize: '32px' },
  ];

  for (const { viewport, fontSize } of cases) {
    it(`keeps the unit group inside the row at ${viewport}px / ${fontSize} root text`, async () => {
      await setViewport({ width: viewport, height: 900 });
      document.documentElement.style.fontSize = fontSize;
      const main = mountMain();
      try {
        const editor = createRecipeEditor(noopHandlers());
        main.append(editor.node);
        editor.render(vm({
          foods: [BAR],
          form: { ...EMPTY_RECIPE_FORM, items: [{ foodId: BAR.id, amount: '1', unit: 'count' }] },
        }));

        const row = (main.querySelector('[data-testid="recipe-form-item"]') as HTMLElement).getBoundingClientRect();
        const group = (main.querySelector(`[data-testid="recipe-form-unit-${BAR.id}"]`) as HTMLElement).getBoundingClientRect();

        expect(row.right, `the unit group runs ${Math.round(group.right - row.right)}px past the row`)
          .to.be.at.least(group.right - 0.5);
        expect(document.documentElement.scrollWidth, 'the page scrolls sideways').to.be.at.most(viewport);
      } finally {
        document.documentElement.style.fontSize = '';
        main.remove();
      }
    });
  }
});
