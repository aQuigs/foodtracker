import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import type { ViewModel } from '../../src/ui/view.js';
import { activeValue, baseVm, makeContainer, noopHandlers, pickValue } from '../_helpers.js';

function settingsVm(over: Partial<ViewModel>): ViewModel {
  return { ...baseVm, view: 'settings', ...over };
}

describe('settings view', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('has a Settings tab that is active on the settings view', () => {
    render(container, settingsVm({}), noopHandlers);
    expect(container.querySelector('[data-testid="view-toggle-settings"]')!.getAttribute('data-active')).to.equal('true');
    expect(container.querySelectorAll('[data-view="settings"]').length).to.equal(1);
    expect(container.querySelectorAll('[data-view="log"]').length).to.equal(0);
  });

  it('the Settings tab is an icon button labelled for assistive tech rather than text', () => {
    render(container, settingsVm({}), noopHandlers);
    const tab = container.querySelector('[data-testid="view-toggle-settings"]')!;
    expect(tab.getAttribute('aria-label')).to.equal('Settings');
    expect(tab.getAttribute('title')).to.equal('Settings');
    expect(tab.textContent!.trim()).to.equal('');
    expect(tab.querySelector('svg')).to.exist;
    expect(tab.querySelector('svg')!.getAttribute('aria-hidden')).to.equal('true');
  });

  it('clicking the Settings tab fires onViewChange with settings', () => {
    let last = '';
    render(container, { ...baseVm, view: 'log' }, { ...noopHandlers, onViewChange: (v) => { last = v; } });
    (container.querySelector('[data-testid="view-toggle-settings"]') as HTMLButtonElement).click();
    expect(last).to.equal('settings');
  });

  it('renders the meal-macros toggle with both options and percent active by default', () => {
    render(container, settingsVm({}), noopHandlers);
    const group = container.querySelector('[data-testid="meal-macros-group"]')!;
    expect(group.getAttribute('aria-label')).to.equal('Meal macros');
    expect(Array.from(group.querySelectorAll('button')).map((b) => b.textContent)).to.deep.equal(['%', 'g']);
    expect(activeValue(container, 'meal-macros-group')).to.equal('percent');
  });

  it('shows grams active when the state settings say grams', () => {
    const state = { ...baseVm.state, settings: { mealMacros: 'grams' as const } };
    render(container, settingsVm({ state }), noopHandlers);
    expect(activeValue(container, 'meal-macros-group')).to.equal('grams');
  });

  it('picking grams calls onUpdateSettings with the new value', () => {
    const picked: unknown[] = [];
    render(container, settingsVm({}), { ...noopHandlers, onUpdateSettings: (u) => picked.push(u) });
    pickValue(container, 'meal-macros-group', 'grams');
    expect(picked).to.deep.equal([{ mealMacros: 'grams' }]);
  });
});
