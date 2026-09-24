import { NUTRIENT_KEYS, type NutritionFacts, type Pieces } from '../src/domain/types.js';
import { searchKey } from '../src/domain/searchKey.js';
import { labelSearchKey } from '../src/domain/foodSources.js';
import { isPosFinite } from '../src/domain/validate.js';
import type { BrandRow, BrandServingUnit } from '../src/domain/dataFiles.js';
import { extractNutritionFacts, hasAnyNutritionFact, roundTo, servingNutrition, type UsdaNutrient } from './usdaMapper.js';

export type BrandedFood = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  brandedFoodCategory?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  publicationDate?: string;
  foodNutrients?: UsdaNutrient[];
};

// One brand's partition as the build ships it: every row the dump filed
// under a spelling of this brand, named and deduped, and the label they are
// tagged with.
export type BrandDataset = {
  id: string;
  label: string;
  rows: BrandRow[];
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

// Y is a vowel only where a word needs it to be read as one: after another
// letter ("SKY", "BYRD", "RHYTHM"), and among two-letter words only in BY
// and MY, the English ones. "NY", "YQ", "K.L.Y." and "B4Y" stay initialisms.
// A word past ASCII is no English Y word, and lower-casing it can misfire
// (a dotted İ gains a combining dot).
function hasVowel(word: string): boolean {
  if (/[aeiou]/i.test(word)) {
    return true;
  }

  if (/[^\x00-\x7f]/.test(word)) {
    return false;
  }

  const letters = word.replace(/[^a-z]/gi, '');
  if (letters.length === 2) {
    return /^(by|my)$/i.test(word);
  }

  return letters.length > 2 && /[a-z]y/i.test(word);
}

// Word by word: the first letter and any letter after a hyphen up, the rest
// down. A word with no vowel is left as written — an initialism ("BBQ",
// "H-E-B") or a number, which lower-casing would only mangle.
function titleCaseBrand(s: string): string {
  return s.split(' ').map((word) => {
    if (!hasVowel(word)) {
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

// USDA's serving units that ship as weight or volume; every other value
// (IU, and anything unrecognised) is out of scope for this catalog. A Map
// so a unit spelled "constructor" or "toString" can't resolve to a value
// off Object.prototype instead of falling through to null.
const SERVING_UNIT_MAP = new Map<string, BrandServingUnit>([
  ['g', 'g'], ['grm', 'g'], ['gm', 'g'],
  ['ml', 'ml'], ['mlt', 'ml'],
]);

function resolveServingUnit(row: BrandedFood): BrandServingUnit | null {
  return SERVING_UNIT_MAP.get(row.servingSizeUnit?.toLowerCase() ?? '') ?? null;
}

type EligibleRow = BrandedFood & { fdcId: number; description: string };

function isEligible(row: BrandedFood): row is EligibleRow {
  if (!Number.isInteger(row.fdcId) || !row.description) {
    return false;
  }

  return hasAnyNutritionFact(row);
}

type ResolvedServing = { servingSize: number; nutritionFacts: NutritionFacts; pieces: Pieces | null };

// The label's own serving, or 100 of the unit unscaled when the dump
// doesn't state a usable size — dropping any piece count with it.
function resolveServing(row: EligibleRow): ResolvedServing {
  const per100 = extractNutritionFacts(row);
  const stated = roundTo(row.servingSize ?? NaN, 1);
  const isReal = isPosFinite(stated);
  const servingSize = isReal ? stated : 100;

  return {
    servingSize,
    nutritionFacts: servingNutrition(per100, servingSize),
    pieces: isReal ? parsePieces(row.householdServingFullText) : null,
  };
}

// Words a household serving is stated IN, not counted BY: "0.25 cup" is an
// amount, not a piece. Checked against the noun's first word (skipping a
// leading qualifier like "heaping"), taking only its run of letters so a
// trailing digit or punctuation ("oz28", "cup)") doesn't hide a match —
// "1 Single Serve Cup" still counts as a piece, since "single" isn't one.
const MEASURE_WORDS = new Set([
  'cup', 'cups', 'c',
  'tbsp', 'tbsps', 'tbs', 'tbls', 'tbl', 'tb', 'tblsp', 't', 'tablespoon', 'tablespoons',
  'tsp', 'tsps', 'teaspoon', 'teaspoons', 'teaspon',
  'oz', 'ozs', 'oza', 'onz', 'ounce', 'ounces', 'ounca', 'once', 'floz', 'z', 'fl', 'fluid', 'fluids',
  'g', 'gm', 'grm', 'gram', 'grams', 'gr',
  'mg', 'mcg', 'm', 'nl',
  'az', 'ox', 'cp',
  'kg', 'lb', 'lbs', 'pound', 'pounds',
  'ml', 'mlt', 'mls', 'millilitre', 'millilitres', 'milliliter', 'milliliters',
  'l', 'liter', 'liters', 'litre', 'litres',
  'pt', 'pint', 'pints', 'qt', 'quart', 'quarts',
  'gal', 'gallon', 'gallons',
  'inch', 'inches', 'in',
  'sec', 'second', 'seconds',
]);

const QUALIFIERS = new Set(['level', 'heaping', 'rounded', 'packed', 'scant']);

function isMeasureNoun(noun: string): boolean {
  const words = noun.split(' ');
  let i = 0;
  while (QUALIFIERS.has(words[i] ?? '')) {
    i++;
  }

  const word = /^\p{L}+/u.exec(words[i] ?? '')?.[0] ?? '';
  return MEASURE_WORDS.has(word);
}

// The dump's own abbreviations for a piece, spelled out.
const NOUN_ALIASES: Record<string, string> = {
  pcs: 'pieces', pc: 'piece', "pc's": 'pieces',
  pkg: 'package',
};

const QUANTITY_RE = /^\s*(\d+[ -]\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)$/;

function parseQuantity(text: string): number {
  const mixed = /^(\d+)[ -](\d+)\/(\d+)$/.exec(text);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }

  const fraction = /^(\d+)\/(\d+)$/.exec(text);
  if (fraction) {
    return Number(fraction[1]) / Number(fraction[2]);
  }

  return Number(text);
}

// A remainder starting mid-number — a hyphen or slash continuing a range
// or fraction the quantity didn't finish, a unicode vulgar fraction glued
// to the digit before it, or "to"/"or"/"x" joining a second number — means
// the text names a range or dimension, not a single piece count.
const AMBIGUOUS_RE = /^(?:[-./]|[¼-¾⅐-⅞]|(?:to|or|x)\s*\d)/;

function isAmbiguousRemainder(rest: string): boolean {
  return AMBIGUOUS_RE.test(rest.trim().toLowerCase());
}

// A period between two digits is a decimal point ("15.5"); anywhere else
// it's an abbreviation's trailing dot ("PKG.", "IN.") and gets dropped.
function stripAbbreviationDots(s: string): string {
  return s.replace(/(?<!\d)\.|\.(?!\d)/g, '');
}

// Strips words that describe the fraction, not the piece: "of" in "0.25 OF
// CAKE", "a"/"an" in "0.167 OF A LOAF", and a lone "th" left over when a
// fraction like "1/8th" splits from its ordinal suffix. A bare "of" (or
// "a"/"th") with nothing after it strips to nothing, which then fails the
// noun's letter check below as junk.
const STOPWORD_RE = /^(?:(?:of|an?|th)(?:\s+|$))+/;

// Beyond the label's own "(" and ",": a "|" pairs household texts like
// "2 PIECES | ABOUT 30G"; ")", "/", "*", "[", "+", ";" and ":" trail a real
// count with a footnote mark, a fraction, or a second serving size ("1 PKG/3
// STICKS", "1 Bottle500 ml"); a digit anywhere marks the same; and "makes"
// introduces what the piece adds up to, not the piece itself.
const CUT_RE = /[(),|/*[+;:\d]|\smakes\b/i;

function extractNoun(rest: string): string {
  const cut = decodeLabelText(rest).split(CUT_RE, 1)[0]!;
  const noun = stripAbbreviationDots(cut).trim().toLowerCase().replace(/\s+/g, ' ');
  return noun.replace(STOPWORD_RE, '');
}

// The final noun, once aliases and stopwords are stripped, must be only
// letters (any language), spaces, hyphens and apostrophes — this also
// rejects a noun that stripped to nothing.
const NOUN_RE = /^[\p{L}][\p{L}\s'-]*$/u;

// A repeating fraction (2/3, 1/80) needs more precision than a fixed decimal
// count can give without either losing it (3 decimals: 1/80 -> 0.013) or
// shipping float noise (2/3 -> 0.6666666666666666); 4 significant figures
// covers both.
function roundToSigFigs(n: number, sigFigs: number): number {
  if (n === 0) {
    return 0;
  }

  const magnitude = Math.floor(Math.log10(Math.abs(n)) + 1e-12);
  const factor = 10 ** (sigFigs - 1 - magnitude);
  return Math.round(n * factor) / factor;
}

function parsePieces(householdServingFullText: string | undefined): Pieces | null {
  const match = QUANTITY_RE.exec(householdServingFullText ?? '');
  if (match === null) {
    return null;
  }

  const [, quantityText, rest] = match;
  if (isAmbiguousRemainder(rest!)) {
    return null;
  }

  const perServing = roundToSigFigs(parseQuantity(quantityText!), 4);
  if (!isPosFinite(perServing)) {
    return null;
  }

  const noun = extractNoun(rest!);
  if (!NOUN_RE.test(noun) || isMeasureNoun(noun)) {
    return null;
  }

  return { perServing, noun: NOUN_ALIASES[noun] ?? noun };
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

type Candidate = { row: BrandRow; publishedAt: number };

type BrandAccumulator = {
  spellings: Map<string, number>;
  // Keyed by name, serving and nutrition, not by pieces: a can with and
  // without a household piece count is one item, so both rows collapse
  // instead of shipping as visual duplicates. A reformulated product, or
  // the same drink in a different bottle size, still ships beside the
  // original, since its serving or nutrition differs.
  byItem: Map<string, Candidate>;
};

// Every column that makes two rows the same item, pulled from the row
// itself so a nutrient added later is included automatically.
function itemKeyFor(row: BrandRow): string {
  const [, name, , servingSize, servingUnit, , , ...nutrition] = row;
  return [searchKey(name), servingSize, servingUnit, ...nutrition].join('|');
}

// On a colliding key, prefer whichever candidate states a piece count,
// then the latest publication, then the higher fdcId.
function candidateWins(a: Candidate, b: Candidate): boolean {
  const aHasPieces = a.row[5] > 0;
  const bHasPieces = b.row[5] > 0;
  if (aHasPieces !== bHasPieces) {
    return aHasPieces;
  }

  if (a.publishedAt !== b.publishedAt) {
    return a.publishedAt > b.publishedAt;
  }

  return a.row[0] > b.row[0];
}

function byName(a: BrandRow, b: BrandRow): number {
  const an = searchKey(a[1]);
  const bn = searchKey(b[1]);
  if (an !== bn) {
    return an < bn ? -1 : 1;
  }

  const aId = String(a[0]);
  const bId = String(b[0]);
  return aId < bId ? -1 : aId > bId ? 1 : 0;
}

// Streams rows in one at a time — the dump is gigabytes — and keeps each
// brand's spellings and one wire row per item, so a full build fits in
// memory. The label is only settled once every spelling has been seen.
export class BrandCollector {
  readonly #brands = new Map<string, BrandAccumulator>();

  add(row: BrandedFood): void {
    if (!isEligible(row)) {
      return;
    }

    const unit = resolveServingUnit(row);
    if (unit === null) {
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

    const { servingSize, nutritionFacts, pieces } = resolveServing(row);
    const piecesPerServing = pieces?.perServing ?? 0;
    const pieceNoun = pieces?.noun ?? '';
    const category = row.brandedFoodCategory?.trim() ?? '';
    const nutrition = NUTRIENT_KEYS.map((k) => nutritionFacts[k]);

    const wireRow: BrandRow = [row.fdcId, name, category, servingSize, unit, piecesPerServing, pieceNoun, ...nutrition];
    const candidate: Candidate = { row: wireRow, publishedAt: publicationTimestamp(row.publicationDate) };

    let acc = this.#brands.get(id);
    if (!acc) {
      acc = { spellings: new Map(), byItem: new Map() };
      this.#brands.set(id, acc);
    }

    acc.spellings.set(spelling, (acc.spellings.get(spelling) ?? 0) + 1);

    const key = itemKeyFor(wireRow);
    const prior = acc.byItem.get(key);
    if (!prior || candidateWins(candidate, prior)) {
      acc.byItem.set(key, candidate);
    }
  }

  datasets(): BrandDataset[] {
    const ids = [...this.#brands.keys()].sort();

    return ids.map((id) => {
      const acc = this.#brands.get(id)!;
      const rows = [...acc.byItem.values()].map(({ row }) => row).sort(byName);
      return { id, label: brandLabelFor(acc.spellings), rows };
    });
  }
}
