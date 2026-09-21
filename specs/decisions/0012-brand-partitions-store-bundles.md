# 0012 — Brands are the catalog's partitions; stores are bundles of brands

**Date:** 2026-09-15

## Context

[ADR 0008](./0008-opt-in-source-packs.md) shipped store-brand packs as hand-picked sources: one dataset per chain, matched by brand owner or brand name, and tagged with the store's label. Users also want to look products up by the brand that made them (Chobani, Nature Valley, Kind). USDA Branded Foods has about 33,000 brand names, so a registry entry per brand is not an option.

The dump's own shape settles what a source should be. About 95% of a store pack is the store's house brands (Great Value, Kirkland Signature, Good & Gather), and each of those is itself a brand name in the dump. If brands became sources next to the store packs, every house-brand row would exist twice: once under the store and once under the brand, with different tags. The same product would show in two folds and could be added twice under two identities. The overlap users notice first, a Smucker's item registered by Costco, is the rare case. The house brands are the wholesale duplication.

Store pack names are cleaned mechanically and ship per 100 g; that trade stands.

## Decision

1. **A brand is the unit of partition.** Each brand is a source `brand:<id>` that the user turns on individually. `brands/index.json` lists every brand as `[id, label, row count, included]`. The rows sit in 27 letter files (`a`…`z`, `0-9`), one for each first character of a brand id. Each letter file maps brand id to `{ label, rows }`. `brandFileKey(id)` in `src/domain/dataFiles.ts` names the file. The build and the app share that function, so hydrating a brand needs no list lookup: it fetches the letter file and keeps only its brand's entry, or hydrates empty when the file has none. Each dump row lands in exactly one brand, so no two sources hold the same row. A brand ships rows only when it has at least two items or is a house brand. Every other brand is listed with its count and `included` false. A brand search still finds it and shows it disabled, with the note "not included (1 item)".
2. **A row carries its brand.** `SourcedFood.brand` and `Food.brand` hold the label the row was built under. The tag, the brand half of the search text and food identity all read that field. Nothing infers a brand from a source name, with one exception: a food saved from a store pack before rows carried a brand gets its store's label as its brand when the blob loads.
3. **A store is a bundle of its house brands' ids in the domain registry** (`STORE_BUNDLES`). The picker shows it as one checkbox, either on or off, with no partial state. `enabledSources` lists it by its own id (`costco`), the name its store pack had. `expandStores()` turns that id into brand sources only where search and hydration need concrete sources. A house brand is reached only through its store: it never appears under Brands, and a stored list that has one on by itself is rewritten to its store at parse.
4. **Within a brand, two rows are one item only when name and nutrition both match.** The build collapses those; a same-named row with different numbers ships as a second row. Catalog hiding keeps comparing name plus brand.
5. **The data is built, not committed.** CI builds `public/data/` on every deploy and PR preview from USDA releases pinned in `scripts/usda-releases.json`. `manifest.json` carries a `version`, a digest of the other files, and that one version stands for every source. The app fetches the manifest with `cache: 'no-cache'` on every boot and fetches every other file as `<file>?v=<version>`, so GitHub Pages' ten-minute cache never mixes files from two builds. A cached source whose version differs downloads again.

## Alternatives considered

- **Per-brand sources in the static registry, for a curated shortlist**, the ADR 0008 growth path. It works for twenty brands, fails the "any brand" requirement, and still duplicates house-brand rows against the store packs. Rejected.
- **Keep the store datasets and dedupe hits at search time by fdcId or by name + nutrition.** This is a rule layered on duplicated data: two cached copies of each row, a heuristic for which fold keeps the survivor, and a tag that reads ⟨Costco⟩ or ⟨Smucker's⟩ depending on what else is on. Rejected as the patch the structural fix replaces.
- **One `branded` source holding every row**: 20 MB gzipped on first enable, a 450k-row partition walked on every keystroke, and one version for everything. Rejected in ADR 0008 and still wrong.
- **One file per brand**: the simplest addressing, but ~20,000 files in every build and deploy. Rejected in favour of letter files.
- **Shards declared by the index**: ~1,100 files of ~100 KB, each brand's shard named in the index and each shard's hash pinned in the app. Shard sizes are even, but a brand's download had to wait for the ~1 MB index, and the pins tied each app build to one data build. Rejected in favour of letter files keyed by a function the build and the app share.
- **Commit the built data**: every file reviewable in the PR, and no build step. Rejected because each rebuild adds ~30 MB to git history; CI builds from pinned releases instead, and a PR preview still shows its own data.
- **Store as a shortcut that turns on its brands one by one**, with only the brands persisted and a store row that goes indeterminate once one of its brands is turned off. Rejected: two checkboxes reach one brand, and the old site reads its store pack by the store's id.
- **Attribute brand-less rows to their owner**, which keeps ~4% more rows under labels like "Kraft Heinz Foods Company". Rejected; those rows are dropped instead.

## Consequences

- `state.enabledSources` and `Food.brand` stay additive on the v2 blob. An older build sharing the localStorage blob keeps a store id meaning its store pack. It keeps `brand:<id>` names as unknown sources and re-saves them untouched.
- A food added from a store pack before this change keeps its store label as its brand, so its identity and tag are unchanged. The same product added again reads its real house brand. Only pre-existing user data sees the mix.
- Turning on a store now gives one fold per house brand instead of one fold per store, and the rows are tagged with the house brand. A store with no brand name in the dump has no rows: Trader Joe's loses its owner-only rows (~70 of 300).
- Turning on one brand downloads its whole letter file, which is 3 KB to 960 KB gzipped (`s.json` is the largest). The brands that hydrate together — boot's in one letter file, one pick's, one import's — download and parse each letter file once between them, so a store whose house brands share a letter requests it once. The parsed files are let go once those brands have hydrated; kept for the session, Safeway's alone would hold about 23 MB of heap.
- The brand list (~1.3 MB, 353 KB gzipped) is read only by the picker, the first time it opens in a session. A brand that is on hydrates without it. Its result fold and its download banner read the list's label once it is loaded, else the label its rows carry, else its id read as words. A store's house brands download behind one banner line, and fail on one, under the store's label. The manifest and the brand list are copied into IndexedDB beside the catalog. A brand-list copy at the manifest's version is used without a fetch, and an offline boot still searches what is cached. If neither the network nor a copy is available, nothing is hydrated and the catalog shows its failure state.
- The IndexedDB catalog (`foodtracker-catalog`) is a cache on an origin that PR previews share, so a database a newer build left at a higher schema is deleted and rebuilt, and an upgrade or delete another tab holds up fails at once rather than leaving the catalog waiting.
- Adding a store is a `STORE_BUNDLES` entry naming brand ids. Adding a brand needs nothing: a rebuild against a newer dump picks up whatever the dump has. The build fails when a house brand no longer exists in the dump.
- The offline shell ([ADR 0011](./0011-offline-app-shell.md)) still never caches `data/`; only the catalog repository caches rows.
- Supersedes decisions 3 and 5 of ADR 0008 (one dataset per pack; one partition per pack). Its decisions 1, 2 and 4 stand: the enabled set is user state, hydration and search are gated by it, and names are cleaned mechanically.
