import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { baseVm, makeContainer, noopHandlers } from '../_helpers.js';
import { fakeBrandList } from '../brandsFakes.js';

describe('view — hydration banners', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('names a single download by its source — a brand by its label in the brand list', () => {
    render(container, {
      ...baseVm,
      brandList: { kind: 'ready', list: fakeBrandList([{ id: 'm-ms', label: "M&M's", rows: [] }]) },
      hydration: { sources: { 'brand:m-ms': { kind: 'fetching', loaded: 51200 } } },
    }, noopHandlers);

    const banner = container.querySelector('[data-testid="hydration-banner"]')!;
    expect(banner.textContent).to.equal("M&M's: downloading… 50 KB");
    expect(banner.getAttribute('data-source')).to.equal('brand:m-ms');
  });

  it('reads a brand\'s id as words until the brand list has loaded', () => {
    render(container, {
      ...baseVm,
      hydration: { sources: { 'brand:kirkland-signature': { kind: 'fetching', loaded: 0 } } },
    }, noopHandlers);

    expect(container.querySelector('[data-testid="hydration-banner"]')!.textContent).to.equal('Kirkland Signature: downloading…');
  });

  it('folds several downloads into one line with their bytes summed, and keeps failures on their own lines', () => {
    render(container, {
      ...baseVm,
      hydration: { sources: {
        'brand:kirkland': { kind: 'fetching', loaded: 10240 },
        'brand:costco': { kind: 'fetching', loaded: 20480 },
        usda: { kind: 'failed', cachedVersion: null, message: 'boom' },
      } },
    }, noopHandlers);

    const banners = container.querySelectorAll('[data-testid="hydration-banner"]');
    expect(banners).to.have.lengthOf(1);
    expect(banners[0]!.textContent).to.equal('2 sources: downloading… 30 KB');
    expect(banners[0]!.getAttribute('data-sources')).to.equal('2');
    expect(banners[0]!.hasAttribute('data-source')).to.equal(false);

    const errors = container.querySelectorAll('[data-testid="hydration-error"]');
    expect(errors).to.have.lengthOf(1);
    expect(errors[0]!.textContent).to.equal("Everyday foods: couldn't load. Reload to retry.");
    expect(errors[0]!.getAttribute('title')).to.equal('boom');
  });
});
