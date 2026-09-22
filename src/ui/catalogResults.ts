import type { SourcedFood } from '../domain/types.js';
import { isCurated } from '../domain/foodSources.js';
import { byRank, type FoodMatch } from './search.js';

// One catalog result set, already ranked: `rows` is every enabled source's
// hits as the one list the Catalog tab renders. `alreadyAdded` counts
// matches hidden because a live user food has the same id or name; it still
// decides the empty-result hint. `query` is the search key the rows
// answer — the input may already hold newer text, and two spellings with one
// key share a result set.
export type CatalogHits = {
  query: string;
  rows: FoodMatch<SourcedFood>[];
  alreadyAdded: number;
};

// A curated (everyday) row wins a tie over any other source.
function tieBreaker(a: SourcedFood, b: SourcedFood): number {
  return (isCurated(a.source) ? 0 : 1) - (isCurated(b.source) ? 0 : 1)
    || a.name.length - b.name.length || a.name.localeCompare(b.name);
}

// Match rank first, then the tiebreaker above. The one order every catalog
// surface renders in, computed once where a search resolves.
export const compareCatalogRank = byRank<SourcedFood>(tieBreaker);
