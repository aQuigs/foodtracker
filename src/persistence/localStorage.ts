import { freshState } from '../domain/seed.js';
import { parseState } from '../domain/validate.js';
import type { State } from '../domain/types.js';
import type { StateRepository } from './repository.js';

export const STORAGE_KEY = 'foodtracker:v1';

export class LocalStorageRepository implements StateRepository {
  load(): State {
    return parseState(localStorage.getItem(STORAGE_KEY)) ?? freshState();
  }

  save(state: State): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // setItem throws on quota exceeded (all browsers) and in iOS Safari
      // private browsing. Swallow so the in-memory state survives the failed write.
    }
  }
}
