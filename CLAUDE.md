# foodtracker

Browser-based food tracker. Static GH Pages site. No backend.

**Read first:** [specs/MILESTONES.md](./specs/MILESTONES.md). New agents: also [specs/agent-handoff.md](./specs/agent-handoff.md). The user keeps a local `specs/STATUS.md` (gitignored) as a progress dashboard — keep it current as work moves.

## Stack
- TypeScript (no framework)
- Vite (build + dev server)
- Web Test Runner + Playwright (Chromium), Mocha bdd + `@esm-bundle/chai`
- GH Pages + `rossjrw/pr-preview-action@v1`
- localStorage, single versioned blob under `foodtracker:v1`

## How we work
- One milestone at a time. **Pause for user review between milestones.**
- **Every change ships as a PR** so the user can preview the GH Pages deploy.
- **Every PR goes through adversarial-review + `/simplify` subagent passes before user sees it.** See [ADR 0006](./specs/decisions/0006-pr-review-pipeline.md) for the full pipeline (green-gate, CONSIDER/NIT decisions, severity labels).
- Strict TDD (Red → Green → Refactor). See [ADR 0004](./specs/decisions/0004-strict-tdd.md).
- Keep the user's local `specs/STATUS.md` (gitignored) updated as PRs and tasks move — it is their dashboard. See the file itself for the table format.
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
- **One concrete struct per concept; no raw string literals at call sites.**
  - Group a concept's fields into a named struct (e.g. `NutritionFacts { calories; protein; carbs; fat }`). Never type domain concepts as raw string unions (`type Macro = 'protein' | 'carbs' | 'fat'`).
  - For subsets ("the macros"), classify once in a `Record<keyof Struct, Kind>` map beside the struct and expose a helper (`macros(n)`). The `Record` shape forces the compiler to reject any new field until it's classified.
  - Validators, calc, and render code iterate `Object.keys(MAP)` / `Object.entries(helper(n))` — never enumerate field names as literals.
  - Adding a field is: one line on the struct, one line in the classification map, one value per seed/instance — no edits at validator, render, or calc sites.

### Testing UI changes
- **Layout-affecting changes need browser verification, not just unit tests.** Web Test Runner doesn't load `styles.css` and doesn't enforce viewport — `getComputedStyle` reflects browser defaults, not production rendering. Drive a real headless browser (Playwright is already in `node_modules`) at the dev server (`http://localhost:5173/foodtracker/`) before declaring a UI change done.
- **Walk the cardinality of every dynamic affordance.** For a control whose shape depends on data, screenshot it across the range of inputs it takes in production. Examples: a button group → 1, few, many buttons; a list → empty, one, many rows; a chart → zero, partial, full. A test that only exercises the median case will miss layout collapses at the extremes (e.g. `flex: 1` on a sole child).
- **Inventory every instance before scoping.** When changing an affordance described generically ("the unit picker", "the search box"), `grep` for every place that affordance appears and decide one-by-one. Don't silently scope down to the first instance.
- **Enumerate user stories × options, not just sample states.** When a control has options (units, modes, filters), walk every (story × option) combination with Playwright: pick a unit, then click each other unit; submit, then submit again; edit, switch options, save. Sampling one state per option misses transition bugs (e.g. hover state of the previously-selected button after click).
- **Check user-visible output, not just internal state.** A test that reads `vm.foodForm.servingUnit` or `data-active` only proves the model updated. The bug may be that the user can't *see* it. Always verify with: rendered text on the page, screenshots of the post-action UI, computed CSS that affects perception (hover/active/focus all triggered).
- **Hover states must be visually distinct from selected states by construction.** Use orthogonal CSS properties (e.g. selected = background, hover = border thickness) so they stack without colliding. Never write `:hover { ...same styles as [data-active] }` — that makes "selected" and "hover-on-anything" visually identical, so after clicking a new option the previously-selected button stays highlighted as long as the cursor lingers nearby. This isn't a bug to patch with `:not()` — it's a class of bug to design out.
- **`npm run screenshots` captures the two main pages** (log + foods) at desktop (1280px) and narrow (480px) viewports into `screenshots/`. Run it after any UI change and analyze each PNG for: text wrapping, overflow, mis-aligned controls, missing labels, layout collapses, hover/active state collisions. Cheap to run, catches a lot.

### UI components — reuse, don't duplicate
- Two surfaces that need the same affordance share a **single component**, not just shared CSS classes. A "component" here means a factory function (`createUnitPicker(...)`) that returns the element + a `render(props)` method. Mount-time markup, render-time logic, and class names all live in one place.
- If you find yourself copy-pasting `el('div', { class: 'foo', role: '...' })` with only the testid changed, extract the factory. Two identical-looking groups maintained separately drift apart on the first change.

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
