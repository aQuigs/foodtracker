import { freshState } from '../domain/seed.js';
import { parseStateReport } from '../domain/validate.js';
import type { State } from '../domain/types.js';
import type { StateRepository } from './repository.js';

export const STORAGE_KEY = 'foodtracker';

export class LocalStorageRepository implements StateRepository {
  constructor(private readonly makeId: () => string = () => crypto.randomUUID()) {}

  // Only the count migration persists at boot, and only when the parse
  // wasn't also lossy — a newer build's rows this build can't read (an
  // unknown unit, say) must never be erased just by opening the app.
  load(): State {
    const raw = localStorage.getItem(STORAGE_KEY);
    const report = raw === null ? null : parseStateReport(raw, this.makeId);

    if (report !== null && report.migrated && !report.lossy) {
      this.save(report.state);
    }

    return report?.state ?? freshState();
  }

  save(state: State): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }
}
