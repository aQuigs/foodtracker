import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { MACRO_KEYS, NUTRIENTS } from '../src/domain/types.js';
import { INLINE_SVG_PREFIX, clickLog, cssValue, fixedClock, iconLink, inlineSvgPaths, makeContainer, pickFood, seededRepo, setAmount } from './_helpers.js';

describe('favicon follows today', () => {
  let css: string;
  let style: HTMLStyleElement;
  let container: HTMLElement;
  let link: HTMLLinkElement;

  // The favicon reads its colours from the live stylesheet, so the real one is
  // attached for these tests.
  before(async () => {
    css = await (await fetch('/src/styles.css')).text();
    style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
  });

  after(() => style.remove());

  beforeEach(() => {
    container = makeContainer();
    link = iconLink();
  });

  afterEach(() => container.remove());

  it('keeps the static icon while nothing is logged today', () => {
    const original = link.href;
    createApp({ container, repo: seededRepo(), clock: fixedClock(), favicon: link });

    expect(link.href).to.equal(original);
  });

  it("draws today's macro split in the chart's colours once something is logged", () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock(), favicon: link });

    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);

    expect(link.href.startsWith(INLINE_SVG_PREFIX)).to.equal(true);
    const fills = inlineSvgPaths(link).map((p) => p.getAttribute('fill'));
    expect(fills).to.deep.equal(MACRO_KEYS.map((key) => cssValue(css, NUTRIENTS[key].sliceColor)));
    expect(fills).to.not.include('');
  });

  it("ignores the date being browsed: logging on yesterday leaves today's icon alone", () => {
    createApp({ container, repo: seededRepo(), clock: fixedClock(), favicon: link });
    pickFood(container, 'Banana');
    setAmount(container, '120');
    clickLog(container);
    const todayIcon = link.href;
    expect(todayIcon.startsWith(INLINE_SVG_PREFIX)).to.equal(true);

    (container.querySelector('[data-testid="prev-date"]') as HTMLButtonElement).click();
    expect(link.href).to.equal(todayIcon);

    pickFood(container, 'Olive oil');
    setAmount(container, '10');
    clickLog(container);
    expect(link.href).to.equal(todayIcon);
  });
});
