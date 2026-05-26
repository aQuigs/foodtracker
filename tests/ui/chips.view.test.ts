import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { baseVm, makeContainer, noopHandlers } from '../_helpers.js';

function chipRow(c: HTMLElement): HTMLElement | null {
  return c.querySelector('[data-testid="chip-row"]') as HTMLElement | null;
}

function chipValues(c: HTMLElement): string[] {
  return Array.from(c.querySelectorAll('[data-testid^="chip-"]'))
    .filter((e) => e.getAttribute('data-testid') !== 'chip-row')
    .map((e) => e.textContent!.trim());
}

describe('chip-row rendering', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('is hidden when no food is selected', () => {
    render(container, { ...baseVm, selectedFoodId: null }, noopHandlers);
    const row = chipRow(container);
    expect(row).to.exist;
    expect(row!.hidden).to.equal(true);
  });

  it('is visible when a food is selected', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);
    const row = chipRow(container);
    expect(row).to.exist;
    expect(row!.hidden).to.equal(false);
  });

  it('shows g chip values for logUnit=g', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, noopHandlers);
    expect(chipValues(container)).to.deep.equal(['50', '100', '150', '200']);
  });

  it('shows oz chip values for logUnit=oz', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'oz' }, noopHandlers);
    expect(chipValues(container)).to.deep.equal(['1', '2', '4', '8']);
  });

  it('shows lb chip values for logUnit=lb', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'lb' }, noopHandlers);
    expect(chipValues(container)).to.deep.equal(['0.25', '0.5', '0.75', '1']);
  });

  it('shows count chip values for logUnit=count', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-egg', logUnit: 'count' }, noopHandlers);
    expect(chipValues(container)).to.deep.equal(['1', '2', '3', '4']);
  });

  it('updates chips when logUnit changes between renders', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, noopHandlers);
    expect(chipValues(container)).to.deep.equal(['50', '100', '150', '200']);

    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'oz' }, noopHandlers);
    expect(chipValues(container)).to.deep.equal(['1', '2', '4', '8']);
  });

  it('uses chip-{value} data-testids', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'lb' }, noopHandlers);
    expect(container.querySelector('[data-testid="chip-0.25"]')).to.exist;
    expect(container.querySelector('[data-testid="chip-0.5"]')).to.exist;
    expect(container.querySelector('[data-testid="chip-0.75"]')).to.exist;
    expect(container.querySelector('[data-testid="chip-1"]')).to.exist;
  });

  it('clicking a chip calls onAmountChange with the chip value as a string', () => {
    let captured = '';
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, {
      ...noopHandlers,
      onAmountChange: (a) => { captured = a; },
    });
    (container.querySelector('[data-testid="chip-100"]') as HTMLButtonElement).click();
    expect(captured).to.equal('100');
  });

  it('clicking a fractional chip passes the exact stringified number', () => {
    let captured = '';
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'lb' }, {
      ...noopHandlers,
      onAmountChange: (a) => { captured = a; },
    });
    (container.querySelector('[data-testid="chip-0.25"]') as HTMLButtonElement).click();
    expect(captured).to.equal('0.25');
  });
});
