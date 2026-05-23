# 0002 — localStorage for persistence (MVP)

**Date:** 2026-05-23

## Context

User wants statefulness across sessions but explicitly said "not proper cloud yet". The data we're persisting through M1–M5 is small (a food DB of dozens of items, a few entries per day). It's per-device — sync isn't a goal yet.

## Decision

- **Storage:** `localStorage`, single key (e.g. `foodtracker:v1`), single JSON blob.
- **Schema versioning:** top-level `version: 1` field; on load, if the version doesn't match the current code, we either migrate or refuse-and-warn (TBD per migration).
- **Validator at the boundary:** every read from localStorage runs through a validator that asserts the shape. If validation fails, we log and surface an error rather than letting bad data poison the app.
- **Writes:** debounced per state change.

## Alternatives considered

- **IndexedDB:** more capable, but overkill for a single JSON blob under a few KB. Reconsider if the food DB grows past ~1000 entries.
- **One key per concept (`foods`, `entries`, `goals`):** rejected — multi-key writes aren't atomic; one big blob means consistent reads/writes.
- **No persistence:** rejected — the user explicitly asked for state across reloads.

## Consequences

- Data is per-browser-per-device. Clearing site data wipes everything. Acceptable for MVP; export/import (M3) is the user-facing escape hatch.
- localStorage is synchronous and limited (~5–10MB depending on browser). Way more than enough for years of entries.
- We need a migration story when the schema changes. For pre-1.0 it's fine to wipe and re-seed; once we go live we'll keep migrations forward-only.
- Cloud sync (the eventual "proper" backend) will need to reconcile against this blob format. Keep the JSON portable.
