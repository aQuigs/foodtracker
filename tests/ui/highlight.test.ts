import { expect } from '@esm-bundle/chai';
import { renderHighlighted } from '../../src/ui/highlight.js';

function plain(parts: (string | HTMLElement)[]): string {
  return parts.map((p) => (typeof p === 'string' ? p : `<mark>${p.textContent}</mark>`)).join('');
}

describe('renderHighlighted', () => {
  it('returns the bare name when there are no indices', () => {
    const out = renderHighlighted('Banana', []);
    expect(out).to.have.lengthOf(1);
    expect(out[0]).to.equal('Banana');
  });

  it('wraps a single matched range in a <mark>', () => {
    const out = renderHighlighted('Banana', [[0, 0]]);
    expect(plain(out)).to.equal('<mark>B</mark>anana');
    const marks = out.filter((p): p is HTMLElement => typeof p !== 'string');
    expect(marks).to.have.lengthOf(1);
    expect(marks[0]!.tagName).to.equal('MARK');
    expect(marks[0]!.textContent).to.equal('B');
  });

  it('wraps multiple non-adjacent ranges', () => {
    const out = renderHighlighted('Chicken breast', [[0, 0], [8, 9]]);
    expect(plain(out)).to.equal('<mark>C</mark>hicken <mark>br</mark>east');
  });

  it('handles a range that covers the full name', () => {
    const out = renderHighlighted('Oats', [[0, 3]]);
    expect(plain(out)).to.equal('<mark>Oats</mark>');
  });

  it('preserves character order across many ranges', () => {
    const out = renderHighlighted('Greek yogurt', [[0, 0], [6, 6]]);
    expect(plain(out)).to.equal('<mark>G</mark>reek <mark>y</mark>ogurt');
  });
});
