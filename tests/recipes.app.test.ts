import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { fixedClock, makeContainer, seededRepo, clickFoodsTab, clickLogTab, clickRecipesTab } from './_helpers.js';

function typeRecipeName(c: HTMLElement, value: string): void {
  const input = c.querySelector('[data-testid="recipe-form-name"]') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function searchRecipeFood(c: HTMLElement, q: string): void {
  const input = c.querySelector('[data-testid="recipe-food-search"]') as HTMLInputElement;
  input.value = q;
  input.dispatchEvent(new Event('input'));
}

function pickRecipeFoodOption(c: HTMLElement, name: string): void {
  const opts = Array.from(c.querySelectorAll('[data-testid="recipe-food-option"]')) as HTMLElement[];
  const match = opts.find((o) => o.textContent!.includes(name));
  if (!match) {
    throw new Error(`No recipe food option containing "${name}"`);
  }

  match.click();
}

function addFoodToRecipe(c: HTMLElement, name: string): void {
  searchRecipeFood(c, name);
  pickRecipeFoodOption(c, name);
}

function recipeItemRow(c: HTMLElement, foodId: string): HTMLElement {
  return c.querySelector(`[data-testid="recipe-form-item"][data-food-id="${foodId}"]`) as HTMLElement;
}

function setRecipeItemAmount(c: HTMLElement, foodId: string, amount: string): void {
  const input = recipeItemRow(c, foodId).querySelector('[data-testid="recipe-form-amount"]') as HTMLInputElement;
  input.value = amount;
  input.dispatchEvent(new Event('input'));
}

function submitRecipeForm(c: HTMLElement): void {
  (c.querySelector('[data-testid="recipe-form-submit"]') as HTMLButtonElement).click();
}

function recipeRow(c: HTMLElement, name: string): HTMLElement {
  const rows = Array.from(c.querySelectorAll('[data-testid="recipe-row"]')) as HTMLElement[];
  const match = rows.find((r) => r.querySelector('[data-testid="recipe-row-name"]')!.textContent === name);
  if (!match) {
    throw new Error(`No recipe row named "${name}"`);
  }

  return match;
}

function addOmelette(c: HTMLElement): void {
  typeRecipeName(c, 'Omelette');
  addFoodToRecipe(c, 'Egg');
  setRecipeItemAmount(c, 'seed-egg', '3');
  addFoodToRecipe(c, 'Chicken breast');
  setRecipeItemAmount(c, 'seed-chicken', '60');
  submitRecipeForm(c);
}

function expectFormHasEggAndChicken(c: HTMLElement, name: string): void {
  expect((c.querySelector('[data-testid="recipe-form-name"]') as HTMLInputElement).value).to.equal(name);
  expect(recipeItemRow(c, 'seed-egg')).to.exist;
  expect(recipeItemRow(c, 'seed-chicken')).to.exist;
  expect((c.querySelector('[data-testid="recipe-food-search"]') as HTMLInputElement).value).to.equal('ba');
}

function eggRow(c: HTMLElement): HTMLElement {
  const rows = Array.from(c.querySelectorAll('[data-testid="food-row"]')) as HTMLElement[];
  const match = rows.find((r) => r.querySelector('[data-testid="food-row-name"]')!.textContent!.includes('Egg'));
  if (!match) {
    throw new Error('No food row for Egg');
  }

  return match;
}

describe('app — Recipes view', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('adds a recipe from two items and shows its item count and calories', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    addOmelette(container);

    const row = recipeRow(container, 'Omelette');
    // seed-egg: 78 cal each * 3 = 234; seed-chicken: 165 cal/100g * 60g = 99 => 333
    expect(row.querySelector('[data-testid="recipe-row-summary"]')!.textContent).to.equal('2 items · 333 cal');
  });

  it('no longer offers a food already added to the recipe', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    addFoodToRecipe(container, 'Egg');
    searchRecipeFood(container, 'Egg');
    const opts = Array.from(container.querySelectorAll('[data-testid="recipe-food-option"]')).map((o) => o.textContent);
    expect(opts.some((t) => t!.includes('Egg'))).to.equal(false);
  });

  it('prefills the form when editing a recipe, and Save updates it', () => {
    const repo = seededRepo();
    createApp({ container, repo, clock: fixedClock() });
    clickRecipesTab(container);
    addOmelette(container);

    (recipeRow(container, 'Omelette').querySelector('[data-testid="recipe-edit"]') as HTMLButtonElement).click();
    expect((container.querySelector('[data-testid="recipe-form-name"]') as HTMLInputElement).value).to.equal('Omelette');
    expect(recipeItemRow(container, 'seed-egg')).to.exist;
    expect(recipeItemRow(container, 'seed-chicken')).to.exist;

    setRecipeItemAmount(container, 'seed-egg', '2');
    submitRecipeForm(container);

    // seed-egg 2 * 78 = 156; seed-chicken 60g -> 99 => 255
    const row = recipeRow(container, 'Omelette');
    expect(row.querySelector('[data-testid="recipe-row-summary"]')!.textContent).to.equal('2 items · 255 cal');
  });

  it('Cancel restores the form to empty without changing the recipe', () => {
    const repo = seededRepo();
    createApp({ container, repo, clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    setRecipeItemAmount(container, 'seed-egg', '3');
    submitRecipeForm(container);

    (recipeRow(container, 'Omelette').querySelector('[data-testid="recipe-edit"]') as HTMLButtonElement).click();
    setRecipeItemAmount(container, 'seed-egg', '9');
    (container.querySelector('[data-testid="recipe-form-cancel"]') as HTMLButtonElement).click();

    expect(container.querySelector('[data-testid="recipe-form-cancel"]')).to.equal(null);
    expect((container.querySelector('[data-testid="recipe-form-name"]') as HTMLInputElement).value).to.equal('');
    const row = recipeRow(container, 'Omelette');
    expect(row.querySelector('[data-testid="recipe-row-summary"]')!.textContent).to.contain('234 cal');
  });

  it('removes a recipe via × and soft-deletes it in the repo', () => {
    const repo = seededRepo();
    createApp({ container, repo, clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    submitRecipeForm(container);

    (recipeRow(container, 'Omelette').querySelector('[data-testid="recipe-delete"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="recipe-row"]')).to.equal(null);
    const persisted = repo.load().recipes.find((r) => r.name === 'Omelette');
    expect(persisted?.deletedAt).to.not.equal(null);
  });

  it('refuses a duplicate recipe name', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    submitRecipeForm(container);

    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Chicken breast');
    submitRecipeForm(container);

    const err = container.querySelector('[data-testid="recipe-form-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('already exists');
  });

  it('removing an item before submit excludes it from the saved recipe', () => {
    const repo = seededRepo();
    createApp({ container, repo, clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    setRecipeItemAmount(container, 'seed-egg', '3');
    addFoodToRecipe(container, 'Chicken breast');
    setRecipeItemAmount(container, 'seed-chicken', '60');

    (recipeItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-form-remove"]') as HTMLButtonElement).click();
    submitRecipeForm(container);

    const saved = repo.load().recipes.find((r) => r.name === 'Omelette');
    expect(saved?.items).to.deep.equal([{ foodId: 'seed-chicken', amount: 60, unit: 'g' }]);
  });

  it('clears a stale Save error on a tab switch but keeps the form', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    setRecipeItemAmount(container, 'seed-egg', '0');
    submitRecipeForm(container);

    const err = container.querySelector('[data-testid="recipe-form-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.equal('Every item needs an amount greater than 0.');

    clickFoodsTab(container);
    clickRecipesTab(container);

    expect(container.querySelector('[data-testid="recipe-form-error"]') === null).to.equal(true);
    expect((container.querySelector('[data-testid="recipe-form-name"]') as HTMLInputElement).value).to.equal('Omelette');
    expect(recipeItemRow(container, 'seed-egg')).to.exist;
  });

  it('the form (name, items, food query) survives Foods and Log tab round trips while adding', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Half-typed');
    addFoodToRecipe(container, 'Egg');
    setRecipeItemAmount(container, 'seed-egg', '3');
    addFoodToRecipe(container, 'Chicken breast');
    setRecipeItemAmount(container, 'seed-chicken', '60');
    searchRecipeFood(container, 'ba');

    clickFoodsTab(container);
    clickRecipesTab(container);
    expectFormHasEggAndChicken(container, 'Half-typed');

    clickLogTab(container);
    clickRecipesTab(container);
    expectFormHasEggAndChicken(container, 'Half-typed');
  });

  it('the form survives Foods and Log tab round trips while editing', () => {
    const repo = seededRepo();
    createApp({ container, repo, clock: fixedClock() });
    clickRecipesTab(container);
    addOmelette(container);

    (recipeRow(container, 'Omelette').querySelector('[data-testid="recipe-edit"]') as HTMLButtonElement).click();
    setRecipeItemAmount(container, 'seed-egg', '5');
    searchRecipeFood(container, 'ba');

    clickFoodsTab(container);
    clickRecipesTab(container);
    expect((container.querySelector('[data-testid="recipe-form-name"]') as HTMLInputElement).value).to.equal('Omelette');
    expect((recipeItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-form-amount"]') as HTMLInputElement).value).to.equal('5');
    expect((container.querySelector('[data-testid="recipe-food-search"]') as HTMLInputElement).value).to.equal('ba');
    expect(container.querySelector('[data-testid="recipe-form-cancel"]')).to.exist;

    clickLogTab(container);
    clickRecipesTab(container);
    expect((container.querySelector('[data-testid="recipe-form-name"]') as HTMLInputElement).value).to.equal('Omelette');
    expect((recipeItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-form-amount"]') as HTMLInputElement).value).to.equal('5');
    expect(container.querySelector('[data-testid="recipe-form-cancel"]')).to.exist;
  });

  it('a food deleted on the Foods tab while unsaved in the form shows (deleted) and blocks Save until it is removed', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    setRecipeItemAmount(container, 'seed-egg', '3');
    addFoodToRecipe(container, 'Chicken breast');
    setRecipeItemAmount(container, 'seed-chicken', '60');

    clickFoodsTab(container);
    (eggRow(container).querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="foods-list-error"]') === null).to.equal(true);

    clickRecipesTab(container);
    expect(recipeItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-form-item-name"]')!.textContent)
      .to.equal('Egg (deleted)');

    submitRecipeForm(container);
    const err = container.querySelector('[data-testid="recipe-form-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.equal('One of the foods is no longer available.');

    (recipeItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-form-remove"]') as HTMLButtonElement).click();
    submitRecipeForm(container);

    expect(container.querySelector('[data-testid="recipe-form-error"]') === null).to.equal(true);
    expect(recipeRow(container, 'Omelette')).to.exist;
  });

  it('a food\'s axis changed on the Foods tab while unsaved in the form blocks Save until a new unit is picked', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    setRecipeItemAmount(container, 'seed-egg', '3');

    clickFoodsTab(container);
    (eggRow(container).querySelector('[data-testid="food-edit"]') as HTMLButtonElement).click();
    const unitGroup = container.querySelector('[data-testid="food-form-servingUnit"]') as HTMLElement;
    (unitGroup.querySelector('[data-unit="g"]') as HTMLButtonElement).click();
    (container.querySelector('[data-testid="food-form-submit"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="food-form-error"]') === null).to.equal(true);

    clickRecipesTab(container);
    submitRecipeForm(container);
    const err = container.querySelector('[data-testid="recipe-form-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.equal('Pick a unit for every item.');

    const eggUnitPicker = recipeItemRow(container, 'seed-egg').querySelector('[data-testid="recipe-form-unit-seed-egg"]') as HTMLElement;
    (eggUnitPicker.querySelector('[data-unit="g"]') as HTMLButtonElement).click();
    submitRecipeForm(container);

    expect(container.querySelector('[data-testid="recipe-form-error"]') === null).to.equal(true);
    expect(recipeRow(container, 'Omelette')).to.exist;
  });

  it('Import still resets the recipe form', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Half-typed');
    addFoodToRecipe(container, 'Egg');

    clickFoodsTab(container);
    (container.querySelector('[data-testid="export-button"]') as HTMLButtonElement).click();
    const exported = (container.querySelector('[data-testid="export-textarea"]') as HTMLTextAreaElement).value;
    const importTa = container.querySelector('[data-testid="import-textarea"]') as HTMLTextAreaElement;
    importTa.value = exported;
    importTa.dispatchEvent(new Event('input'));
    (container.querySelector('[data-testid="import-button"]') as HTMLButtonElement).click();

    clickRecipesTab(container);
    expect((container.querySelector('[data-testid="recipe-form-name"]') as HTMLInputElement).value).to.equal('');
    expect(container.querySelector('[data-testid="recipe-form-item"]')).to.equal(null);
  });
});

describe('app — Foods tab delete refusal for recipe use', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('refuses to delete a food used by a live recipe, with a message naming the recipe', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    submitRecipeForm(container);

    clickFoodsTab(container);
    (eggRow(container).querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();

    const err = container.querySelector('[data-testid="foods-list-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.equal('Egg is in the Omelette recipe. Remove it from the recipe first.');
    expect(container.querySelectorAll('[data-testid="food-row-name"]').length).to.be.greaterThan(0);
    expect(eggRow(container)).to.exist;
  });

  it('clears the error once a different, unblocked food is deleted, without switching tabs', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    submitRecipeForm(container);

    clickFoodsTab(container);
    (eggRow(container).querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="foods-list-error"]')).to.exist;

    const bananaRow = Array.from(container.querySelectorAll('[data-testid="food-row"]'))
      .find((r) => r.querySelector('[data-testid="food-row-name"]')!.textContent!.includes('Banana'))!;
    (bananaRow.querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();

    expect(container.querySelector('[data-testid="foods-list-error"]')).to.equal(null);
    const names = Array.from(container.querySelectorAll('[data-testid="food-row-name"]')).map((n) => n.textContent);
    expect(names).to.not.include('Banana');
    expect(eggRow(container)).to.exist;
  });

  it('lets Egg be deleted once the blocking recipe is deleted, clearing the error', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    submitRecipeForm(container);

    clickFoodsTab(container);
    (eggRow(container).querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="foods-list-error"]')).to.exist;
    expect(eggRow(container)).to.exist;

    clickRecipesTab(container);
    (recipeRow(container, 'Omelette').querySelector('[data-testid="recipe-delete"]') as HTMLButtonElement).click();

    clickFoodsTab(container);
    (eggRow(container).querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();

    expect(container.querySelector('[data-testid="foods-list-error"]') === null).to.equal(true);
    const names = Array.from(container.querySelectorAll('[data-testid="food-row-name"]')).map((n) => n.textContent);
    expect(names.some((n) => n!.includes('Egg'))).to.equal(false);
  });

  it('refuses switching Egg to a weight unit while the Omelette recipe uses it, naming the recipe', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    submitRecipeForm(container);

    clickFoodsTab(container);
    (eggRow(container).querySelector('[data-testid="food-edit"]') as HTMLButtonElement).click();

    const unitGroup = container.querySelector('[data-testid="food-form-servingUnit"]') as HTMLElement;
    (unitGroup.querySelector('[data-unit="g"]') as HTMLButtonElement).click();
    (container.querySelector('[data-testid="food-form-submit"]') as HTMLButtonElement).click();

    const err = container.querySelector('[data-testid="food-form-error"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('Omelette');
  });

  it('clears the foods-list-error when the foods search query changes', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    submitRecipeForm(container);

    clickFoodsTab(container);
    (eggRow(container).querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="foods-list-error"]')).to.exist;

    const search = container.querySelector('[data-testid="foods-search"]') as HTMLInputElement;
    search.value = 'ban';
    search.dispatchEvent(new Event('input'));

    // Asserted as a boolean, not a direct DOM-node comparison: a failing
    // `expect(<element>).to.equal(null)` makes chai serialize the live node
    // for its diff, which hangs the browser tab instead of failing cleanly.
    expect(container.querySelector('[data-testid="foods-list-error"]') === null).to.equal(true);
  });

  it('clears the foods-list-error when starting to edit a food', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    clickRecipesTab(container);
    typeRecipeName(container, 'Omelette');
    addFoodToRecipe(container, 'Egg');
    submitRecipeForm(container);

    clickFoodsTab(container);
    (eggRow(container).querySelector('[data-testid="food-delete"]') as HTMLButtonElement).click();
    expect(container.querySelector('[data-testid="foods-list-error"]')).to.exist;

    const bananaRow = Array.from(container.querySelectorAll('[data-testid="food-row"]'))
      .find((r) => r.querySelector('[data-testid="food-row-name"]')!.textContent!.includes('Banana'))!;
    (bananaRow.querySelector('[data-testid="food-edit"]') as HTMLButtonElement).click();

    expect(container.querySelector('[data-testid="foods-list-error"]') === null).to.equal(true);
  });
});
