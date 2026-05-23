# 0004 — Strict TDD with Web Test Runner + Playwright

**Date:** 2026-05-23

## Context

We want TDD with real-browser tests (not jsdom) so DOM APIs, `localStorage`, and `crypto.randomUUID()` behave the way they will in production.

## Decision

- **Runner:** `@web/test-runner` with Playwright (Chromium).
- **Assertions:** Mocha (`bdd`) + `@esm-bundle/chai`.
- **TypeScript in tests:** Web Test Runner config adds an `esbuild` plugin to transpile `.ts` test files on the fly. (No separate `tsc` pass for tests.)
- **Workflow:** Red → Green → Refactor. Every new feature begins with a failing test.
- **Coverage:** 80% minimum across statements/branches/functions/lines.
- **What gets unit-tested:** pure logic — schema validators, kcal math, state reducers, storage serialization.
- **What gets integration-tested:** localStorage round-trips, DOM rendering of a logged entry, date navigation.

## Alternatives considered

- **Vitest:** integrates more naturally with Vite. Rejected because it runs in jsdom by default, and we want real-browser behavior for `localStorage` and `crypto.randomUUID()`.
- **Jest + jsdom:** rejected — same reason; jsdom is not the runtime we ship to.

## Consequences

- Two toolchains in CI: Vite for the app build, Web Test Runner for tests. Both run in `npm test` / `npm run build`.
- Tests share TypeScript types with `src/`. Schema changes break tests at compile-time, which is the point.
- Coverage gate may slow early M0 work — we'll start with the gate disabled and turn it on once M1 is real code.
