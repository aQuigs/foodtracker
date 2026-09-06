import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { baseVm, makeContainer, noopHandlers, seedTestState } from '../_helpers.js';
import type { Recipe, State } from '../../src/domain/types.js';

const omelette: Recipe = {
  id: 'r1', name: 'Omelette',
  items: [
    { foodId: 'seed-egg', amount: 3, unit: 'count' },
    { foodId: 'seed-chicken', amount: 60, unit: 'g' },
  ],
  createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
};

function stateWithRecipes(...recipes: Recipe[]): State {
  return { ...seedTestState(), recipes };
}

describe('view — recipes nav', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders four nav buttons, with Recipes active when view is recipes', () => {
    render(container, { ...baseVm, view: 'recipes' }, noopHandlers);
    expect(container.querySelector('[data-testid="view-toggle-log"]')).to.exist;
    expect(container.querySelector('[data-testid="view-toggle-foods"]')).to.exist;
    expect(container.querySelector('[data-testid="view-toggle-recipes"]')).to.exist;
    expect(container.querySelector('[data-testid="view-toggle-catalog"]')).to.exist;
    expect(container.querySelector('[data-testid="view-toggle-recipes"][data-active="true"]')).to.exist;
  });

  it('fires onViewChange("recipes") when the Recipes toggle is clicked', () => {
    let last = '';
    render(container, baseVm, { ...noopHandlers, onViewChange: (v) => { last = v; } });
    (container.querySelector('[data-testid="view-toggle-recipes"]') as HTMLButtonElement).click();
    expect(last).to.equal('recipes');
  });

  it('hides recipes view elements when on another view', () => {
    render(container, baseVm, noopHandlers);
    expect(container.querySelector('[data-testid="recipes-list"]')).to.equal(null);
    expect(container.querySelector('[data-testid="recipe-form"]')).to.equal(null);
  });

  it('mounts the recipe editor inside the recipes view', () => {
    render(container, { ...baseVm, view: 'recipes' }, noopHandlers);
    expect(container.querySelector('[data-testid="recipe-form"]')).to.exist;
  });
});

describe('view — recipes list', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('shows an empty hint when there are no recipes', () => {
    render(container, { ...baseVm, view: 'recipes' }, noopHandlers);
    const empty = container.querySelector('[data-testid="recipes-empty"]');
    expect(empty).to.exist;
    expect(empty!.textContent).to.equal('No recipes yet. Add one above.');
  });

  it('lists a live recipe with its item count and calories', () => {
    const state = stateWithRecipes(omelette);
    render(container, { ...baseVm, view: 'recipes', state }, noopHandlers);
    const row = container.querySelector('[data-testid="recipe-row"]')!;
    expect(row.querySelector('[data-testid="recipe-row-name"]')!.textContent).to.equal('Omelette');
    // seed-egg: 78 cal each * 3 = 234; seed-chicken: 165 cal/100g * 60g = 99 => 333
    expect(row.querySelector('[data-testid="recipe-row-summary"]')!.textContent).to.equal('2 items · 333 cal');
  });

  it('hides a soft-deleted recipe', () => {
    const deleted: Recipe = { ...omelette, deletedAt: '2026-02-01T00:00:00Z' };
    const state = stateWithRecipes(deleted);
    render(container, { ...baseVm, view: 'recipes', state }, noopHandlers);
    expect(container.querySelector('[data-testid="recipe-row"]')).to.equal(null);
    expect(container.querySelector('[data-testid="recipes-empty"]')).to.exist;
  });

  it('shows a no-match hint when a query matches no live recipe', () => {
    const state = stateWithRecipes(omelette);
    render(container, { ...baseVm, view: 'recipes', state, recipesQuery: 'zzz' }, noopHandlers);
    const hint = container.querySelector('[data-testid="recipes-no-match"]');
    expect(hint).to.exist;
    expect(hint!.textContent).to.equal('No recipes match.');
  });

  it('filters by the recipes-search query', () => {
    const other: Recipe = { ...omelette, id: 'r2', name: 'Scramble', items: [{ foodId: 'seed-egg', amount: 2, unit: 'count' }] };
    const state = stateWithRecipes(omelette, other);
    render(container, { ...baseVm, view: 'recipes', state, recipesQuery: 'omel' }, noopHandlers);
    const names = Array.from(container.querySelectorAll('[data-testid="recipe-row-name"]')).map((n) => n.textContent);
    expect(names).to.deep.equal(['Omelette']);
  });

  it('fires onRecipesQueryChange on the recipes-search input', () => {
    let captured = '';
    render(container, { ...baseVm, view: 'recipes' }, { ...noopHandlers, onRecipesQueryChange: (q) => { captured = q; } });
    const input = container.querySelector('[data-testid="recipes-search"]') as HTMLInputElement;
    input.value = 'omel';
    input.dispatchEvent(new Event('input'));
    expect(captured).to.equal('omel');
  });

  it('fires onEditRecipe with the id when Edit is clicked', () => {
    let captured = '';
    const state = stateWithRecipes(omelette);
    render(container, { ...baseVm, view: 'recipes', state }, { ...noopHandlers, onEditRecipe: (id) => { captured = id; } });
    (container.querySelector('[data-testid="recipe-edit"]') as HTMLButtonElement).click();
    expect(captured).to.equal('r1');
  });

  it('fires onSoftDeleteRecipe with the id when × is clicked', () => {
    let captured = '';
    const state = stateWithRecipes(omelette);
    render(container, { ...baseVm, view: 'recipes', state }, { ...noopHandlers, onSoftDeleteRecipe: (id) => { captured = id; } });
    (container.querySelector('[data-testid="recipe-delete"]') as HTMLButtonElement).click();
    expect(captured).to.equal('r1');
  });
});

describe('view — Foods list error', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('shows foods-list-error above the list when set', () => {
    render(container, { ...baseVm, view: 'foods', foodsError: 'Egg is in the Omelette recipe. Remove it from the recipe first.' }, noopHandlers);
    const err = container.querySelector('[data-testid="foods-list-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.equal('Egg is in the Omelette recipe. Remove it from the recipe first.');
  });

  it('clears foods-list-error when set to null', () => {
    render(container, { ...baseVm, view: 'foods', foodsError: 'x' }, noopHandlers);
    render(container, { ...baseVm, view: 'foods', foodsError: null }, noopHandlers);
    expect(container.querySelector('[data-testid="foods-list-error"]')).to.equal(null);
  });
});
