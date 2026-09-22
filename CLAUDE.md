# foodtracker

Browser-based food tracker. Static GH Pages site. No backend.

**Orientation:** [specs/agent-handoff.md](./specs/agent-handoff.md) explains the architecture and the food-sources system. The rest of `specs/` (milestone specs, ADRs) is a closed record of past decisions, not a process. This file is the source of truth for how to work.

## Stack
- TypeScript (no framework)
- Vite (build + dev server)
- Web Test Runner + Playwright (Chromium), Mocha bdd + `@esm-bundle/chai`
- GH Pages + `rossjrw/pr-preview-action@v1`
- User state: one versioned localStorage blob under the `foodtracker` key. IndexedDB (`foodtracker-catalog`) only caches the read-only food catalog ([ADR 0007](./specs/decisions/0007-multi-source-food-library.md)).
- PWA: web manifest and icons in `public/`. A hand-written service worker precaches the app shell for each build, fetches pages network-first, and never caches `data/` ([ADR 0011](./specs/decisions/0011-offline-app-shell.md)).

## How we work
- **Every change ships as a PR** so the user can preview the GH Pages deploy.
- **Every PR gets adversarial-review and `/simplify` subagent passes before the user sees it.** [ADR 0006](./specs/decisions/0006-pr-review-pipeline.md) has the full pipeline (green gate, CONSIDER/NIT decisions, severity labels).
- Strict TDD (Red → Green → Refactor). See [ADR 0004](./specs/decisions/0004-strict-tdd.md).
- **No new specs.** Never add an ADR, milestone spec, plan, or a `MILESTONES`/`STATUS`/`decisions/README` entry — not for a structural change, not alongside the implementation. A change's decisions go in its PR's *Decisions made* section and in WHY comments. Other docs (README, `agent-handoff.md`) are fine when they help someone use or work on the app.
- **Two patches in the same place ⇒ stop and reframe.** If you've patched the same component or rule twice and a third bug shows up nearby, don't write a third patch. State the invariant the component should hold, then redesign it so the structure enforces that invariant. Bugs cluster because the shape is wrong, not by chance.
- **A passing test is not a passing feature.** For any UI change, retake screenshots at the affected viewports and read the PNGs before reporting done. If a test passes but you can't check how it looks, say so; don't claim success.

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
│   ├── ui/                 # DOM, events
│   └── sw/                 # service worker: offline shell, own tsconfig (WebWorker lib), imports nothing from the app
├── tests/                  # *.test.ts, organized by layer
├── specs/                  # agent-handoff + closed record: MILESTONES, NNN-milestone/, decisions/
├── .github/workflows/      # test, deploy-main, pr-preview
├── vite.config.ts, web-test-runner.config.js, tsconfig.json, package.json
```

## Commands

```bash
npm install && npx playwright install chromium
npm run dev          # localhost:5173
npm run build        # → dist/
npm test
npm run test:watch
```

## Conventions

### Writing for a contextless reader
PR descriptions, commit messages, docs, and code comments must make sense to someone who never saw this conversation. Cut anything that only makes sense if you were there.

- **PR descriptions:** what shipped and why, plus a test plan. For any visible change, include before/after screenshots at the affected viewports (`npm run screenshots`). No "addressed findings from review", "BLOCKER #N", or other process notes.
- **Commit messages:** the change and the reason, not how we got there.
- **Code comments:** explain *why* a non-obvious choice was made, for whoever changes the code next. Never mention the task, the PR, earlier versions, or "added for X". Obvious code gets no comment.

### Code
- Terse over verbose.
- TS strict mode. Avoid `any`.
- No backward-compat shims for unreleased internal code.
- Validators at boundaries (localStorage, future external APIs). Trust internal code.
- One render path: state change → save → re-render. No surgical DOM patching.
- **Brace `if` guards**, even short ones — no single-line `if (...) return x;`. Each guard gets `if (...) {\n  return x;\n}`.
- **Blank line after a guard**, and **between consecutive guards**, unless the next line is a closing `}`. A wall of guards with no blank lines reads as one chunk.
- Use blank lines freely inside functions to separate logical chunks, e.g. between two unrelated 3-line steps.
- **One concrete struct per concept; no raw string literals at call sites.**
  - Group a concept's fields into a named struct (e.g. `NutritionFacts { calories; protein; carbs; fat }`). Never type domain concepts as raw string unions (`type Macro = 'protein' | 'carbs' | 'fat'`).
  - For subsets ("the macros"), classify once in a `Record<keyof Struct, Kind>` map beside the struct and expose a helper (`macros(n)`). The `Record` shape forces the compiler to reject any new field until it's classified.
  - Validators, calc, and render code iterate `Object.keys(MAP)` / `Object.entries(helper(n))` — never list field names by hand.
  - Adding a field takes one line on the struct, one line in the classification map, and one value per seed/instance, with no edits to validator, render, or calc code.

### UI components & CSS
- **Orthogonal channels for state.** Each interactive state (hover, active, focus, disabled) changes its own CSS property. Active owns background; hover owns `filter`; disabled owns `opacity`; focus owns outline. Never let two states set the same property — that's how hover paints over active.
- **A component's geometry must not depend on its data.** If the selected item or the number of allowed items changes a component's size, the parent layout shifts and its siblings move. Render the same shape in every state (e.g. always show every option and disable the ones not allowed), so the component always takes the same box.
- **No descendant overrides reaching into a component.** A rule like `.parent-row .component { width: ... }` means the component doesn't own its layout. Style a component only by its own class. If a parent needs different behavior, give the component a prop instead of overriding it from outside.
- **Two surfaces with the same affordance share a factory, not just a CSS class.** A shared class lets the DOM and behavior drift apart. A shared `createX()` factory returning `{ node, render }` keeps the DOM, handlers, and state machine the same everywhere it's mounted.
- **No magic min-widths or breakpoints to "fix" one layout case.** They are symptoms of data-dependent geometry or descendant overrides. Fix the structural cause instead.

### Git
- Commits: no `Co-Authored-By`.
- PR templates: don't delete items, just check/uncheck.

## Don't
- Cross layers the wrong way (e.g. UI importing persistence, domain importing DOM).
- Add React/Svelte/Vue.
- Put user state in IndexedDB. It holds only the read-only food catalog and its brand list; everything the user writes stays in the localStorage blob.
- Swap the test runner.
- Add cloud sync before all planned milestones ship.
- Start work without a failing test.
- Merge to main without a PR (the user needs the preview).
- Write specs — ADRs, milestone specs, plans — anywhere, `specs/` included.
- Put anything other than CLAUDE.md, README.md, LICENSE at repo root.
