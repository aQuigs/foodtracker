import { expect } from '@esm-bundle/chai';
import { createFavicon } from '../../src/ui/favicon.js';
import { MACRO_KEYS } from '../../src/domain/types.js';
import type { NutritionFacts } from '../../src/domain/types.js';
import { INLINE_SVG_PREFIX, iconLink, inlineSvgPaths, sharesOf } from '../_helpers.js';

function colorOf(key: keyof NutritionFacts): string {
  return `color(${key})`;
}

describe('createFavicon', () => {
  it('leaves the static icon in place while nothing was logged', () => {
    const link = iconLink();
    const original = link.href;

    createFavicon(link, colorOf).render(sharesOf(0, 0, 0));

    expect(link.href).to.equal(original);
  });

  it('swaps in an inline SVG donut of the shares, one path per macro that has any', () => {
    const link = iconLink();

    createFavicon(link, colorOf).render(sharesOf(50, 50, 0));

    expect(link.href.startsWith(INLINE_SVG_PREFIX)).to.equal(true);
    const drawn = inlineSvgPaths(link);
    expect(drawn.length).to.equal(2);
    expect(drawn.map((p) => p.getAttribute('fill'))).to.deep.equal(MACRO_KEYS.slice(0, 2).map(colorOf));
    expect(drawn.map((p) => p.getAttribute('d'))[0] ?? '').to.contain('A 46 46 0 0 1 50.000 96.000');
  });

  it('restores the static icon when the day empties again', () => {
    const link = iconLink();
    const original = link.href;
    const favicon = createFavicon(link, colorOf);

    favicon.render(sharesOf(50, 50, 0));
    favicon.render(sharesOf(0, 0, 0));

    expect(link.href).to.equal(original);
  });

  it('keeps the static icon until the stylesheet has supplied every colour it needs', () => {
    const link = iconLink();
    const original = link.href;
    const favicon = createFavicon(link, (key) => (key === MACRO_KEYS[0] ? '' : colorOf(key)));

    favicon.render(sharesOf(50, 50, 0));

    expect(link.href).to.equal(original);
  });

  it('swaps the donut in on a later render once a colour that was missing resolves', () => {
    const link = iconLink();
    let loaded = false;
    const favicon = createFavicon(link, (key) => (loaded ? colorOf(key) : ''));

    favicon.render(sharesOf(50, 50, 0));
    loaded = true;
    favicon.render(sharesOf(50, 50, 0));

    expect(link.href.startsWith(INLINE_SVG_PREFIX)).to.equal(true);
    expect(inlineSvgPaths(link).map((p) => p.getAttribute('fill'))).to.deep.equal(MACRO_KEYS.slice(0, 2).map(colorOf));
  });

  it('resolves each colour once and keeps it, since reading computed style forces a layout pass', () => {
    const link = iconLink();
    const asked: (keyof NutritionFacts)[] = [];
    const favicon = createFavicon(link, (key) => {
      asked.push(key);
      return colorOf(key);
    });

    favicon.render(sharesOf(50, 50, 0));
    favicon.render(sharesOf(60, 40, 0));

    expect(asked).to.deep.equal(MACRO_KEYS.slice(0, 2));
  });
});
