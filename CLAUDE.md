# foodtracker

Browser food tracker. Static GH Pages site. No backend. No cloud sync until every planned milestone ships.

- [specs/agent-handoff.md](./specs/agent-handoff.md): architecture and food sources.
- Rest of `specs/`: closed record, not a process.
- This file: the source of truth for how to work.

## Stack
- TypeScript, Vite. Never add a framework (React, Svelte, Vue).
- Web Test Runner + Playwright (Chromium), Mocha bdd, `@esm-bundle/chai`. Don't swap the runner.
- PR previews: `rossjrw/pr-preview-action@v1`.
- User state: one versioned localStorage blob, key `foodtracker`. Nothing else.
- IndexedDB `foodtracker-catalog`: cache for the read-only food catalog and brand list only ([ADR 0007](./specs/decisions/0007-multi-source-food-library.md)).
- PWA: manifest and icons in `public/`. Hand-written service worker: precaches each build's app shell, fetches pages network-first, never caches `data/` ([ADR 0011](./specs/decisions/0011-offline-app-shell.md)).

## How we work
- **Every change ships as a PR** for the user to preview.
- **Before the user sees a PR:** adversarial-review and `/simplify` subagent passes, per [ADR 0006](./specs/decisions/0006-pr-review-pipeline.md): re-review until green, decide every CONSIDER/NIT, label severity.
- **Strict TDD:** start every change with a failing test ([ADR 0004](./specs/decisions/0004-strict-tdd.md)).
- **No new specs:** no ADRs, milestone specs, plans, or `MILESTONES`/`STATUS`/`decisions/README` entries. No exception for structural changes or for shipping them with the implementation.
  - Decisions go in the PR's *Decisions made* section and in WHY comments.
  - Other docs (README, `agent-handoff.md`): allowed when they help someone use or work on the app.
  - Root docs: `CLAUDE.md`, `README.md`, `LICENSE` only.
- **Two patches in one place:** don't write a third. State the invariant; redesign so the structure enforces it.
- **UI changes:** retake screenshots at the affected viewports and read them before reporting done. A passing test doesn't prove it. If you can't check, say so.

## Architecture ([ADR 0005](./specs/decisions/0005-layered-architecture.md))

Dependencies flow down only:

```
ui  →  domain  ←  persistence
        ↑
       app (wiring)
```

- `src/domain/`: pure types, reducers, calculations. No DOM, storage or globals.
- `src/persistence/`: storage adapters behind an interface (`LocalStorageRepository`; `InMemoryRepository` for tests).
- `src/ui/`: DOM and events. Imports domain types only, never persistence.
- `src/app.ts`: the only place that wires all three.
- `src/sw/`: service worker. Own tsconfig (WebWorker lib). Imports nothing from the app.

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
npm run build-data   # food data → public/data/; without it the app has no foods
npm run dev          # localhost:5173
npm run build        # → dist/
npm test
npm run test:watch
```

## Conventions

### Writing
Readable by someone who wasn't there. Direct, literal, no filler qualifiers.
- **PRs:** what shipped, why, test plan. Visible change: before/after screenshots at the affected viewports (`npm run screenshots`). No session or review-process notes ("addressed findings", "BLOCKER #N").
- **Commits:** the change and the reason. Not the history.
- **Comments:** only *why* a non-obvious choice exists. Never mention the task, PR or earlier versions.

### Code
- Terse. TS strict. Avoid `any`.
- No backward-compat shims for unreleased internal code.
- Validate at boundaries (localStorage, external APIs). Trust internal code.
- One render path: state change → save → re-render.
- Brace every `if` guard, including one-liners.
- Blank line after a guard, between consecutive `if` blocks, and between a function's logical chunks. Not before `}`. When unsure, add one.
- **One concrete struct per concept. No raw string literals at call sites.** `NutritionFacts { calories; protein; carbs; fat }`, never `'protein' | 'carbs' | 'fat'`.
  - Subsets: one `Record<keyof Struct, Kind>` map beside the struct, plus a helper (`macros(n)`). The `Record` makes the compiler reject an unclassified new field.
  - Validators, calc and render iterate `Object.keys(MAP)` / `Object.entries(helper(n))`. Never field-name literals.
  - Adding a field: one line on the struct, one in the map, one value per seed or instance.

### UI and CSS
- **One CSS property per state:** active → background, hover → `filter`, disabled → `opacity`, focus → outline. Never let two states share a property.
- **A component's geometry never depends on its data.** Selected item or allowed count must not change its size: render every option, disable the disallowed ones.
- **No descendant overrides** (`.parent-row .component { width: ... }`). A parent that needs different behavior passes a prop.
- **Same affordance on two surfaces: one `createX()` factory** returning `{ node, render }`, not a shared CSS class.
- **No magic min-widths or breakpoints** for one layout case. Fix the data-dependent geometry or override behind it.

### Git
- No `Co-Authored-By` in commits.
- PR templates: don't delete items; check or uncheck them.
