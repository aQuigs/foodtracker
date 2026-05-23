import type { Action, Food } from '../domain/types.js';

export type LogIntentInput = {
  foodId: string;
  gramsRaw: string;
  date: string;
};

export type LogIntentResult =
  | { kind: 'action'; action: Action }
  | { kind: 'error'; message: string };

export type IntentClock = {
  now: () => Date;
  newId: () => string;
};

export function parseLogIntent(input: LogIntentInput, foods: Food[], clock: IntentClock): LogIntentResult {
  const food = foods.find((f) => f.id === input.foodId);
  if (!input.foodId || !food || food.deletedAt !== null) {
    return { kind: 'error', message: 'Pick a food.' };
  }
  const trimmed = input.gramsRaw.trim();
  if (trimmed === '') {
    return { kind: 'error', message: 'Enter grams greater than 0.' };
  }

  const grams = Number(trimmed);
  if (!Number.isFinite(grams) || grams <= 0) {
    return { kind: 'error', message: 'Enter grams greater than 0.' };
  }
  return {
    kind: 'action',
    action: {
      type: 'LogEntry',
      entry: {
        id: clock.newId(),
        date: input.date,
        foodId: input.foodId,
        grams,
        loggedAt: clock.now().toISOString(),
      },
    },
  };
}
