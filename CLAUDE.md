# foodtracker

Browser-based food tracker. Static GH Pages site. No backend.

**Orientation:** [specs/agent-handoff.md](./specs/agent-handoff.md) covers the architecture and the food-sources system. The rest of `specs/` (milestone specs, ADRs) is reference for why things are the way they are, not a process to follow — this file is the source of truth for how to work.

## Stack
- TypeScript (no framework)
- Vite (build + dev server)
- Web Test Runner + Playwright (Chromium), Mocha bdd + `@esm-bundle/chai`
- GH Pages + `rossjrw/pr-preview-action@v1`
- localStorage, single versioned blob under the `foodtracker` key for user state; IndexedDB (`foodtracker-foods`) only as a cache for the read-only food catalog ([ADR 0007](./specs/decisions/0007-multi-source-food-library.md))

## How we work
- **Every change ships as a PR** so the user can preview the GH Pages deploy.
- **Every PR goes through adversarial-review + `/simplify` subagent passes before user sees it.** See [ADR 0006](./specs/decisions/0006-pr-review-pipeline.md) for the full pipeline (green-gate, CONSIDER/NIT decisions, severity labels).
- Strict TDD (Red → Green → Refactor). See [ADR 0004](./specs/decisions/0004-strict-tdd.md).
- All docs about the app's plan/design/state live in `specs/`. Root holds only `CLAUDE.md`, `README.md`, `LICENSE`.
- **Two patches in the same place ⇒ stop and reframe.** If you've patched the same component or rule twice and a third bug is appearing nearby, do not write a third patch. State the invariant the component should hold, then redesign so that invariant is structural. Symptoms cluster because the shape is wrong, not because each symptom is independent.
- **A passing test is not a passing feature.** For any UI change, re-screenshot at the affected viewports and read the PNGs before reporting done. If the test passes but you can't verify the visual outcome, say so explicitly — don't claim success.

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
PR descriptions, commit messages, docs, and code comments must make sense to someone who never saw this conversation. Cut anything that's only legible because you were here when it happened.

- **PR descriptions:** what shipped + why, plus a test plan. No "addressed findings from review", "BLOCKER #N", or session process notes.
- **Commit messages:** the change and the reason. Not the history of how we got there.
- **Code comments:** explain *why* a non-obvious choice exists, for a future maintainer modifying the code. Never reference the task, PR, prior versions, or "added for X". Self-evident code gets no comment.

### Code
- Terse over verbose.
- TS strict mode. Avoid `any`.
- No backward-compat shims for unreleased internal code.
- Validators at boundaries (localStorage, future external APIs). Trust internal code.
- One render path: state change → save → re-render. No surgical DOM patching.
- **Brace `if` guards**, even short ones — no single-line `if (...) return x;`. Each guard gets `if (...) {\n  return x;\n}`.
- **Blank line after a guard**, and **between consecutive guards**, unless the next line is a closing brace `}`. Consecutive multi-line `if` blocks should be separated by a blank line — a wall of unspaced guards reads as one chunk.
- Be liberal with blank lines inside functions to separate logical chunks. Two unrelated 3-line operations are easier to read separated by a blank line.
- **One concrete struct per concept; no raw string literals at call sites.**
  - Group a concept's fields into a named struct (e.g. `NutritionFacts { calories; protein; carbs; fat }`). Never type domain concepts as raw string unions (`type Macro = 'protein' | 'carbs' | 'fat'`).
  - For subsets ("the macros"), classify once in a `Record<keyof Struct, Kind>` map beside the struct and expose a helper (`macros(n)`). The `Record` shape forces the compiler to reject any new field until it's classified.
  - Validators, calc, and render code iterate `Object.keys(MAP)` / `Object.entries(helper(n))` — never enumerate field names as literals.
  - Adding a field is: one line on the struct, one line in the classification map, one value per seed/instance — no edits at validator, render, or calc sites.

### UI components & CSS
- **Orthogonal channels for state.** Each interactive state (hover, active, focus, disabled) must change a different CSS property than the others. Active owns background; hover owns `filter`; disabled owns `opacity`; focus owns outline. Never let two states write the same property — that's how hover repaints over active.
- **A component's geometry must not depend on its data.** If "which item is selected" or "how many items are allowed" changes the component's size, the parent layout will shift and siblings will slide. Render a structurally stable shape (e.g. always paint all options; disable the disallowed ones) so the component occupies the same box regardless of state.
- **No descendant overrides reaching into a component.** A rule like `.parent-row .component { width: ... }` means the component doesn't own its own layout. Style components by their own class only; if a parent needs different behavior, the component takes a prop, it doesn't get overridden from outside.
- **Two surfaces with the same affordance share a factory, not just a CSS class.** A shared class lets DOM and behavior drift; a shared `createX()` factory returning `{ node, render }` keeps DOM, handlers, and state machine identical across mount points.
- **No magic min-widths or breakpoints to "fix" a specific layout case.** Those are symptoms of geometry-from-data or descendant overrides. Fix the structural cause instead.

### Git
- Commits: no `Co-Authored-By`.
- PR templates: don't delete items, just check/uncheck.

## Don't
- Cross layers the wrong way (e.g. UI importing persistence, domain importing DOM).
- Add React/Svelte/Vue.
- Put user state in IndexedDB. It holds only the read-only food catalog (a few thousand rows, which is what justified it); everything the user writes stays in the localStorage blob.
- Swap test runner.
- Add cloud sync before all currently-planned milestones ship.
- Start work without a failing test.
- Merge to main without going through a PR (so the user can preview).
- Put plan/design docs anywhere outside `specs/`.
- Put anything other than CLAUDE.md, README.md, LICENSE at repo root.
