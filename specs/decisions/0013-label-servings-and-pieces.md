# 0013 — Foods label their own serving, with an optional piece count for logging by count

**Date:** 2026-09-22

## Context

Foods have had their own `servingSize`/`servingUnit` since M4 — a food is entered and shown the way its label states it, not on some universal basis. Brand catalog rows were the exception: they still shipped nutrition per 100 g, so a drink label (296 ml, 169 cal per bottle) came in as an all-purpose "grams" number with no relation to the bottle, and a liquid could only be logged in g/oz/lb. And no food — brand or user-made — had any way to record a label's own piece count: a cookie ("8 cookies (30 g)") lost its count entirely, and nothing could be logged by count at all. USDA Branded Foods states a household serving on almost every row; discarding it meant users re-deriving grams from a label that already gave them the answer.

## Decision

1. **A food may carry `pieces: { perServing: number; noun?: string }`** alongside its serving — one serving is `perServing` discrete pieces, `noun` the label's own word for one (`'bottle'`, `'cookies'`) kept verbatim for display. Not allowed on a food whose `servingUnit` is already `count` — it has no separate piece size to record.
2. **`count` becomes a compatible unit wherever a food has pieces**, alongside its serving axis's own units (weight: g/oz/lb; volume: ml). `compatibleUnits(food)` returns that set; nothing else changes axis or unit compatibility. Converting into or out of `count` goes only through that food's own `pieces.perServing` — there is no general count↔weight or count↔volume conversion, and no new `Unit` value (`fl oz` stays out of scope).
3. **A food with pieces defaults to logging by count** (`defaultUnit(food)`), since that's the everyday quantity a label with pieces is meant to be logged in ("1 bottle", "8 cookies"), not a scale reading.
4. **The axis-change lock generalizes into one invariant: an edit can't newly strand a unit an entry or live recipe portion already uses.** A unit that was in the food's `compatibleUnits` and would drop out of it on the proposed edit refuses the edit; a unit already outside that set beforehand (an older build meeting one a newer build wrote, say) doesn't itself block further edits — only the edit that would be the direct cause of stranding it is refused. This covers both an axis flip and removing `pieces` while something still logs the food by count. Changing `pieces.perServing` itself stays allowed, same as any other nutrition/serving correction (ADR 0003) — it's a retroactive fix to the same countable thing, not a change of what unit is being logged in.
5. **One `servingText()` formatter renders a serving everywhere it's shown**: no pieces gives "296 ml" / "100 g"; pieces give "1 bottle · 296 ml" ("8 cookies · 30 g", or "8 count · 30 g" when the label had no noun); a count-unit food is unaffected.
6. **Users can give their own foods a count too** — the food form has an optional "Count per serving" field beside serving size/unit, blank meaning no pieces, disabled while the unit is already `count`.

## Alternatives considered

- **Keep the per-100 basis and add a piece weight on top** (e.g. "1 piece = 37 g" alongside calories per 100 g). Rejected: it re-derives the label's own serving instead of storing it, and a user re-entering a label's numbers has to compute a per-100 figure by hand — the problem ADR 0003's basis was meant to fix, not extend.
- **New `cup`/`fl oz` units on the volume axis**, so a drink converts through them like weight converts through g/oz/lb. Rejected: it solves only volume-labeled foods, not cookies, eggs, or anything else sold by the piece, and a general volume-unit system is its own scope, left for a later, separate change.
- **Put the noun on the unit button itself** (a "bottle" button next to g/oz/lb/ml, sized to the food). Rejected — a picker's geometry must not depend on which food is selected ([CLAUDE.md](../../CLAUDE.md)); the fixed `UNITS` set stays the same shape for every food, with `count` simply enabled or disabled, and the noun is carried in `servingText()` instead of the button label.

## Consequences

- A food added before this shipped keeps whatever serving it was added with until it's deleted and re-added from its source, picking up the source's current serving and pieces — nothing rewrites an existing `Food` in place.
- `Food.pieces` and `FoodUpdates.pieces` are additive on the v2 blob; an older build doesn't validate or use the field, but keeps it as-is when it merges an edit and re-saves the food, same as any other field it doesn't model (`brand`, `enabledSources`).
- `parseState` treats an entry or recipe portion in a unit it doesn't recognize (a value only a newer build knows) as one to drop, not one to reject the whole blob over — the live site and PR previews share one localStorage key, so an older build can meet a unit a newer one wrote. A row dropped this way is gone for good once this build saves next: a newer build's own unit, logged in a preview, doesn't survive a round trip through an older build.
- Import, which replaces the user's state outright rather than merging into it, refuses a backup that would drop an entry or recipe item this way instead of silently losing rows. A food's `pieces` being dropped (malformed, or stale on a food since switched to `servingUnit: 'count'`) doesn't count as a loss for this purpose — nothing the user tracks depends on it.
