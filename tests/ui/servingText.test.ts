import { expect } from '@esm-bundle/chai';
import { servingText } from '../../src/ui/servingText.js';

describe('servingText', () => {
  it('shows the serving size and unit when the food has no pieces', () => {
    expect(servingText({ servingSize: 296, servingUnit: 'ml' })).to.equal('296 ml');
    expect(servingText({ servingSize: 1, servingUnit: 'count' })).to.equal('1 count');
  });

  it('leads with the pieces and their noun, or "count" when they have none', () => {
    expect(servingText({ servingSize: 296, servingUnit: 'ml', pieces: { perServing: 1, noun: 'bottle' } }))
      .to.equal('1 bottle · 296 ml');
    expect(servingText({ servingSize: 50, servingUnit: 'g', pieces: { perServing: 1 } })).to.equal('1 count · 50 g');
  });
});
