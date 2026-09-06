import { NUTRIENT_KEYS } from './types.js';
import type { NutritionFacts, State } from './types.js';
import { dateSpan, shiftDate } from './date.js';
import { scaleNutrition, totalsByDate, zeroNutrition } from './calc.js';

export type TrendRange = { label: string; buckets: number; bucketDays: number };

// Key order is toggle order. The long ranges bucket into trailing 7-day
// blocks ending today rather than calendar weeks, so the newest bucket is
// always complete and no locale decides where a week starts.
export const TREND_RANGES = {
  week:    { label: '7d',  buckets: 7,  bucketDays: 1 },
  month:   { label: '30d', buckets: 30, bucketDays: 1 },
  quarter: { label: '90d', buckets: 13, bucketDays: 7 },
  year:    { label: '1y',  buckets: 52, bucketDays: 7 },
} as const satisfies Record<string, TrendRange>;

export type TrendRangeKey = keyof typeof TREND_RANGES;
export const TREND_RANGE_KEYS = Object.keys(TREND_RANGES) as TrendRangeKey[];

export const DEFAULT_TREND_RANGE: TrendRangeKey = 'month';

export type TrendBucket = {
  start: string;
  end: string;
  loggedDays: number;
  // Mean over the bucket's logged days; null when it has none. An unlogged
  // day is a gap, not a zero: it must not pull the mean down.
  perDay: NutritionFacts | null;
};

export type TrendSeries = {
  bucketDays: number;
  // Oldest first; the last bucket ends on today.
  buckets: TrendBucket[];
};

function meanOver(days: string[], byDate: Map<string, NutritionFacts>): Pick<TrendBucket, 'loggedDays' | 'perDay'> {
  const logged = days.map((day) => byDate.get(day)).filter((t): t is NutritionFacts => t !== undefined);
  if (logged.length === 0) {
    return { loggedDays: 0, perDay: null };
  }

  const sum = zeroNutrition();
  for (const totals of logged) {
    for (const k of NUTRIENT_KEYS) {
      sum[k] += totals[k];
    }
  }

  return { loggedDays: logged.length, perDay: scaleNutrition(sum, 1 / logged.length) };
}

export function trendData(state: State, today: string, rangeKey: TrendRangeKey): TrendSeries {
  const { buckets: count, bucketDays } = TREND_RANGES[rangeKey];
  const days = dateSpan(shiftDate(today, -(count * bucketDays - 1)), count * bucketDays);
  const byDate = totalsByDate(state, days[0]!, today);

  const buckets = Array.from({ length: count }, (_, i) => {
    const block = days.slice(i * bucketDays, (i + 1) * bucketDays);
    return { start: block[0]!, end: block[block.length - 1]!, ...meanOver(block, byDate) };
  });

  return { bucketDays, buckets };
}
