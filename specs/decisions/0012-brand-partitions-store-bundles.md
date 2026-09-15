# 0012 — Brands are the catalog's partitions; stores are bundles of brands

**Date:** 2026-09-15

## Context

[ADR 0008](./0008-opt-in-source-packs.md) shipped store-brand packs as hand-picked sources: one dataset per chain, matched by brand owner or brand name, tagged with the store's label. Users also want to look products up by the brand that made them — Chobani, Nature Valley, Kind — and there are about 33,000 brand names in USDA Branded Foods, so a per-brand registry entry is not an option.

The dump's own shape settles what a source should be. Store packs are ~95% the store's house brands (Great Value, Kirkland Signature, Good & Gather), and each of those is itself a brand name in the dump. Add brands as sources next to store packs and every house-brand row exists twice: once under the store, once under the brand, with different tags, so the same product shows in two folds and can be added twice under two identities. The overlap the user notices first — a Smucker's item registered by Costco — is the rare case; the wholesale duplication is the house brands.

Store pack names are cleaned mechanically and ship per 100 g; that trade stands.

## Decision

1. **A brand is the unit of partition.** One dataset, `brands`, holds every brand with a brand name in the dump: an index (`id`, label, row count, shard) and ~1,100 shards of ~100 KB. Each brand is a source `brand:<id>` that the user turns on individually; hydration fetches its shard and keeps only its rows. A dump row lands in exactly one brand, so no two sources can hold the same row.
2. **A row carries its brand.** `SourcedFood.brand` and `Food.brand` hold the label the row was built under. The tag, the brand half of search text and food identity read that field; nothing infers a brand from a source name.
3. **A store is a bundle of brand ids in the domain registry**, shown as one checkbox that is on when all its brands are on. Nothing about a bundle is persisted; `enabledSources` lists brands. A legacy store name in a stored blob expands to its bundle at parse.
4. **Within a brand, two rows are one item only when name and nutrition both match.** The build collapses those; a same-named row with different numbers ships as a second row. Catalog hiding keeps comparing name plus brand.
5. **The whole dataset is committed**, as before: ~110 MB of JSON across ~1,100 files, which git stores as ~30 MB per release.

## Alternatives considered

- **Per-brand sources in the static registry, for a curated shortlist** — the ADR 0008 growth path. Works for twenty brands, fails the "any brand" requirement, and still duplicates house-brand rows against the store packs. Rejected.
- **Keep store datasets and dedupe hits at search time by fdcId or by name + nutrition** — a rule on top of duplicated data: two cached copies per row, a fold-placement heuristic for the survivor, and a tag that reads ⟨Costco⟩ or ⟨Smucker's⟩ depending on what else is on. Rejected as the patch the structural fix replaces.
- **One `branded` source holding every row** — 20 MB gzipped on first enable, a 450k-row partition walked per keystroke, and one version pin for everything; rejected in ADR 0008 and still wrong.
- **One file per brand** — the simplest layout, but 33,000 files in `public/`, in git and in every Vite build. A minimum row count would trim it to a few thousand at the cost of the long tail the user asked for. Rejected for index-declared shards, which cap the file count and keep every brand.
- **Hash-addressed shards** — no index lookup, but a hash function baked into the app and uneven shard sizes. Rejected: the index has to exist for labels anyway, so it declares the shard too.
- **A separate data repository or CI-built datasets** — keeps the app repo small, but breaks the committed-dataset test and the "preview a PR with its data" flow. Not needed at ~20 MB of git per release; revisit if rebuilds become frequent.
- **Attribute brand-less rows to their owner** — keeps ~4% more rows under labels like "Kraft Heinz Foods Company". Rejected; dropped instead.

## Consequences

- `state.enabledSources` and `Food.brand` stay additive on the v2 blob: an older build sharing the localStorage blob ignores both. The old site keeps a legacy store name on; this build expands it.
- A food added from a store pack before this change keeps its store label as its brand (identity and tag unchanged); the same product added again reads its real house brand. Only pre-existing user data sees the mix.
- Turning on a store now gives one fold per house brand instead of one fold per store, and its rows are tagged with the house brand. A store with no brand name in the dump has no rows: Trader Joe's loses its owner-only rows (~70 of 300).
- The index (~1 MB) is fetched, revalidated against the server, the first time a session needs it — the picker opening, or a boot with a brand on — so a dataset rebuilt at the same version is never read through a stale copy; the copy kept in IndexedDB beside the catalog is what an offline boot falls back to, so labels still resolve.
- Adding a store is a `STORE_BUNDLES` entry naming brand ids; adding a brand is nothing — a rebuild against a newer dump picks up whatever the dump has.
- The offline shell ([ADR 0011](./0011-offline-app-shell.md)) still never caches `data/`; shards are cached by the catalog repository only.
- Supersedes ADR 0008's decisions 3 and 5 (one dataset per pack; per-pack partitions). Its decisions 1, 2 and 4 stand: the enabled set is user state, hydration and search are gated by it, and names are cleaned mechanically.
