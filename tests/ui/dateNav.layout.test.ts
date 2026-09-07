import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { baseVm, loadStyles, noopHandlers, seedTestState, TODAY as today } from '../_helpers.js';

// The page shell from index.html: the stylesheet pads the body and caps main,
// so the date row gets the width it has on the live site.
function mountMain(): HTMLElement {
  const main = document.createElement('main');
  document.body.appendChild(main);
  return main;
}

function dateInputWidth(main: HTMLElement): number {
  const input = main.querySelector('[data-testid="date-input"]') as HTMLElement;
  return input.getBoundingClientRect().width;
}

// What the same input measures with nothing squeezing it — the width it needs
// to draw a date and its picker indicator, so a floor no reader would call thin.
function readableWidth(): number {
  const probe = document.createElement('input');
  probe.type = 'date';
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

describe('date nav — layout', () => {
  before(loadStyles);

  let main: HTMLElement;

  beforeEach(() => { main = mountMain(); });

  afterEach(() => main.remove());

  it('keeps the date field the same width on today and on any other day', () => {
    const vm = { ...baseVm, state: seedTestState(), today };
    render(main, { ...vm, selectedDate: today }, noopHandlers);
    const onToday = dateInputWidth(main);

    render(main, { ...vm, selectedDate: '2026-05-20' }, noopHandlers);
    const onAnotherDay = dateInputWidth(main);

    expect(onAnotherDay, `date field is ${Math.round(onToday)}px on today and ${Math.round(onAnotherDay)}px on another day`)
      .to.be.closeTo(onToday, 0.5);
    expect(onToday, 'date field collapsed').to.be.at.least(readableWidth());
  });

  it('keeps the date field readable in a row too narrow to hold one line', () => {
    main.style.maxWidth = '15rem';
    render(main, { ...baseVm, state: seedTestState(), today, selectedDate: today }, noopHandlers);

    const measured = dateInputWidth(main);
    const floor = readableWidth();
    expect(measured, `date field is ${Math.round(measured)}px, readable is ${Math.round(floor)}px`)
      .to.be.at.least(floor);
  });
});
