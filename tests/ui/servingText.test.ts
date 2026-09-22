import { expect } from '@esm-bundle/chai';
import { servingText } from '../../src/ui/servingText.js';

describe('servingText', () => {
  it('shows the serving size and unit when the food has no pieces', () => {
    expect(servingText({ servingSize: 296, servingUnit: 'ml' })).to.equal('296 ml');
    expect(servingText({ servingSize: 100, servingUnit: 'g' })).to.equal('100 g');
  });

  it('leads with the pieces and their noun when the food has them', () => {
    expect(servingText({ servingSize: 296, servingUnit: 'ml', pieces: { perServing: 1, noun: 'bottle' } }))
      .to.equal('1 bottle · 296 ml');
    expect(servingText({ servingSize: 30, servingUnit: 'g', pieces: { perServing: 8, noun: 'cookies' } }))
      .to.equal('8 cookies · 30 g');
  });

  it('reads "count" when pieces have no noun', () => {
    expect(servingText({ servingSize: 50, servingUnit: 'g', pieces: { perServing: 1 } })).to.equal('1 count · 50 g');
  });

  it('keeps today\'s plain text for a count-unit food (pieces never apply there)', () => {
    expect(servingText({ servingSize: 1, servingUnit: 'count' })).to.equal('1 count');
  });
});
