// USDA FoodData Central bulk downloads the data build reads, by the stem
// USDA puts in each file name.
export const RELEASE_STEMS = {
  branded: 'branded',
  foundation: 'foundation',
  srLegacy: 'sr_legacy',
} as const;

export type ReleaseKind = keyof typeof RELEASE_STEMS;

// One release date per kind: "2026-04-30", or "2018-04" for SR Legacy.
export type Releases = Record<ReleaseKind, string>;

export const RELEASE_KINDS = Object.keys(RELEASE_STEMS) as ReleaseKind[];

export const DOWNLOAD_PAGE_URL = 'https://fdc.nal.usda.gov/download-datasets';

const DATASETS_URL = 'https://fdc.nal.usda.gov/fdc-datasets';

const DATE = String.raw`\d{4}-\d{2}(?:-\d{2})?`;

export function releaseZipName(kind: ReleaseKind, date: string): string {
  return `FoodData_Central_${RELEASE_STEMS[kind]}_food_json_${date}.zip`;
}

export function releaseZipUrl(kind: ReleaseKind, date: string): string {
  return `${DATASETS_URL}/${releaseZipName(kind, date)}`;
}

// Zero-padded dates compare correctly as strings, and a month-only date
// sorts before any day in that month.
export function latestReleases(html: string): Releases {
  return Object.fromEntries(RELEASE_KINDS.map((kind) => {
    const pattern = new RegExp(`FoodData_Central_${RELEASE_STEMS[kind]}_food_json_(${DATE})\\.zip`, 'g');
    const dates = [...html.matchAll(pattern)].map((m) => m[1]!).sort();
    const latest = dates.at(-1);

    if (latest === undefined) {
      throw new Error(`the USDA download page lists no ${kind} JSON release; has its layout changed?`);
    }

    return [kind, latest];
  })) as Releases;
}

export function parseReleases(value: unknown): Releases {
  const pins = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

  return Object.fromEntries(RELEASE_KINDS.map((kind) => {
    const date = pins[kind];

    if (typeof date !== 'string' || !new RegExp(`^${DATE}$`).test(date)) {
      throw new Error(`USDA release pins: ${kind} must be a date like 2026-04-30, got ${JSON.stringify(date)}`);
    }

    return [kind, date];
  })) as Releases;
}
