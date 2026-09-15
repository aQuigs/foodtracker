import type { BrandsIndex, BrandsIndexEntry, BrandShardManifest, SourcedFood } from '../src/domain/types.js';
import { NUTRIENT_KEYS } from '../src/domain/types.js';
import { searchKey } from '../src/domain/searchKey.js';
import { brandSource, labelSearchKey } from '../src/domain/foodSources.js';
import { extractNutritionFacts, hasAnyNutritionFact, roundNutrition, sortByName, type UsdaNutrient } from './usdaMapper.js';

export type BrandedFood = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  brandedFoodCategory?: string;
  servingSizeUnit?: string;
  publicationDate?: string;
  foodNutrients?: UsdaNutrient[];
};

// One brand's partition as the build ships it: every row the dump filed
// under a spelling of this brand, named and deduped, tagged with the label.
export type BrandDataset = {
  id: string;
  label: string;
  foods: SourcedFood[];
};

const ACRONYM_ALLOWLIST = ['BBQ', 'USDA', 'IPA', 'BLT', 'MSG', 'GMO', 'XL', 'UHT', 'DHA', 'A2'];
const ACRONYM_PATTERN = new RegExp(`\\b(${ACRONYM_ALLOWLIST.join('|')})\\b`, 'gi');

// USDA descriptions carry raw HTML entities (the dump was scraped from label
// markup): "GOOD &#38; GATHER &#8482;" needs to read as "GOOD & GATHER ™"
// before a strip phrase like "Good & Gather" can ever match it.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', reg: '®', trade: '™',
};

// String.fromCodePoint throws on anything outside the Unicode range or in
// the surrogate range; a malformed numeric entity in the dump must not abort
// a multi-minute streaming build over that.
function isDecodableCodePoint(cp: number): boolean {
  if (cp < 0x20 || cp > 0x10ffff) {
    return false;
  }

  return cp < 0xd800 || cp > 0xdfff;
}

