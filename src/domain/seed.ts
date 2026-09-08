import type { State } from './types.js';
import { defaultEnabledSources } from './foodSources.js';

export function freshState(): State {
  return { version: 2, enabledSources: defaultEnabledSources(), foods: [], meals: [], entries: [], recipes: [], recipeLogs: [] };
}
