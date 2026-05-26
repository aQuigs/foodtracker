import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { baseVm, chipButtons, chipLabels, chipRow, makeContainer, noopHandlers } from '../_helpers.js';

describe('chip-row rendering', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('is hidden when no food is selected', () => {
    render(container, { ...baseVm, selectedFoodId: null }, noopHandlers);
    expect(chipRow(container).hidden).to.equal(true);
  });

  it('is visible when a food is selected', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana' }, noopHandlers);
    expect(chipRow(container).hidden).to.equal(false);
  });

  it('shows g chip values for logUnit=g', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, noopHandlers);
    expect(chipLabels(container)).to.deep.equal(['50', '100', '150', '200']);
  });

  it('shows oz chip values for logUnit=oz', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'oz' }, noopHandlers);
    expect(chipLabels(container)).to.deep.equal(['1', '2', '4', '8']);
  });

  it('shows lb chip values for logUnit=lb', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'lb' }, noopHandlers);
    expect(chipLabels(container)).to.deep.equal(['0.25', '0.5', '0.75', '1']);
  });

  it('shows count chip values for logUnit=count', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-egg', logUnit: 'count' }, noopHandlers);
    expect(chipLabels(container)).to.deep.equal(['1', '2', '3', '4']);
  });

  it('updates chips when logUnit changes between renders', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, noopHandlers);
    expect(chipLabels(container)).to.deep.equal(['50', '100', '150', '200']);

    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'oz' }, noopHandlers);
    expect(chipLabels(container)).to.deep.equal(['1', '2', '4', '8']);
  });

  it('chip buttons use chip-button-{value} data-testids', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'lb' }, noopHandlers);
    expect(container.querySelector('[data-testid="chip-button-0.25"]')).to.exist;
    expect(container.querySelector('[data-testid="chip-button-0.5"]')).to.exist;
    expect(container.querySelector('[data-testid="chip-button-0.75"]')).to.exist;
    expect(container.querySelector('[data-testid="chip-button-1"]')).to.exist;
  });

  it('clicking a chip calls onAmountChange with the chip value as a string', () => {
    let captured = '';
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, {
      ...noopHandlers,
      onAmountChange: (a) => { captured = a; },
    });
    (container.querySelector('[data-testid="chip-button-100"]') as HTMLButtonElement).click();
    expect(captured).to.equal('100');
  });

  it('clicking a fractional chip passes the exact stringified number', () => {
    let captured = '';
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'lb' }, {
      ...noopHandlers,
      onAmountChange: (a) => { captured = a; },
    });
    (container.querySelector('[data-testid="chip-button-0.25"]') as HTMLButtonElement).click();
    expect(captured).to.equal('0.25');
  });

  it('clicking a chip moves focus to the Log button', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, noopHandlers);
    const chip = container.querySelector('[data-testid="chip-button-100"]') as HTMLButtonElement;
    chip.click();
    const logBtn = container.querySelector('[data-testid="log-button"]') as HTMLButtonElement;
    expect(document.activeElement).to.equal(logBtn);
  });

  it('chip-row has role=group and an aria-label that names the current unit', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'g' }, noopHandlers);
    const row = chipRow(container);
    expect(row.getAttribute('role')).to.equal('group');
    expect(row.getAttribute('aria-label')).to.match(/gram/i);
  });

  it('each chip has an aria-label that includes the unit, not just the number', () => {
    render(container, { ...baseVm, selectedFoodId: 'seed-banana', logUnit: 'lb' }, noopHandlers);
    const labels = chipButtons(container).map((b) => b.getAttribute('aria-label'));
    expect(labels.every((l) => l !== null && /lb|pound/i.test(l))).to.equal(true);
  });
});
