import { expect } from '@esm-bundle/chai';
import { formatRecipeTotal } from '../../src/ui/nutritionFormat.js';

const perServing = { calories: 333, protein: 38.1, carbs: 1.8, fat: 18.66 };

describe('formatRecipeTotal', () => {
  it('shows the one-serving totals plainly at servings 1', () => {
    expect(formatRecipeTotal(perServing, 1)).to.equal('Total 333 cal · P 38.1g · C 1.8g · F 18.7g');
  });

  it('spells out servings × one-serving calories, then the scaled totals', () => {
    expect(formatRecipeTotal(perServing, 2)).to.equal('Total 2 × 333 cal each serving = 666 cal · P 76.2g · C 3.6g · F 37.3g');
  });

  it('prints the servings count exactly, so the line matches what Log it writes', () => {
    expect(formatRecipeTotal(perServing, 2.125)).to.match(/^Total 2\.125 × 333 cal each serving = 708 cal/);
    expect(formatRecipeTotal(perServing, 1.004)).to.match(/^Total 1\.004 × 333 cal each serving = 334 cal/);
    expect(formatRecipeTotal(perServing, 0.001)).to.match(/^Total 0\.001 × 333 cal each serving = 0 cal/);
  });
});
