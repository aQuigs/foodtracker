import { MACRO_KEYS, NUTRIENT_KEYS, NUTRIENTS } from './types.js';
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

export type TrendMetric = { label: string; keys: readonly (keyof NutritionFacts)[] };

const CALORIE_KEYS = NUTRIENT_KEYS.filter((k) => NUTRIENTS[k].unit === 'cal');

// Every series is drawn in calories so both charts share one y-axis: the
// macros stack grams × calories per gram, which is why a gram of fat stands
// 9/4 as tall as a gram of protein or carbs.
export const TREND_METRICS = {
  calories: { label: 'Calories', keys: CALORIE_KEYS },
  macros:   { label: 'Macros',   keys: MACRO_KEYS },
} as const satisfies Record<string, TrendMetric>;

export type TrendMetricKey = keyof typeof TREND_METRICS;
export const TREND_METRIC_KEYS = Object.keys(TREND_METRICS) as TrendMetricKey[];

export const DEFAULT_TREND_METRIC: TrendMetricKey = 'calories';
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
  // Trailing 7-day mean of calories per bucket, for the day-bucketed
  // ranges; a week bucket is already a mean, so those ranges get none.
  average: (number | null)[];
};

export const TRAILING_DAYS = 7;

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

// One pass over the entries covers the range plus the six days before it,
// which the trailing average reads so the line is right at the left edge too.
export function trendData(state: State, today: string, rangeKey: TrendRangeKey): TrendSeries {
  const { buckets: count, bucketDays } = TREND_RANGES[rangeKey];
  const lead = TRAILING_DAYS - 1;
  const span = count * bucketDays;
  const days = dateSpan(shiftDate(today, -(span + lead - 1)), span + lead);
  const byDate = totalsByDate(state, days[0]!, today);

  const buckets = Array.from({ length: count }, (_, i) => {
    const block = days.slice(lead + i * bucketDays, lead + (i + 1) * bucketDays);
    return { start: block[0]!, end: block[block.length - 1]!, ...meanOver(block, byDate) };
  });

  const average = bucketDays === 1
    ? buckets.map((_, i) => meanOver(days.slice(i, i + TRAILING_DAYS), byDate).perDay?.calories ?? null)
    : [];

  return { bucketDays, buckets, average };
}
