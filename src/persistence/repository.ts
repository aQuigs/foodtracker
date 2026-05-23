import type { State } from '../domain/types.js';

export interface StateRepository {
  load(): State;
  save(state: State): void;
}
