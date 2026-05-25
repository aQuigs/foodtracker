import { freshState } from '../domain/seed.js';
import { migrateV1ToV2, parseState } from '../domain/validate.js';
import type { State } from '../domain/types.js';
import type { StateRepository } from './repository.js';

export const STORAGE_KEY = 'foodtracker:v2';
export const STORAGE_KEY_V1 = 'foodtracker:v1';

export class LocalStorageRepository implements StateRepository {
  load(): State {
    const v2 = parseState(localStorage.getItem(STORAGE_KEY));
    if (v2 !== null) {
      return v2;
    }

    const migrated = migrateV1ToV2(localStorage.getItem(STORAGE_KEY_V1));
    if (migrated !== null) {
      this.save(migrated);
      return migrated;
    }

    return freshState();
  }

  save(state: State): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }
}
