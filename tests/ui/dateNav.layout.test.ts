import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import { render } from '../../src/ui/view.js';
import { baseVm, boxOf, loadStyles, mountMain, noopHandlers, seedTestState, TODAY as today } from '../_helpers.js';

// What a date input measures with nothing squeezing it — the width it needs to
// draw a date and its picker indicator, so a floor no reader would call thin.
function readableWidth(): number {
  const probe = document.createElement('input');
  probe.type = 'date';
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

function rowHeight(main: HTMLElement): number {
  return main.querySelector('.date-nav')!.getBoundingClientRect().height;
}

function centreY(rect: DOMRect): number {
  return rect.y + rect.height / 2;
}

const CONTROLS = ['prev-date', 'date-input', 'next-date', 'jump-today'];

describe('date nav — layout', () => {
  before(loadStyles);

  let main: HTMLElement;

  beforeEach(async () => {
    await setViewport({ width: 1280, height: 800 });
    main = mountMain();
  });

  afterEach(() => main.remove());

  it('keeps the date row the same size on today and on any other day', () => {
    const vm = { ...baseVm, state: seedTestState(), today };
    render(main, { ...vm, selectedDate: today }, noopHandlers);
    const onToday = { field: boxOf(main, 'date-input').width, row: rowHeight(main) };

    render(main, { ...vm, selectedDate: '2026-05-20' }, noopHandlers);
    const onAnotherDay = { field: boxOf(main, 'date-input').width, row: rowHeight(main) };

    expect(onAnotherDay.field, `date field is ${Math.round(onToday.field)}px on today and ${Math.round(onAnotherDay.field)}px on another day`)
      .to.be.closeTo(onToday.field, 0.5);
    expect(onToday.field, 'date field collapsed').to.be.at.least(readableWidth());
    expect(onAnotherDay.row, `row is ${Math.round(onToday.row)}px on today and ${Math.round(onAnotherDay.row)}px on another day`)
      .to.be.closeTo(onToday.row, 0.5);
  });

  it('keeps the date field readable in a row too narrow to hold one line', () => {
    main.style.maxWidth = '15rem';
    render(main, { ...baseVm, state: seedTestState(), today, selectedDate: today }, noopHandlers);

    const measured = boxOf(main, 'date-input').width;
    const floor = readableWidth();
    expect(measured, `date field is ${Math.round(measured)}px, readable is ${Math.round(floor)}px`)
      .to.be.at.least(floor);
  });

  it('gives the arrows, the date and the Today jump one height and one centre', () => {
    render(main, { ...baseVm, state: seedTestState(), today, selectedDate: '2026-05-20' }, noopHandlers);

    const [first, ...rest] = CONTROLS.map((testid) => ({ testid, rect: boxOf(main, testid) }));
    for (const { testid, rect } of rest) {
      expect(rect.height, `${testid} is ${Math.round(rect.height)}px tall, ${first!.testid} is ${Math.round(first!.rect.height)}px`)
        .to.be.closeTo(first!.rect.height, 1);
      expect(centreY(rect), `${testid} centres at ${Math.round(centreY(rect))}, ${first!.testid} at ${Math.round(centreY(first!.rect))}`)
        .to.be.closeTo(centreY(first!.rect), 1);
    }
  });

  it('puts the day label under the date input, not beside it', () => {
    render(main, { ...baseVm, state: seedTestState(), today, selectedDate: '2026-05-20' }, noopHandlers);

    const label = boxOf(main, 'date-label');
    const input = boxOf(main, 'date-input');

    expect(label.top, `label starts at ${Math.round(label.top)}, the date input ends at ${Math.round(input.bottom)}`)
      .to.be.at.least(input.bottom - 0.5);
    expect(label.left, 'label is not under the date input').to.be.closeTo(input.left, 1);
  });
});
