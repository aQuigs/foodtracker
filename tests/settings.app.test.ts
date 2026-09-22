import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import {
  activeValue, clickLog, fixedClock, makeContainer, pickFood, pickValue, seededRepo, setAmount, switchView,
} from './_helpers.js';

function mealHeaderTotal(c: HTMLElement): string {
  return (c.querySelector('[data-testid="meal-header-total"]')!.textContent || '').trim();
}

describe('app — settings: meal-macro display', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('the meal header shows percentages by default', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    expect(mealHeaderTotal(container)).to.match(/^89 cal · P \d+% · C \d+% · F \d+%$/);
  });

  it('the Settings tab shows percent active by default', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    switchView(container, 'settings');
    expect(activeValue(container, 'meal-macros-group')).to.equal('percent');
  });

  it('picking grams switches the meal header to grams', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    switchView(container, 'settings');
    pickValue(container, 'meal-macros-group', 'grams');

    switchView(container, 'log');
    expect(mealHeaderTotal(container)).to.contain('22.8g');
  });

  it('the grams choice persists across a reload', () => {
    const repo = seededRepo();
    createApp({ container, repo, clock: fixedClock() });
    switchView(container, 'settings');
    pickValue(container, 'meal-macros-group', 'grams');

    expect(repo.load().settings.mealMacros).to.equal('grams');

    const container2 = makeContainer();
    createApp({ container: container2, repo, clock: fixedClock() });
    switchView(container2, 'settings');
    expect(activeValue(container2, 'meal-macros-group')).to.equal('grams');
    container2.remove();
  });

  it('switching back to percent works', () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    pickFood(container, 'Banana');
    setAmount(container, '100');
    clickLog(container);

    switchView(container, 'settings');
    pickValue(container, 'meal-macros-group', 'grams');
    pickValue(container, 'meal-macros-group', 'percent');

    switchView(container, 'log');
    expect(mealHeaderTotal(container)).to.match(/^89 cal · P \d+% · C \d+% · F \d+%$/);
  });
});
