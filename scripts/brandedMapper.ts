import type { SourcedFood } from '../src/domain/types.js';
import { searchKey } from '../src/domain/searchKey.js';
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

// One entry in scripts/brand-packs.json: a store-brand catalog distilled from
// USDA Branded Foods. owners/brands decide which dump rows belong to the
// pack; strip lists the brand phrases mechanically removed from their names.
export type BrandPack = {
  source: string;
  owners: string[];
  brands: string[];
  strip: string[];
};

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((e) => typeof e === 'string');
}

export function isBrandPack(v: unknown): v is BrandPack {
  if (typeof v !== 'object' || v === null) {
    return false;
  }

  const e = v as Record<string, unknown>;
  if (typeof e.source !== 'string' || e.source.length === 0) {
    return false;
  }

  return isStringArray(e.owners) && isStringArray(e.brands) && isStringArray(e.strip);
}

// Folding a pack's owners/brands is the same work on every row; cached per
// pack object so a per-row scan across every pack stays cheap.
const packKeyCache = new WeakMap<BrandPack, { owners: Set<string>; brands: Set<string> }>();

function packKeys(pack: BrandPack): { owners: Set<string>; brands: Set<string> } {
  let keys = packKeyCache.get(pack);

  if (!keys) {
    keys = {
      owners: new Set(pack.owners.map(searchKey)),
      brands: new Set(pack.brands.map(searchKey)),
    };
    packKeyCache.set(pack, keys);
  }

  return keys;
}

// Takes the row's owner/brand already folded (null when the row has none),
// so a caller matching one row against every pack folds each key once
// instead of once per pack.
export function matchesPackKeys(ownerKey: string | null, brandKey: string | null, pack: BrandPack): boolean {
  const { owners, brands } = packKeys(pack);

  if (ownerKey !== null && owners.has(ownerKey)) {
    return true;
  }

  return brandKey !== null && brands.has(brandKey);
}

export function matchesPack(row: BrandedFood, pack: BrandPack): boolean {
  return matchesPackKeys(
    row.brandOwner !== undefined ? searchKey(row.brandOwner) : null,
    row.brandName !== undefined ? searchKey(row.brandName) : null,
    pack,
  );
}

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
  // Decoded ™/® glyphs are never part of a food name — only noise from the
  // label markup the dump was built from.
  const decoded = decodeHtmlEntities(description).replace(/[™®]/g, '');

  const segments = stripPhrases(decoded, strip)
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

export function mapBrandedFoods(rows: BrandedFood[], pack: BrandPack, sourceName: string): SourcedFood[] {
  const bestByKey = new Map<string, { food: SourcedFood; publishedAt: number; fdcId: number }>();

  for (const row of rows) {
    if (!isEligible(row)) {
      continue;
    }

    const name = cleanBrandedName(row.description, pack.strip);
    if (name === '') {
      continue;
    }

    const key = searchKey(name);
    const publishedAt = publicationTimestamp(row.publicationDate);
    const prior = bestByKey.get(key);

    if (prior && (publishedAt < prior.publishedAt
      || (publishedAt === prior.publishedAt && row.fdcId <= prior.fdcId))) {
      continue;
    }

    const category = row.brandedFoodCategory?.trim() ?? '';

    bestByKey.set(key, {
      publishedAt,
      fdcId: row.fdcId,
      food: {
        id: `${sourceName}:${row.fdcId}`,
        name,
        nutritionFacts: roundNutrition(extractNutritionFacts(row)),
        servingSize: 100,
        servingUnit: 'g',
        source: sourceName,
        sourceId: String(row.fdcId),
        tags: category.length > 0 ? [category] : [],
      },
    });
  }

  return sortByName([...bestByKey.values()].map((c) => c.food));
}
