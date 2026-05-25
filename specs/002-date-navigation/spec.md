# M2 — Date navigation

## Goal
View, log, and delete entries on any date. Local time.

## In scope
- Prev/next day arrows
- Date picker (`<input type="date">`)
- "Today" shortcut (only visible when not on today)
- Logging respects the currently selected date
- Deleting works on any date (already shipped in M1b; no change needed)
- Daily totals reflect the selected date

## Out of scope
- Editing an existing entry's grams in place (deferred — workflow is delete + re-log)
- Custom foods (M3)
- Multi-day range views or trend charts

## Data
No domain or persistence schema changes. `selectedDate` is **ephemeral UI state** held in `app.ts` only — reloads start on today.

## UI sketch

```
┌──────────────────────────────────────────┐
│ Food Tracker                             │
│ [‹] [2026-05-23] [›]            [Today]  │  Today shown only when ≠ today
├──────────────────────────────────────────┤
│ [ Search foods... ]                      │
│ [ Banana ]                               │
│ Grams: [ 100 ]            [ Log it ]     │
├──────────────────────────────────────────┤
│ • Banana       120g    107 cal  [×]      │
├──────────────────────────────────────────┤
│ Calories: 107 cal                        │
│ Protein: 1g (5%)                         │
│ Carbs: 27g (102%)                        │
│ Fat: 0g (3%)                             │
└──────────────────────────────────────────┘
```

## Acceptance
1. UI shows prev/next arrows and date picker for the selected date
2. Prev arrow shifts selected date back one day; next arrow shifts forward
3. Date picker change updates selected date directly
4. Entry list and totals reflect the selected date, not today
5. Logging adds the new entry under the selected date
6. "Today" shortcut appears only when selectedDate ≠ today; clicking it jumps to today
7. Reload resets the view to today (selectedDate is not persisted)
8. Local-time dates: selected date format is `YYYY-MM-DD`, derived via `toLocaleDateString('sv-SE')`
9. Logging keeps a stable `loggedAt` timestamp distinct from the date field, so future history/sort features work

## Notes
- Date math uses `Date` constructed from `YYYY-MM-DD` parts; arithmetic in local time (not UTC) to avoid DST/timezone surprises around midnight.
- One render path (state change → save → re-render) still holds. Date navigation changes are ephemeral UI state and trigger paint().
- Invalid date input (e.g. clearing the field) triggers a repaint to restore the previous valid value without changing `selectedDate`.
