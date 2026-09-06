import { expect } from '@esm-bundle/chai';
import { formatRecipeTotal } from '../../src/ui/nutritionFormat.js';

// A fractional per-serving figure: rounding it and rounding the scaled sum
// disagree for half of all such values, so the line must multiply what it
// shows rather than round twice.
const perServing = { calories: 316.5, protein: 38.1, carbs: 1.8, fat: 18.66 };

describe('formatRecipeTotal', () => {
  it('shows the one-serving totals plainly at servings 1', () => {
    expect(formatRecipeTotal(perServing, 1)).to.equal('Total 317 cal · P 38.1g · C 1.8g · F 18.7g');
  });

  it('multiplies the per-serving calories it shows, so the line adds up at a glance', () => {
    expect(formatRecipeTotal(perServing, 2)).to.equal('Total 2 × 317 cal each serving = 634 cal · P 76.2g · C 3.6g · F 37.3g');
    expect(formatRecipeTotal(perServing, 4)).to.match(/^Total 4 × 317 cal each serving = 1268 cal/);
  });

  it('prints the servings count exactly, so the line matches what Log it writes', () => {
    expect(formatRecipeTotal(perServing, 2.125)).to.match(/^Total 2\.125 × 317 cal each serving = 674 cal/);
    expect(formatRecipeTotal(perServing, 1.004)).to.match(/^Total 1\.004 × 317 cal each serving = 318 cal/);
    expect(formatRecipeTotal(perServing, 0.001)).to.match(/^Total 0\.001 × 317 cal each serving = 0 cal/);
  });
});
