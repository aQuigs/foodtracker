import type { Action, Food } from '../domain/types.js';
import { compatibleUnits, isUnit } from '../domain/units.js';

export type LogIntentInput = {
  foodId: string;
  amount: string;
  unit: string;
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

  if (!isUnit(input.unit)) {
    return { kind: 'error', message: 'Pick a unit.' };
  }

  if (!compatibleUnits(food).includes(input.unit)) {
    return { kind: 'error', message: `This food can’t be logged in ${input.unit}.` };
  }

  const trimmed = input.amount.trim();
  if (trimmed === '') {
    return { kind: 'error', message: 'Enter an amount greater than 0.' };
  }

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) {
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
        loggedAt: clock.now().toISOString(),
      },
      newMealId: clock.newId(),
    },
  };
}
