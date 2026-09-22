# foodtracker

Browser-based food tracker. Static GH Pages site, no backend. No cloud sync until every planned milestone ships.

[specs/agent-handoff.md](./specs/agent-handoff.md) explains the architecture and food sources. The rest of `specs/` is a closed record, not a process to follow; this file is the source of truth for how to work.

## Stack
- TypeScript and Vite. Never add a framework (React, Svelte, Vue).
- Web Test Runner + Playwright (Chromium), Mocha bdd, `@esm-bundle/chai`. Don't swap the runner.
- PR previews from `rossjrw/pr-preview-action@v1`.
- Everything the user writes lives in one versioned localStorage blob (`foodtracker` key). IndexedDB (`foodtracker-catalog`) only caches the read-only food catalog and brand list ([ADR 0007](./specs/decisions/0007-multi-source-food-library.md)).
- PWA: manifest and icons in `public/`. A hand-written service worker precaches each build's app shell, fetches pages network-first, and never caches `data/` ([ADR 0011](./specs/decisions/0011-offline-app-shell.md)).

## How we work
- **Every change ships as a PR** the user can preview, after adversarial-review and `/simplify` subagent passes. Run them as [ADR 0006](./specs/decisions/0006-pr-review-pipeline.md) says: re-review until green, decide every CONSIDER/NIT, label severity.
- Strict TDD: no work starts without a failing test ([ADR 0004](./specs/decisions/0004-strict-tdd.md)).
- **No new specs:** no ADRs, milestone specs, plans, or `MILESTONES`/`STATUS`/`decisions/README` entries, not for a structural change and not alongside the implementation. Decisions go in the PR's *Decisions made* section and in WHY comments. Other docs (README, `agent-handoff.md`) are fine when they help someone use or work on the app. The only docs at the root are `CLAUDE.md`, `README.md` and `LICENSE`.
- **Two patches in one place ⇒ reframe.** Don't write a third: state the invariant and redesign so the structure enforces it.
- **A passing test isn't a working feature.** For a UI change, retake screenshots at the affected viewports and read them before reporting done. If you can't, say so.

## Architecture ([ADR 0005](./specs/decisions/0005-layered-architecture.md))

Dependencies flow down only:

```
ui  →  domain  ←  persistence
        ↑
       app (wiring)
```

- **`src/domain/`**: pure types, reducers, calculations. No DOM, storage or globals.
- **`src/persistence/`**: storage adapters behind an interface (`LocalStorageRepository`; `InMemoryRepository` for tests).
- **`src/ui/`**: DOM and events. Imports domain types only, never persistence.
- **`src/app.ts`**: the only place that wires all three.
- **`src/sw/`**: the service worker. Own tsconfig (WebWorker lib); imports nothing from the app.

## Target layout

```
/
├── CLAUDE.md, README.md, LICENSE
├── index.html              # Vite entry
├── src/                    # see Architecture
├── tests/                  # *.test.ts, by layer
├── specs/                  # agent-handoff, MILESTONES, NNN-milestone/, decisions/
├── .github/workflows/      # test, deploy-main, pr-preview
├── vite.config.ts, web-test-runner.config.js, tsconfig.json, package.json
```

## Commands

```bash
npm install && npx playwright install chromium
npm run build-data   # food data → public/data/; the app has no foods without it
npm run dev          # localhost:5173
npm run build        # → dist/
npm test
npm run test:watch
```

## Conventions

### Writing
PR descriptions, commits, docs and comments must make sense to someone who wasn't there.
- **PRs:** what shipped and why, a test plan, and before/after screenshots at the affected viewports (`npm run screenshots`) for a visible change. No session or review-process notes ("addressed findings", "BLOCKER #N").
- **Commits:** the change and the reason, not the history.
- **Comments:** only *why* a non-obvious choice exists. Never mention the task, PR or earlier versions.

### Code
- Terse. TS strict; avoid `any`.
- No backward-compat shims for unreleased internal code.
- Validate at boundaries (localStorage, external APIs); trust internal code.
- One render path: state change → save → re-render.
- Brace every `if` guard, even one-liners.
- Use blank lines liberally: after a guard, between consecutive `if` blocks, and between a function's logical chunks, unless the next line is `}`.
- **One concrete struct per concept; no raw string literals at call sites.** Use `NutritionFacts { calories; protein; carbs; fat }`, never a string union like `'protein' | 'carbs' | 'fat'`.
  - Classify a subset once, in a `Record<keyof Struct, Kind>` map beside the struct, with a helper (`macros(n)`). The `Record` makes the compiler reject a new field until it's classified.
  - Validators, calc and render code iterate `Object.keys(MAP)` / `Object.entries(helper(n))`, never field-name literals.
  - Adding a field is then one line on the struct, one in the map, and one value per seed or instance.

### UI and CSS
- **Each state owns its own CSS property:** active → background, hover → `filter`, disabled → `opacity`, focus → outline. Never let two states share one; that's how hover paints over active.
- **A component's geometry never depends on its data.** If the selected item or the number of allowed items would change its size, render the same shape in every state instead (e.g. show every option and disable the ones not allowed).
- **No descendant overrides** like `.parent-row .component { width: ... }`. A parent that needs something different passes the component a prop.
- **The same affordance on two surfaces shares a `createX()` factory** returning `{ node, render }`, not just a CSS class, so DOM, handlers and state machine can't drift apart.
- **No magic min-widths or breakpoints for one layout case.** Fix the data-dependent geometry or override causing it.

### Git
- No `Co-Authored-By` in commits.
- Don't delete PR-template items; check or uncheck them.
