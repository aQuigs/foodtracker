# 0008 — Opt-in source packs; the enabled set is user state

**Date:** 2026-09-03

## Context

[ADR 0007](./0007-multi-source-food-library.md) made the set of food sources a build-time decision and rejected a "switch source" UI because every user wanted the same two USDA tiers. Store-brand catalogs break that assumption: USDA Branded Foods carries tens of thousands of house-brand rows across a dozen chains, and a given user shops at one or two of them. Downloading every chain on first launch would cost each fresh user roughly 1 MB gzipped and 35k IndexedDB rows, and every keystroke in the Catalog tab would walk rows the user will never add.

The names in that data are label text ("KROGER, CHEESE PIZZA, CHEESE, CHEESE"), far from the hand-written names of the curated tier, and at 47k rows per-row judgment — the approach that produced `food-classifications.json` — does not scale.

## Decision

1. **Available sources stay a build-time registry; the enabled subset is user state.** `FOOD_SOURCE_META` lists every source the build ships with its label, tier, pinned version and default. `state.enabledSources` in the localStorage blob records which of them the user has turned on. Packs default off; the USDA tiers default on.
2. **Hydration and search are gated by the enabled set.** Boot fetches only enabled sources. Turning a source on hydrates it at once; turning it off just drops it from search, leaving the IndexedDB partition as a cache for the next time.
3. **One dataset per pack**, built from the USDA Branded dump by `scripts/build-food-source.ts packs`, matched by folded brand-owner and brand-name strings in `scripts/brand-packs.json`. Each pack is its own `FoodSource`, so it pins its own version and re-hydrates independently.
4. **Pack names are cleaned mechanically, not curated.** Brand phrases are stripped, comma-repeated segments dropped, sentence case applied, duplicates collapsed to the latest publication. The result reads like a label, not like the curated tier; that is the accepted trade for shipping thousands of rows per chain.
5. **The repository walks only the requested partitions.** `search(q, { sources })` iterates the `by-source` index per listed source rather than the whole name index, so the cost of a keystroke follows what is enabled, not what is cached.

## Alternatives considered

- **Hydrate every source, filter in the UI** — simplest wiring, but fresh-user bandwidth, IndexedDB size and per-keystroke cost all scale with the number of packs shipped, which is meant to grow. Rejected.
- **One `branded` source with a brand tag, filtered by tag** — cannot be lazily downloaded per chain, and one version pin means a change to any chain re-downloads all of them. Rejected.
- **Enabled set in IndexedDB beside the catalog** — puts user-written state in the cache store, contradicting [ADR 0007](./0007-multi-source-food-library.md)'s split. Rejected.
- **Keep sources always-on and add packs only as a separate picker** — two rules for one concept; a uniform enabled set lets the USDA tiers be turned off too. Rejected.
- **Per-row judgment file for pack names** — the `usda-full` approach; 47k rows and a growing dump make it a multi-day chore per rebuild. Rejected in favour of mechanical clean-up.
- **Fetch packs from the USDA API at enable time** — always fresh, but needs a committed API key, rate limits, and per-search latency. Saved as a future provider, as in [ADR 0007](./0007-multi-source-food-library.md).

## Consequences

- **No blob version bump.** `enabledSources` is additive with a default, so the blob stays `version: 2`: a pre-M12 blob or backup loads with the defaults, and a blob written by this version still loads on the deployed site (whose parser ignores the field). That matters because PR previews share the live site's origin and therefore its localStorage key; a bump would make the live parser reject the preview's blob and reset the user's log. Bump the version only for a change the old parser cannot accept.
- A user who disables a pack keeps its partition on disk until a schema bump drops the cache; nothing evicts it.
- Adding a pack is one `FOOD_SOURCE_META` entry, one `brand-packs.json` entry, and one build run — no UI change. The compiler refuses a source missing from the registry.
- Pack quality is mechanical: names can be awkward, nutrition is per 100 g even for items sold by the piece, and millilitre rows are counted as grams. Improving any of that is a build-script change, not an app change.
- **A pack row is identified by name plus brand.** Rows from a store pack carry a brand tag wherever they appear and the brand joins their search text, so the unique-live-food rule compares name plus brand: two packs' "Almonds" coexist, each tagged, while an untagged user food and an untagged USDA food with the same name still collide.
- The picker lists whatever `main.ts` wires; with fourteen sources the fuzzy filter earns its place, and it keeps working as packs grow.
