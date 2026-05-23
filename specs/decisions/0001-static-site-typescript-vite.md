# 0001 — Static site on GitHub Pages with TypeScript + Vite

**Date:** 2026-05-23

## Context

We want a browser-based food tracker with auto-deploy on push to main and PR previews. User asked for TypeScript if feasible.

## Decision

- **Hosting:** GitHub Pages (free, fits the auto-deploy goal).
- **Language:** TypeScript (catches a class of bugs vanilla JS can't, e.g. accidentally storing wrong shape in localStorage).
- **Build tool:** Vite (`npm run build` → `dist/`).
- **Deploy:** GitHub Actions compiles in CI, publishes `dist/` to the `gh-pages` branch on merge. PR previews via `rossjrw/pr-preview-action@v1`, publishing `dist/` under `/pr-previews/<PR#>/`.

## Alternatives considered

- **Vanilla JS:** zero build step, simplest CI. Rejected because the user prefers TS and the type safety pays off as the food/entry schemas grow.
- **tsc-only (no bundler):** lighter than Vite, no HMR dev server. Rejected because the dev-server experience matters during iterative UI work, and Vite's config overhead is minimal.
- **A framework (React/Svelte/Vue):** rejected — none of M1–M3 needs one, and vanilla TS keeps the app small.

## Consequences

- CI must run `npm ci` + `npm run build` before deploying — adds ~15–20s per deploy.
- We have a `package.json` and `node_modules` to manage (Renovate / Dependabot later).
- Source lives in `src/`, GHP serves `dist/`. PR-preview action needs `source-dir: ./dist`.
- Type definitions for `localStorage` blobs are now load-bearing — we'll add a runtime validator (probably hand-rolled, not Zod, to keep deps minimal) at the storage boundary.
