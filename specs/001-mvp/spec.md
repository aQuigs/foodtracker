# M1 — MVP

Split into two PRs so each stays reviewable:
- **M1a:** domain + persistence (no UI changes beyond a placeholder)
- **M1b:** UI + wiring

## Goal
Pick a food, enter grams, see today's running total. Persists across reloads.

## In scope
- Search seeded food DB (case-insensitive substring)
- Log entry (food + grams)
- List today's entries with kcal per row + total kcal + total P/C/F
- Delete an entry
- Reject bad input (empty food, non-positive/NaN grams) with visible error, no state change

## Out of scope
History (M2), custom foods (M3). Plus, hardcoded for now:
- Date is always "today" — no date selector yet (M2)
- Food DB is hardcoded constant — no add/edit in app yet (M3)
- No goals, charts, or import/export

## Data
See [ADR 0003](../decisions/0003-food-grams-logging.md) for `Food` and `Entry` schemas. Top-level blob:

```ts
type State = { version: 1; foods: Food[]; entries: Entry[]; };
```

Storage key: `foodtracker:v1`. Seed `state.foods` with ~10 foods on first load.

## UI sketch

```
┌──────────────────────────────────────────┐
│ Food Tracker              [ Today ▾ ]    │  date stub for M2
├──────────────────────────────────────────┤
│ [ Search foods... ▾ ]                    │
│ Grams: [ 100 ]            [ Log it ]     │
├──────────────────────────────────────────┤
│ • Oats           50g    190 kcal  [×]    │
│ • Banana       120g    107 kcal  [×]     │
│ • Chicken      150g    247 kcal  [×]     │
├──────────────────────────────────────────┤
│ Total: 544 kcal   P 38g  C 60g  F 12g    │
└──────────────────────────────────────────┘
```

## Acceptance

**M1a (domain + persistence):**
1. Reducer handles `LogEntry`, `DeleteEntry` actions purely
2. `entryKcal(entry, food)` and `dailyTotals(state, date)` compute correctly
3. Bad input (empty food, non-positive/NaN grams) → reducer rejects, state unchanged
4. `LocalStorageRepository` round-trips state without loss
5. Corrupted/missing blob → repository returns a fresh seed state
6. Persistence validator rejects entries with non-positive/NaN grams, empty IDs, or negative nutritional values
7. Soft-deleted foods still contribute to historical `dailyTotals` (M3 will revisit)

**M1b (UI):**
8. First open shows seed foods + empty entry list
9. Search filters by name (case-insensitive substring)
10. Log appends to today's list
11. Each row: name, grams, kcal (int-rounded)
12. Totals update immediately on log/delete
13. Reload preserves entries
14. `[×]` removes from storage + UI
15. Bad input rejected with visible error

## Notes
- Today = `new Date().toLocaleDateString('sv-SE')` (gives `YYYY-MM-DD` local). Hardcoded; date selector is M2.
- Layered architecture ([ADR 0005](../decisions/0005-layered-architecture.md)):
  - `domain/`: `Food`, `Entry`, `State` types; `entryKcal`, `dailyTotals`; reducer for `LogEntry`/`DeleteEntry` actions.
  - `persistence/`: `StateRepository` interface, `LocalStorageRepository`, `InMemoryRepository` for tests.
  - `ui/`: search input, grams input, entries list, totals row. Receives state, emits intents.
  - `app.ts`: wires them.
- Build order (M1a → M1b): domain → persistence → ui → wire.
- Render path: state change → save → re-render. No surgical DOM patching.
- Seed foods hardcoded as a domain constant (`src/domain/seed.ts`).
