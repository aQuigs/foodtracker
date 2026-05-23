import type { Action, Entry, State } from './types.js';

function isValidEntry(entry: Entry, state: State): boolean {
  if (!entry.foodId) return false;
  if (!state.foods.some((f) => f.id === entry.foodId)) return false;
  if (!Number.isFinite(entry.grams) || entry.grams <= 0) return false;
  return true;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LogEntry': {
      if (!isValidEntry(action.entry, state)) return state;
      return { ...state, entries: [...state.entries, action.entry] };
    }
    case 'DeleteEntry': {
      const filtered = state.entries.filter((e) => e.id !== action.entryId);
      if (filtered.length === state.entries.length) return state;
      return { ...state, entries: filtered };
    }
    default:
      return state;
  }
}
