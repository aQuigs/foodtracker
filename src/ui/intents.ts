import type { Action, Food, Unit } from '../domain/types.js';
import { toGrams } from '../domain/units.js';

export type LogIntentInput = {
  foodId: string;
  amountRaw: string;
  unit: Unit;
  date: string;
  mealId: string;
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

  const trimmed = input.amountRaw.trim();
  if (trimmed === '') {
    return { kind: 'error', message: 'Enter an amount greater than 0.' };
  }

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { kind: 'error', message: 'Enter an amount greater than 0.' };
  }

  const grams = toGrams(amount, input.unit, food.weightPerUnit);
  if (!Number.isFinite(grams) || grams <= 0) {
    return { kind: 'error', message: 'Enter an amount greater than 0.' };
  }

  return {
    kind: 'action',
    action: {
      type: 'LogEntry',
      entry: {
        id: clock.newId(),
        date: input.date,
        foodId: input.foodId,
        amount,
        unit: input.unit,
        grams,
        loggedAt: clock.now().toISOString(),
        mealId: input.mealId,
      },
    },
  };
}
