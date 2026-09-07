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
  });
});
