import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import { makeContainer, noopViewHandlers as noopHandlers } from '../_helpers.js';

const today = '2026-05-25';

async function loadStyles(): Promise<void> {
  if (document.querySelector('link[data-styles="app"]')) {
    return;
  }

  const css = await fetch(new URL('../../src/styles.css', import.meta.url)).then((r) => r.text());
  const style = document.createElement('style');
  style.setAttribute('data-styles', 'app');
  style.textContent = css;
  document.head.append(style);
}

describe('food-option visual affordance', () => {
  let container: HTMLElement;
  beforeEach(async () => {
    await loadStyles();
    container = makeContainer();
  });
  afterEach(() => container.remove());

  it('shows a pointer cursor on hover so users know it is clickable', () => {
    render(container, { state: freshState(), today, selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const opt = container.querySelector('[data-testid="food-option"]') as HTMLElement;
    const cursor = getComputedStyle(opt).cursor;
    expect(cursor, `food-option cursor was "${cursor}" — should be "pointer" so users can tell it is clickable`).to.equal('pointer');
  });

  it('extends its click target to a full-width row (not just the text glyphs)', () => {
    render(container, { state: freshState(), today, selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const opt = container.querySelector('[data-testid="food-option"]') as HTMLElement;
    const picker = container.querySelector('[data-testid="food-picker"]') as HTMLElement;
    const optWidth = opt.getBoundingClientRect().width;
    const pickerWidth = picker.getBoundingClientRect().width;
    expect(optWidth, 'food-option should fill the picker width so the whole row is clickable').to.be.closeTo(pickerWidth, 1);
  });

  it('has visible vertical padding so adjacent rows are distinguishable click targets', () => {
    render(container, { state: freshState(), today, selectedDate: today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const opt = container.querySelector('[data-testid="food-option"]') as HTMLElement;
    const cs = getComputedStyle(opt);
    const padTop = parseFloat(cs.paddingTop);
    const padBottom = parseFloat(cs.paddingBottom);
    expect(padTop + padBottom, 'food-option should have non-trivial vertical padding for a clickable hit area').to.be.greaterThan(4);
  });

  it('selected food has a visible background highlight', () => {
    render(container, { state: freshState(), today, selectedDate: today, query: '', selectedFoodId: 'seed-banana', gramsRaw: '', error: null }, noopHandlers);
    const selected = container.querySelector('[data-testid="food-option"][data-selected="true"]') as HTMLElement;
    expect(selected, 'a selected food option should exist').to.exist;
    const bg = getComputedStyle(selected).backgroundColor;
    expect(bg, `selected food-option background was "${bg}" — should be non-transparent so the selection is visible`)
      .to.not.match(/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/);
  });
});
