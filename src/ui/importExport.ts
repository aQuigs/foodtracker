import { parseStateReport } from '../domain/validate.js';
import type { State } from '../domain/types.js';

export type ImportResult =
  | { kind: 'ok'; state: State }
  | { kind: 'error'; message: string };

export function exportState(state: State): string {
  return JSON.stringify(state, null, 2);
}

export function backupFileName(today: string): string {
  return `foodtracker-${today}.json`;
}

// Loading tolerates dropping a row this build can't use — see validate.ts —
// but import replaces the user's whole state, so silently losing rows here
// would be a real loss, not a shrug.
const LOSSY_IMPORT_MESSAGE = "This backup has entries or recipe items in a unit this version doesn't know. Update the app and try again.";

export function parseImport(raw: string, makeId: () => string): ImportResult {
  if (raw.trim() === '') {
    return { kind: 'error', message: 'No JSON state to import.' };
  }

  const parsed = parseStateReport(raw, makeId);
  if (parsed === null) {
    return { kind: 'error', message: 'Invalid state JSON — wrong shape, missing fields, or bad values.' };
  }

  if (parsed.lossy) {
    return { kind: 'error', message: LOSSY_IMPORT_MESSAGE };
  }

  return { kind: 'ok', state: parsed.state };
}
