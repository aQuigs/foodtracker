import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { createSourcePicker } from '../../src/ui/sourcePicker.js';
import type { SourcePicker, SourcePickerHandlers } from '../../src/ui/sourcePicker.js';
import { FOOD_SOURCES } from '../../src/domain/foodSources.js';
import { baseVm, loadStyles, noopHandlers } from '../_helpers.js';

const pickerHandlers: SourcePickerHandlers = {
  onToggle: () => {},
  onFilterChange: () => {},
  onSourceChange: () => {},
};

describe('layout — scroll panels', () => {
  before(loadStyles);

  let main: HTMLElement;

  beforeEach(() => {
    main = document.createElement('main');
    document.body.append(main);
  });

  afterEach(() => main.remove());

  function everySource(): SourcePicker {
    const picker = createSourcePicker(pickerHandlers);
    main.append(picker.node);
    picker.render({ sources: Object.values(FOOD_SOURCES), enabled: [], expanded: true, filter: '' });
    return picker;
  }

  function sourceList(picker: SourcePicker): HTMLElement {
    return picker.node.querySelector('[data-testid="source-list"]') as HTMLElement;
  }

  it('paints no box around a catalog panel that holds only a hint', () => {
    render(main, { ...baseVm, view: 'catalog' }, noopHandlers);

    const list = main.querySelector('ul.catalog-results') as HTMLElement;
    expect(list.querySelectorAll('li')).to.have.length(1);
    expect(getComputedStyle(list).borderTopWidth).to.equal('0px');
  });

  it('never cuts a source row in half at the panel edge', () => {
    const list = sourceList(everySource());
    const edge = list.getBoundingClientRect().bottom - parseFloat(getComputedStyle(list).borderBottomWidth);

    for (const row of list.querySelectorAll('[data-testid="source-option"]')) {
      const b = row.getBoundingClientRect();
      const straddles = b.top < edge - 0.5 && b.bottom > edge + 0.5;
      expect(straddles, `${row.textContent} straddles the panel edge`).to.equal(false);
    }
  });

  it('is a whole number of its own rows tall', () => {
    const list = sourceList(everySource());
    const rows = [...list.querySelectorAll('[data-testid="source-option"]')];
    const rowHeight = rows[0]!.getBoundingClientRect().height;

    for (const row of rows) {
      expect(row.getBoundingClientRect().height).to.be.closeTo(rowHeight, 0.5);
    }

    expect(list.clientHeight).to.be.closeTo(4 * rowHeight, 0.5);
  });
});
