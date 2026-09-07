import { expect } from '@esm-bundle/chai';
import { formatRecipeTotal } from '../../src/ui/nutritionFormat.js';
import { scaleNutrition } from '../../src/domain/calc.js';

// A fractional per-serving figure: rounding it before scaling and rounding the
// scaled sum disagree for half of all such values, and logging the recipe sums
// the entries unrounded, so the card must round once at the end too.
const perServing = { calories: 334.65, protein: 38.1, carbs: 1.8, fat: 18.7 };

function totalFor(servings: number): string {
  return formatRecipeTotal({ perServing, batch: scaleNutrition(perServing, servings), servings });
}

describe('formatRecipeTotal', () => {
  it('shows the one-serving totals plainly at servings 1', () => {
    expect(totalFor(1)).to.equal('Total 335 cal · P 38.1g · C 1.8g · F 18.7g');
  });

  it('rounds the scaled total once, so it matches what logging the recipe records', () => {
    expect(totalFor(2)).to.equal('Total for 2 servings: 669 cal · P 76.2g · C 3.6g · F 37.4g (335 cal each)');
  });

  it('keeps the per-serving calories in view at any servings count', () => {
    expect(totalFor(4)).to.contain('(335 cal each)');
  });

  it('prints the servings count the way the logged group header prints it', () => {
    expect(totalFor(2.125)).to.match(/^Total for 2\.13 servings: 711 cal/);
  });

  it('calls a count that prints as 1 one serving, the way the group header does', () => {
    expect(totalFor(1.004)).to.equal('Total 336 cal · P 38.3g · C 1.8g · F 18.8g');
  });
});
