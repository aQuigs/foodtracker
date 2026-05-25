import { reducer } from './domain/reducer.js';
import type { State } from './domain/types.js';
import { parseLogIntent } from './ui/intents.js';
import { render } from './ui/view.js';
import { isValidIsoDate, shiftDate } from './domain/date.js';
import type { StateRepository } from './persistence/repository.js';

export type Clock = {
  now: () => Date;
  today: () => string;
  newId: () => string;
};

export const defaultClock: Clock = {
  now: () => new Date(),
  today: () => new Date().toLocaleDateString('sv-SE'),
  newId: () => crypto.randomUUID(),
};

export type AppOptions = {
  container: HTMLElement;
  repo: StateRepository;
  clock?: Clock;
};

export function createApp(opts: AppOptions): void {
  const clock = opts.clock ?? defaultClock;
  let state: State = opts.repo.load();
  let selectedDate = clock.today();
  let query = '';
  let selectedFoodId: string | null = null;
  let gramsRaw = '';
  let error: string | null = null;

  function setState(next: State): void {
    if (next === state) {
      return;
    }

    state = next;
    opts.repo.save(state);
  }

  function paint(): void {
    render(opts.container, {
      state, today: clock.today(), selectedDate, query, selectedFoodId, gramsRaw, error,
    }, {
      onLog: (foodId, raw) => {
        const result = parseLogIntent({ foodId, gramsRaw: raw, date: selectedDate }, state.foods, clock);
        if (result.kind === 'error') {
          error = result.message;
          paint();
          return;
        }

        setState(reducer(state, result.action));
        gramsRaw = '';
        error = null;
        paint();
      },
      onDelete: (entryId) => {
        setState(reducer(state, { type: 'DeleteEntry', entryId }));
        error = null;
        paint();
      },
      onQueryChange: (q) => {
        if (q === query) {
          return;
        }

        query = q;
        paint();
      },
      onFoodSelect: (id) => {
        if (id === selectedFoodId) {
          return;
        }

        selectedFoodId = id;
        paint();
      },
      onGramsChange: (g) => {
        if (g === gramsRaw) {
          return;
        }

        gramsRaw = g;
        paint();
      },
      onDateChange: (d) => {
        if (!isValidIsoDate(d)) {
          paint();
          return;
        }

        selectedDate = d;
        paint();
      },
      onPrevDate: () => {
        selectedDate = shiftDate(selectedDate, -1);
        paint();
      },
      onNextDate: () => {
        selectedDate = shiftDate(selectedDate, 1);
        paint();
      },
      onJumpToday: () => {
        selectedDate = clock.today();
        paint();
      },
    });
  }

  paint();
}
