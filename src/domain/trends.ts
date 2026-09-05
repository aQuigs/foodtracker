import { MACRO_KEYS, NUTRIENT_KEYS, NUTRIENTS } from './types.js';
import type { NutritionFacts, State } from './types.js';
import { shiftDate } from './date.js';
import { totalsByDate, zeroNutrition } from './calc.js';

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

export const TRAILING_DAYS = 7;

function rangeStart(today: string, range: TrendRange): string {
  return shiftDate(today, -(range.buckets * range.bucketDays - 1));
}

function datesFrom(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftDate(start, i));
}

function meanOver(days: string[], byDate: Map<string, NutritionFacts>): Pick<TrendBucket, 'loggedDays' | 'perDay'> {
  const sum = zeroNutrition();
  let loggedDays = 0;
  for (const day of days) {
    const totals = byDate.get(day);
    if (totals === undefined) {
      continue;
    }

    loggedDays += 1;
    for (const k of NUTRIENT_KEYS) {
      sum[k] += totals[k];
    }
  }

  if (loggedDays === 0) {
    return { loggedDays, perDay: null };
  }

  for (const k of NUTRIENT_KEYS) {
    sum[k] /= loggedDays;
  }

  return { loggedDays, perDay: sum };
}

export function trendSeries(state: State, today: string, rangeKey: TrendRangeKey): TrendBucket[] {
  const range = TREND_RANGES[rangeKey];
  const from = rangeStart(today, range);
  const byDate = totalsByDate(state, from, today);

  return Array.from({ length: range.buckets }, (_, i) => {
    const days = datesFrom(shiftDate(from, i * range.bucketDays), range.bucketDays);
    return { start: days[0]!, end: days[days.length - 1]!, ...meanOver(days, byDate) };
  });
}

// Trailing 7-day mean of calories, one per bucket, for the day-bucketed
// ranges; a week bucket is already a mean, so those ranges get no line. Reads
// days before the range start so the line is right at the left edge too.
export function trailingAverage(state: State, today: string, rangeKey: TrendRangeKey): (number | null)[] {
  const range = TREND_RANGES[rangeKey];
  if (range.bucketDays !== 1) {
    return [];
  }

  const from = rangeStart(today, range);
  const byDate = totalsByDate(state, shiftDate(from, -(TRAILING_DAYS - 1)), today);

  return datesFrom(from, range.buckets).map((day) => {
    const window = datesFrom(shiftDate(day, -(TRAILING_DAYS - 1)), TRAILING_DAYS);
    return meanOver(window, byDate).perDay?.calories ?? null;
  });
}
