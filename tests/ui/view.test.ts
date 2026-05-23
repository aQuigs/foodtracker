import { expect } from '@esm-bundle/chai';
import { render } from '../../src/ui/view.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';

const today = '2026-05-23';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const noopHandlers = {
  onLog: () => {},
  onDelete: () => {},
  onQueryChange: () => {},
  onFoodSelect: () => {},
  onGramsChange: () => {},
};

describe('render', () => {
  let container: HTMLElement;
  beforeEach(() => { container = makeContainer(); });
  afterEach(() => container.remove());

  it('renders search input, grams input, and log button', () => {
    render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    expect(container.querySelector('[data-testid="search-input"]')).to.exist;
    expect(container.querySelector('[data-testid="grams-input"]')).to.exist;
    expect(container.querySelector('[data-testid="log-button"]')).to.exist;
  });

  it('shows seed foods in the food picker on first render', () => {
    render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const items = container.querySelectorAll('[data-testid="food-option"]');
    expect(items.length).to.equal(10);
    expect(items[0]!.textContent).to.contain('Oats');
  });

  it('filters food picker by query (case-insensitive substring)', () => {
    render(container, { state: freshState(), today, query: 'ban', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const items = container.querySelectorAll('[data-testid="food-option"]');
    expect(items.length).to.equal(1);
    expect(items[0]!.textContent).to.contain('Banana');
  });

  it('renders empty entry list initially', () => {
    render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(0);
  });

  it('renders entry rows with name, grams, integer-rounded kcal', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-banana', grams: 120, loggedAt: `${today}T10:00:00Z` },
        { id: 'e2', date: today, foodId: 'seed-oats',   grams: 50,  loggedAt: `${today}T11:00:00Z` },
      ],
    };
    render(container, { state, today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(2);
    expect(rows[0]!.textContent).to.contain('Banana');
    expect(rows[0]!.textContent).to.contain('120');
    expect(rows[0]!.textContent).to.contain('107');
    expect(rows[1]!.textContent).to.contain('Oats');
    expect(rows[1]!.textContent).to.contain('190');
  });

  it('renders totals row with integer-rounded kcal and P/C/F', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-banana', grams: 120, loggedAt: `${today}T10:00:00Z` },
      ],
    };
    render(container, { state, today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const totals = container.querySelector('[data-testid="totals-row"]');
    expect(totals).to.exist;
    expect(totals!.textContent).to.contain('107');
    expect(totals!.textContent!.toLowerCase()).to.contain('p');
    expect(totals!.textContent!.toLowerCase()).to.contain('c');
    expect(totals!.textContent!.toLowerCase()).to.contain('f');
  });

  it('only renders entries for today (date filter)', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'today',     date: today,        foodId: 'seed-banana', grams: 100, loggedAt: `${today}T10:00:00Z` },
        { id: 'yesterday', date: '2026-05-22', foodId: 'seed-oats',   grams: 50,  loggedAt: '2026-05-22T10:00:00Z' },
      ],
    };
    render(container, { state, today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const rows = container.querySelectorAll('[data-testid="entry-row"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.textContent).to.contain('Banana');
  });

  it('renders error message when error is set', () => {
    render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: 'Pick a food.' }, noopHandlers);
    const err = container.querySelector('[data-testid="error-message"]');
    expect(err).to.exist;
    expect(err!.textContent).to.contain('Pick a food.');
  });

  it('does not render error element when no error', () => {
    render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const err = container.querySelector('[data-testid="error-message"]');
    expect(err).to.equal(null);
  });

  it('selected food option is marked as selected', () => {
    render(container, { state: freshState(), today, query: '', selectedFoodId: 'seed-banana', gramsRaw: '', error: null }, noopHandlers);
    const selected = container.querySelector('[data-testid="food-option"][data-selected="true"]');
    expect(selected).to.exist;
    expect(selected!.textContent).to.contain('Banana');
  });

  it('preserves query and gramsRaw in inputs across renders', () => {
    render(container, { state: freshState(), today, query: 'oat', selectedFoodId: null, gramsRaw: '42', error: null }, noopHandlers);
    const searchInput = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    const gramsInput = container.querySelector('[data-testid="grams-input"]') as HTMLInputElement;
    expect(searchInput.value).to.equal('oat');
    expect(gramsInput.value).to.equal('42');
  });

  it('fires onLog with current form values when log button is clicked', () => {
    let called: { foodId: string; gramsRaw: string } | null = null;
    render(container, { state: freshState(), today, query: '', selectedFoodId: 'seed-banana', gramsRaw: '100', error: null }, {
      ...noopHandlers,
      onLog: (foodId, gramsRaw) => { called = { foodId, gramsRaw }; },
    });
    const btn = container.querySelector('[data-testid="log-button"]') as HTMLButtonElement;
    btn.click();
    expect(called).to.deep.equal({ foodId: 'seed-banana', gramsRaw: '100' });
  });

  it('fires onDelete with entry id when delete button is clicked', () => {
    const state: State = {
      ...freshState(),
      entries: [
        { id: 'e1', date: today, foodId: 'seed-banana', grams: 100, loggedAt: `${today}T10:00:00Z` },
      ],
    };
    let deletedId: string | null = null;
    render(container, { state, today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, {
      ...noopHandlers,
      onDelete: (id) => { deletedId = id; },
    });
    const btn = container.querySelector('[data-testid="delete-button"]') as HTMLButtonElement;
    btn.click();
    expect(deletedId).to.equal('e1');
  });

  it('fires onQueryChange when search input changes', () => {
    let last = '';
    render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, {
      ...noopHandlers,
      onQueryChange: (q) => { last = q; },
    });
    const input = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    input.value = 'banana';
    input.dispatchEvent(new Event('input'));
    expect(last).to.equal('banana');
  });

  it('fires onFoodSelect when a food option is clicked', () => {
    let id = '';
    render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, {
      ...noopHandlers,
      onFoodSelect: (foodId) => { id = foodId; },
    });
    const first = container.querySelector('[data-testid="food-option"]') as HTMLElement;
    first.click();
    expect(id).to.equal('seed-oats');
  });

  it('fires onFoodSelect on Enter or Space key when a food option is focused', () => {
    for (const key of ['Enter', ' ']) {
      let id = '';
      render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, {
        ...noopHandlers,
        onFoodSelect: (foodId) => { id = foodId; },
      });
      const first = container.querySelector('[data-testid="food-option"]') as HTMLElement;
      first.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      expect(id, `key=${JSON.stringify(key)}`).to.equal('seed-oats');
    }
  });

  it('fires onGramsChange when grams input changes', () => {
    let last = '';
    render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, {
      ...noopHandlers,
      onGramsChange: (g) => { last = g; },
    });
    const input = container.querySelector('[data-testid="grams-input"]') as HTMLInputElement;
    input.value = '50';
    input.dispatchEvent(new Event('input'));
    expect(last).to.equal('50');
  });

  it('replaces previous render output (no append)', () => {
    render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    render(container, { state: freshState(), today, query: '', selectedFoodId: null, gramsRaw: '', error: null }, noopHandlers);
    const buttons = container.querySelectorAll('[data-testid="log-button"]');
    expect(buttons.length).to.equal(1);
  });

  it('does not import persistence', async () => {
    const src = await fetch(new URL('../../src/ui/view.ts', import.meta.url)).then((r) => r.text());
    expect(src).to.not.match(/from\s+['"][^'"]*persistence/);
    expect(src).to.not.match(/localStorage/);
  });
});