function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === '#') {
      const codePoint = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return isDecodableCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

// Decoded ™/® glyphs are never part of a name — only noise from the label
// markup the dump was built from.
function decodeLabelText(s: string): string {
  return decodeHtmlEntities(s).replace(/[™®]/g, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// \b only fires at a transition between a word char and a non-word char, so
// a phrase edge that is itself a non-word character (the apostrophe in
// "Trader Jacques'") never matches when followed by whitespace — both sides
// of that position are non-word. Use \b on a word-char edge; otherwise
// assert the adjacent character (outside the match) isn't a word char.
function boundaryPattern(phrase: string): string {
  const left = /\w/.test(phrase[0] ?? '') ? '\\b' : '(?<!\\w)';
  const right = /\w/.test(phrase[phrase.length - 1] ?? '') ? '\\b' : '(?!\\w)';
  return `${left}${escapeRegExp(phrase)}${right}`;
}

// Longest phrase first so "Simple Truth Organic" is removed as one unit
// instead of "Simple Truth" matching first and leaving "Organic" behind.
function stripPhrases(description: string, strip: string[]): string {
  const ordered = [...strip].filter((p) => p.length > 0).sort((a, b) => b.length - a.length);

  let result = description;
  for (const phrase of ordered) {
    result = result.replace(new RegExp(boundaryPattern(phrase), 'gi'), '');
  }

  return result;
}

// Drops a segment once every one of its words has already appeared in an
// earlier segment, e.g. "CHEESE PIZZA, CHEESE" -> "CHEESE PIZZA".
function dropRepeatedSegments(segments: string[]): string[] {
  const seenWords = new Set<string>();
  const kept: string[] = [];

  for (const segment of segments) {
    const words = searchKey(segment).split(' ').filter((w) => w.length > 0);
    const alreadySeen = words.length > 0 && words.every((w) => seenWords.has(w));

    if (alreadySeen) {
      continue;
    }

    for (const w of words) {
      seenWords.add(w);
    }

    kept.push(segment);
  }

  return kept;
}

// The leading edge strips any leftover non-alphanumeric noise, but the
// trailing edge only strips separators — "COOKIES (ORGANIC)" and "MILK, 2%"
// carry meaningful closing punctuation that a removal never put there.
function stripEdgePunctuation(s: string): string {
  return s.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[-,;:\s]+$/u, '');
}

function sentenceCase(s: string): string {
  const restored = s.toLowerCase().replace(ACRONYM_PATTERN, (m) => m.toUpperCase());
  return restored.replace(/\p{L}/u, (c) => c.toUpperCase());
}

export function cleanBrandedName(description: string, strip: string[]): string {
  const segments = stripPhrases(decodeLabelText(description), strip)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const kept = dropRepeatedSegments(segments);
  if (kept.length === 0) {
    return '';
  }

  const joined = stripEdgePunctuation(kept.join(', ').replace(/\s+/g, ' ').trim());
  if (joined.length === 0) {
    return '';
  }

  return sentenceCase(joined);
}

// A brand name as the dump spells it, minus markup: what gets stripped from
// its rows' names and what the label is chosen from.
export function brandSpelling(raw: string): string {
  return decodeLabelText(raw).replace(/\s+/g, ' ').trim();
}

// Spellings that fold alike are one brand: "LAY'S", "Lays" and "Lay's" all
// read as `lays`. Hyphens replace the folded spaces so the id can name a
// source and a URL segment.
export function brandIdFor(raw: string): string | null {
  const key = labelSearchKey(brandSpelling(raw));
  return key === '' ? null : key.replace(/ /g, '-');
}

function isMixedCase(s: string): boolean {
  return /\p{Lu}/u.test(s) && /\p{Ll}/u.test(s);
}

// Word by word: the first letter and any letter after a hyphen up, the rest
// down. A word with no vowel is left as written — an initialism ("BBQ",
// "H-E-B", "UTZ") or a number, which lower-casing would only mangle.
function titleCaseBrand(s: string): string {
  return s.split(' ').map((word) => {
    if (!/[aeiou]/i.test(word)) {
      return word;
    }

    return word.toLowerCase().replace(/(^|-)(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase());
  }).join(' ');
}

// The dump mostly shouts ("CHOBANI") but a minority of rows carry the brand
// as it is written on the label ("YoCrunch"); that spelling wins whenever
// it exists. All-lowercase does not count as written-out — "meijer" is a
// data-entry slip, not a style.
export function brandLabelFor(spellings: ReadonlyMap<string, number>): string {
  const ranked = [...spellings.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1));
  const mixed = ranked.find(([s]) => isMixedCase(s));

  if (mixed) {
    return mixed[0];
  }

  return titleCaseBrand(ranked[0]![0]);
}

const ELIGIBLE_SERVING_UNITS = new Set(['g', 'grm', 'gm', 'ml', 'mlt']);

type EligibleRow = BrandedFood & { fdcId: number; description: string };

function isEligible(row: BrandedFood): row is EligibleRow {
  if (!Number.isInteger(row.fdcId) || !row.description) {
    return false;
  }

  const unit = row.servingSizeUnit?.toLowerCase();
  if (unit === undefined || !ELIGIBLE_SERVING_UNITS.has(unit)) {
    return false;
  }

  return hasAnyNutritionFact(row);
}

// "M/D/YYYY" -> a UTC timestamp for comparison; missing, malformed, or
// out-of-range dates (Date.UTC silently rolls an invalid day/month into the
// next one, which could otherwise outrank a real date) sort as the oldest
// possible value so a dated row always wins over one without a valid date.
function publicationTimestamp(date: string | undefined): number {
  const m = date === undefined ? null : /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
  if (!m) {
    return -Infinity;
  }

  const [, monthStr, dayStr, yearStr] = m;
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return -Infinity;
  }

  return Date.UTC(Number(yearStr), month - 1, day);
}

type Candidate = { food: SourcedFood; publishedAt: number; fdcId: number };

type BrandAccumulator = {
  spellings: Map<string, number>;
  // Keyed by name plus nutrition: two rows are one item only when both
  // agree, so a reformulated product ships beside the original instead of
  // the newer publication silently replacing it.
  byItem: Map<string, Candidate>;
};

// Streams rows in one at a time — the dump is gigabytes — and keeps only the
// compact food each becomes, so a full build fits in memory.
export class BrandCollector {
  readonly #brands = new Map<string, BrandAccumulator>();

  add(row: BrandedFood): void {
    if (!isEligible(row)) {
      return;
    }

    const spelling = row.brandName === undefined ? '' : brandSpelling(row.brandName);
    const id = brandIdFor(spelling);
    if (id === null) {
      return;
    }

    const name = cleanBrandedName(row.description, [spelling]);
    if (name === '') {
      return;
    }

    const nutritionFacts = roundNutrition(extractNutritionFacts(row));
    const itemKey = [searchKey(name), ...NUTRIENT_KEYS.map((k) => nutritionFacts[k])].join('|');
    const publishedAt = publicationTimestamp(row.publicationDate);

    let acc = this.#brands.get(id);
    if (!acc) {
      acc = { spellings: new Map(), byItem: new Map() };
      this.#brands.set(id, acc);
    }

    acc.spellings.set(spelling, (acc.spellings.get(spelling) ?? 0) + 1);

    const prior = acc.byItem.get(itemKey);
    if (prior && (publishedAt < prior.publishedAt
      || (publishedAt === prior.publishedAt && row.fdcId <= prior.fdcId))) {
      return;
    }

    const category = row.brandedFoodCategory?.trim() ?? '';
    const source = brandSource(id);

    acc.byItem.set(itemKey, {
      publishedAt,
      fdcId: row.fdcId,
      food: {
        id: `${source}:${row.fdcId}`,
        name,
        brand: '',
        nutritionFacts,
        servingSize: 100,
        servingUnit: 'g',
        source,
        sourceId: String(row.fdcId),
        tags: category.length > 0 ? [category] : [],
      },
    });
  }

  // The label is only known once every spelling has been seen, so it is
  // stamped on the foods here rather than as rows arrive.
  datasets(): BrandDataset[] {
    const ids = [...this.#brands.keys()].sort();

    return ids.map((id) => {
      const acc = this.#brands.get(id)!;
      const label = brandLabelFor(acc.spellings);
      const foods = [...acc.byItem.values()].map((c) => ({ ...c.food, brand: label }));
      return { id, label, foods: sortByName(foods) };
    });
  }
}

export function mapBrandRows(rows: Iterable<BrandedFood>): BrandDataset[] {
  const collector = new BrandCollector();
  for (const row of rows) {
    collector.add(row);
  }

  return collector.datasets();
}

export function datasetBytes(brand: BrandDataset): number {
  return brand.foods.reduce((sum, food) => sum + JSON.stringify(food).length + 1, 0);
}

// Largest brand first into whichever shard is lightest, over as many shards
// as the target size implies. Ties fall to the lower id and the lower shard,
// so a rebuild lays the same brands out the same way.
export function packShards(brands: BrandDataset[], targetBytes: number): Map<string, number> {
  const sized = brands
    .map((b) => ({ id: b.id, bytes: datasetBytes(b) }))
    .sort((a, b) => (b.bytes - a.bytes) || (a.id < b.id ? -1 : 1));

  const total = sized.reduce((sum, b) => sum + b.bytes, 0);
  const count = Math.max(1, Math.ceil(total / targetBytes));
  const load = new Array<number>(count).fill(0);
  const shardOf = new Map<string, number>();

  for (const brand of sized) {
    let lightest = 0;
    for (let i = 1; i < count; i++) {
      if (load[i]! < load[lightest]!) {
        lightest = i;
      }
    }

    load[lightest] = load[lightest]! + brand.bytes;
    shardOf.set(brand.id, lightest);
  }

  return shardOf;
}

export function buildBrandsIndex(input: {
  version: string;
  generatedAt: string;
  brands: BrandDataset[];
  shardOf: ReadonlyMap<string, number>;
  shards: BrandShardManifest[];
}): BrandsIndex {
  const entries: BrandsIndexEntry[] = [...input.brands]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((brand) => {
      const shard = input.shardOf.get(brand.id);
      if (shard === undefined) {
        throw new Error(`brand "${brand.id}" has no shard assignment`);
      }

      return [brand.id, brand.label, brand.foods.length, shard];
    });

  return {
    source: 'brands',
    version: input.version,
    generatedAt: input.generatedAt,
    brands: entries,
    shards: input.shards,
  };
}
