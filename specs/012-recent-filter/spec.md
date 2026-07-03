# M12 — Filter picker to recent foods only (SUPERSEDED)

**Superseded by the curated-foods rework** — see [011-external-food-db/spec.md](../011-external-food-db/spec.md).

This milestone proposed a **"My foods only"** checkbox so the log-view picker could skip the noisy USDA catalog. That was a patch over a deeper problem: the picker merged the catalog into everyday logging in the first place.

The rework removes the need for a toggle:

- The log-view picker now searches **only** the user's own foods by default — there is nothing to filter out.
- The external catalog is a separate search in its own **Catalog tab**; adding a result imports a copy into the user's foods.
- Search everywhere is ranked by match tier (exact → prefix → word-start → substring → fuzzy), so a common lookup like "apple" surfaces the obvious result instead of fuzzy noise.

No checkbox, no recent-only mode — the default behaviour is what M12 was trying to reach.
