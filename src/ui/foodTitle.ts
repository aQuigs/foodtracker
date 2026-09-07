import { searchText, sourceBrand } from '../domain/foodSources.js';
import { renderHighlighted } from './highlight.js';
import type { Range } from './ranges.js';
import { el } from './dom.js';

// The accessible name for a food — the same text foodTitle renders, so two
// same-named packs' Delete/Edit/Add buttons and detail regions still read
// apart from each other and from assistive tech.
export function foodLabel(food: { name: string; source?: string }): string {
  return searchText(food.name, food.source);
}

// The one place a food's name is turned into DOM: the highlighted name, plus
// a brand tag (also highlighted) when the food came from a store pack. Used
// everywhere a food name renders from a search match — catalog results, the
// Foods list, the Log picker and the recipe editor's food picker — so none
// of them drift apart. A standalone module (not part of view.ts) so the
// recipe editor and card can use it without importing the view layer.
export function foodTitle(
  food: { name: string; source?: string },
  indices: ReadonlyArray<Range>,
  brandIndices: ReadonlyArray<Range>,
): (string | HTMLElement)[] {
  const out = renderHighlighted(food.name, indices);
  const brand = sourceBrand(food.source);

  if (brand !== null) {
    // A plain space text node, not just the tag's own padding, so the row
    // reads as "Almonds Costco" to assistive tech instead of "AlmondsCostco".
    out.push(' ', el('span', { class: 'source-tag', 'data-testid': 'source-tag' }, renderHighlighted(brand, brandIndices)));
  }

  return out;
}
