import { freshState } from '../domain/seed.js';
import { migrateV1ToV3, migrateV2ToV3, parseState } from '../domain/validate.js';
import type { State } from '../domain/types.js';
import type { StateRepository } from './repository.js';

export const STORAGE_KEY = 'foodtracker:v3';
export const STORAGE_KEY_V2 = 'foodtracker:v2';
export const STORAGE_KEY_V1 = 'foodtracker:v1';

export class LocalStorageRepository implements StateRepository {
  load(): State {
    const v3 = parseState(localStorage.getItem(STORAGE_KEY));
    if (v3 !== null) {
      return v3;
    }

    const fromV2 = migrateV2ToV3(localStorage.getItem(STORAGE_KEY_V2));
    if (fromV2 !== null) {
      this.save(fromV2);
      return fromV2;
    }

    const fromV1 = migrateV1ToV3(localStorage.getItem(STORAGE_KEY_V1));
    if (fromV1 !== null) {
      this.save(fromV1);
      return fromV1;
    }

    return freshState();
  }

  save(state: State): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }
}
