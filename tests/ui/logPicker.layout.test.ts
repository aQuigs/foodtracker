import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { baseVm, foodDetail, loadStyles, noopHandlers, seedTestState, TODAY as today } from '../_helpers.js';

describe('layout — log picker', () => {
  before(loadStyles);

  let main: HTMLElement;

  beforeEach(() => {
    main = document.createElement('main');
    document.body.append(main);
  });

  afterEach(() => main.remove());

  function picker(): HTMLElement {
    return main.querySelector('[data-testid="food-picker"]') as HTMLElement;
  }

  it('stands five rows tall however many foods are logged', () => {
    const seed = seedTestState().foods[0]!;
    const foods = Array.from({ length: 24 }, (_, i) => ({ ...seed, id: `f${i}`, name: `Food ${i}` }));
    render(main, { ...baseVm, state: { ...seedTestState(), foods }, today, selectedDate: today }, noopHandlers);

    const rowHeight = main.querySelector('[data-testid="food-option"]')!.getBoundingClientRect().height;
    expect(picker().clientHeight).to.be.closeTo(5 * rowHeight, 0.5);
  });

  it('keeps the selected food detail card out of the scrolling list', () => {
    render(main, {
      ...baseVm,
      state: seedTestState(), today, selectedDate: today,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);

    const card = foodDetail(main);
    expect(card === null, 'no detail card rendered').to.equal(false);
    expect(card!.closest('[data-testid="food-picker"]') !== null, 'the card sits inside the scrolling list').to.equal(false);
  });

  it('frames the standalone detail card on every side', () => {
    render(main, {
      ...baseVm,
      state: seedTestState(), today, selectedDate: today,
      selectedFoodId: 'seed-banana',
      expandedDetail: { kind: 'food', id: 'seed-banana' },
    }, noopHandlers);

    const style = getComputedStyle(foodDetail(main)!);
    const widths = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth];
    expect(new Set(widths).size, `card edges differ: ${widths.join(' ')}`).to.equal(1);
  });
});
