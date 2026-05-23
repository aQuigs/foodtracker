import { parseState } from '../domain/validate.js';
import type { State } from '../domain/types.js';

export type ImportResult =
  | { kind: 'ok'; state: State }
  | { kind: 'error'; message: string };

export function exportState(state: State): string {
  return JSON.stringify(state, null, 2);
}

export function parseImport(raw: string): ImportResult {
  if (raw.trim() === '') {
    return { kind: 'error', message: 'Paste a JSON state to import.' };
  }

  const parsed = parseState(raw);
  if (parsed === null) {
    return { kind: 'error', message: 'Invalid state JSON — wrong shape, missing fields, or bad values.' };
  }

  return { kind: 'ok', state: parsed };
}
