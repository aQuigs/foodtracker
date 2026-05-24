# 0005 — Layered architecture (decoupled UI / domain / storage)

**Date:** 2026-05-23

## Context

The app will grow across milestones: M1 adds logging, M2 adds date navigation, M3 adds food management, later milestones add goals/charts. Coupling UI to storage (or to nutrition math) early would force shotgun edits every milestone. User explicitly asked for substantial decoupling.

## Decision

Four layers. Dependencies flow **down only**.

```
┌──────────────────────────────────────────┐
│  UI            src/ui/*.ts               │  DOM, events, rendering. No math, no storage.
│  ↓
│  App / wiring  src/app.ts                │  Bootstrap. Subscribes UI to domain events.
│  ↓
│  Domain        src/domain/*.ts           │  Pure logic: types, reducers, calculations.
│  ↓                                          No DOM, no localStorage, no globals.
│  Persistence   src/persistence/*.ts      │  Storage adapters. Hidden behind an interface.
└──────────────────────────────────────────┘
```

### Layer rules

- **Domain** (`src/domain/`):
  - Pure functions and types only.
  - Reducers: `reduce(state, action) → state'`.
  - Calculations: `entryCalories(entry, food)`, `dailyTotals(entries, foods, date)`, etc.
  - Imports allowed from: nothing.
  - Tested in isolation. Fastest tests in the suite.

- **Persistence** (`src/persistence/`):
  - Defines an interface (e.g. `interface StateRepository { load(): State; save(s: State): void }`).
  - Ships at least one implementation (`LocalStorageRepository`) and one fake for tests (`InMemoryRepository`).
  - Owns schema validation at the boundary.
  - Imports allowed from: `domain` (for types).

- **UI** (`src/ui/`):
  - DOM rendering and event handling only.
  - Receives state as input, emits intents (actions) as output. No direct mutation of "global state."
  - Imports allowed from: `domain` (for types and pure calc functions).
  - **Never** imports from `persistence`. UI doesn't know storage exists.

- **App** (`src/app.ts`):
  - The only place that knows about all three layers.
  - Wires: persistence load → initial state → UI render. UI intent → reducer → new state → persistence save → UI re-render.
  - Imports allowed from: all.

## Alternatives considered

- **Flat structure (everything in `src/`).** Rejected — we'll have multiple features and clear layer boundaries matter more than minimizing folders.
- **MVC/MVVM with classes for everything.** Rejected — overkill for vanilla TS. Functional reducers + a thin DOM layer is simpler.
- **A state-management library** (Redux, Zustand, etc.). Rejected — the reducer pattern in plain TS is ~20 lines, no dep needed.
- **Hexagonal/ports-and-adapters with formal "port" interfaces for everything.** Rejected as overkill for current scope; the persistence interface is the only port we genuinely need now. Revisit if we add a second adapter (e.g. cloud sync).

## Consequences

- Storage swap (localStorage → IndexedDB → cloud) is a one-file change.
- Tests can use `InMemoryRepository` and skip localStorage entirely.
- UI tests don't need real storage; pass them domain state directly.
- Adding a feature usually touches all three layers, but the changes in each are small and the boundaries don't move.
- The "no `any` from another layer" rule means types live in `domain/` and flow outward.
- Enforcement is by convention + code review, not lint rules (for now). If we slip, we add an import-restriction lint rule later.

## Layer responsibilities — concrete examples

| Concern | Layer | Why |
|---|---|---|
| `Food`, `Entry`, `State` types | domain | Shared vocabulary |
| `entryCalories(entry, food)` | domain | Pure math |
| `reduceLogEntry(state, {foodId, grams})` | domain | Pure state transition |
| `LocalStorageRepository.save(state)` | persistence | I/O |
| Validating a blob read from localStorage | persistence | Boundary check |
| Rendering a `<li>` for an entry | ui | DOM |
| Wiring a button click to dispatch an action | ui | Event handling |
| `app.ts` instantiating the repository | app | Composition root |
