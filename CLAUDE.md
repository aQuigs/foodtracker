# foodtracker

Browser-based food tracker. Static GH Pages site. No backend.

**Read first:** [STATUS](./STATUS.md), [MILESTONES](./specs/MILESTONES.md). New agents: also [specs/agent-handoff.md](./specs/agent-handoff.md).

## Stack
- TypeScript (no framework)
- Vite (build + dev server)
- Web Test Runner + Playwright (Chromium), Mocha bdd + `@esm-bundle/chai`
- GH Pages + `rossjrw/pr-preview-action@v1`
- localStorage, single versioned blob under `foodtracker:v1`

## How we work
- One milestone at a time. **Pause for user review between milestones.**
- **Every change ships as a PR** so the user can preview the GH Pages deploy.
- **Every PR goes through adversarial-review + `/simplify` subagents before user sees it.** See [ADR 0006](./specs/decisions/0006-pr-review-pipeline.md).
- Strict TDD (Red → Green → Refactor). See [ADR 0004](./specs/decisions/0004-strict-tdd.md).
- Update [STATUS](./STATUS.md) as you go.
- Load-bearing decisions → new ADR in `specs/decisions/`.
- Per-milestone specs in `specs/NNN-name/`.
- All docs about the app's plan/design/state live in `specs/` (except this file and STATUS).

## Architecture — layered & decoupled ([ADR 0005](./specs/decisions/0005-layered-architecture.md))

Dependencies flow **down only**:

```
ui  →  domain  ←  persistence
        ↑
       app (wiring)
```

- **`src/domain/`** — pure types, reducers, calculations. No DOM, no storage, no globals.
- **`src/persistence/`** — storage adapters behind an interface. `LocalStorageRepository`, `InMemoryRepository` (for tests).
- **`src/ui/`** — DOM + events. Imports domain types only. **Never** imports persistence.
- **`src/app.ts`** — the only place that wires all three.

## Target layout

```
/
├── CLAUDE.md, STATUS.md, README.md
├── index.html              # Vite entry
├── src/
│   ├── app.ts              # composition root
│   ├── domain/             # pure: types, reducers, calc
│   ├── persistence/        # storage adapters
│   └── ui/                 # DOM, events
├── tests/                  # *.test.ts, organized by layer
├── specs/                  # MILESTONES, NNN-milestone/, decisions/, agent-handoff, CLAUDE.md
├── .github/workflows/      # test, deploy-main, pr-preview
├── vite.config.ts, web-test-runner.config.js, tsconfig.json, package.json
```

## Commands (once M0 lands)

```bash
npm install && npx playwright install chromium
npm run dev          # localhost:5173
npm run build        # → dist/
npm test
npm run test:watch
```

## Conventions
- Terse over verbose (user preference).
- Comments: *why*, never *what*. Self-evident code gets none.
- TS strict mode. Avoid `any`.
- No backward-compat shims for unreleased internal code.
- Validators at boundaries (localStorage, future external APIs). Trust internal code.
- One render path: state change → save → re-render. No surgical DOM patching.
- Commits: no `Co-Authored-By`.
- PR templates: don't delete items, just check/uncheck.

## Don't
- Cross layers the wrong way (e.g. UI importing persistence, domain importing DOM).
- Add React/Svelte/Vue.
- Add IndexedDB until food DB > ~1000 entries.
- Swap test runner.
- Add cloud sync before all currently-planned milestones ship.
- Start work without a failing test.
- Run past a milestone boundary without user review.
- Merge to main without going through a PR (so the user can preview).
- Put plan/design docs anywhere outside `specs/`.
