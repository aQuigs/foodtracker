import { freshState } from '../domain/seed.js';
import type { State } from '../domain/types.js';
import type { StateRepository } from './repository.js';

export class InMemoryRepository implements StateRepository {
  #state: State | null = null;

  load(): State {
    return structuredClone(this.#state ?? freshState());
  }

  save(state: State): void {
    this.#state = structuredClone(state);
  }
}
