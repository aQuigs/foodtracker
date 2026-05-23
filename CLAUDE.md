# foodtracker

Browser-based food tracker. Static GH Pages site. No backend.

**Read first:** [specs/STATUS.md](./specs/STATUS.md), [specs/MILESTONES.md](./specs/MILESTONES.md). New agents: also [specs/agent-handoff.md](./specs/agent-handoff.md).

## Stack
- TypeScript (no framework)
- Vite (build + dev server)
- Web Test Runner + Playwright (Chromium), Mocha bdd + `@esm-bundle/chai`
- GH Pages + `rossjrw/pr-preview-action@v1`
- localStorage, single versioned blob under `foodtracker:v1`

## How we work
- One milestone at a time. **Pause for user review between milestones.**
- **Every change ships as a PR** so the user can preview the GH Pages deploy.
- **Every PR goes through adversarial-review + `/simplify` subagents before user sees it.** Both passes must come back **green** (no BLOCKER, no SHOULD-FIX) — iterate (address → re-review with a fresh subagent) until they do. Subagents are required (Agent tool, agent teams, or workflows); never self-review. See [ADR 0006](./specs/decisions/0006-pr-review-pipeline.md).
- Strict TDD (Red → Green → Refactor). See [ADR 0004](./specs/decisions/0004-strict-tdd.md).
- Update [specs/STATUS.md](./specs/STATUS.md) as you go.
- Load-bearing decisions → new ADR in `specs/decisions/`.
- Per-milestone specs in `specs/NNN-name/`.
- All docs about the app's plan/design/state live in `specs/`. Root holds only `CLAUDE.md`, `README.md`, `LICENSE`.

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
├── CLAUDE.md, README.md, LICENSE
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

### Writing for a contextless reader
PR descriptions, commit messages, docs, and code comments must make sense to someone who never saw this conversation. Cut anything that's only legible because you were here when it happened.

- **PR descriptions:** what shipped + why, plus a test plan. No "addressed findings from review", "BLOCKER #N", or session process notes.
- **Commit messages:** the change and the reason. Not the history of how we got there.
- **Code comments:** explain *why* a non-obvious choice exists, for a future maintainer modifying the code. Never reference the task, PR, prior versions, or "added for X". Self-evident code gets no comment.
- **STATUS.md:** current state only. No session activity log.
- **Specs/ADRs:** written for a fresh contributor, not as a real-time decision diary.

### Code
- Terse over verbose.
- TS strict mode. Avoid `any`.
- No backward-compat shims for unreleased internal code.
- Validators at boundaries (localStorage, future external APIs). Trust internal code.
- One render path: state change → save → re-render. No surgical DOM patching.
- **Brace `if` guards**, even short ones — no single-line `if (...) return x;`. Each guard gets `if (...) {\n  return x;\n}`.
- **Blank line after a guard**, and **between consecutive guards**, unless the next line is a closing brace `}`. Consecutive multi-line `if` blocks should be separated by a blank line — a wall of unspaced guards reads as one chunk.
- Be liberal with blank lines inside functions to separate logical chunks. Two unrelated 3-line operations are easier to read separated by a blank line.

### Git
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
- Put anything other than CLAUDE.md, README.md, LICENSE at repo root.
