import { freshState } from '../domain/seed.js';
import { parseState } from '../domain/validate.js';
import type { State } from '../domain/types.js';
import type { StateRepository } from './repository.js';

export const STORAGE_KEY = 'foodtracker';

export class LocalStorageRepository implements StateRepository {
  load(): State {
    return parseState(localStorage.getItem(STORAGE_KEY)) ?? freshState();
  }

  save(state: State): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }
}
