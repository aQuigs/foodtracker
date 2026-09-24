import type { Pieces } from '../src/domain/types.js';

// A USDA "foodPortion" row as either dump states it. SR Legacy always sets
// measureUnit.name to "undetermined" and puts the unit words in `modifier`;
// Foundation names the real unit in measureUnit.name and uses `modifier` as
// a descriptor ("medium", "with skin").
export type UsdaPortion = {
  id?: number;
  amount?: number;
  measureUnit?: { name?: string };
  modifier?: string;
  gramWeight?: number;
  sequenceNumber?: number;
};

// Sets hold singulars; inSet also matches the "+s" plural.
// Volume/weight units and generic serving labels: an amount, never a piece.
const NOT_A_PIECE = new Set([
  'cup', 'tbsp', 'tablespoon', 'tsp', 'teaspoon', 'fl', 'fluid', 'oz', 'ounce', 'lb', 'pound', 'g', 'gram', 'ml',
  'milliliter', 'liter', 'quart', 'pint', 'gallon', 'cubic', 'in', 'inch', 'dash', 'pinch', 'jigger', 'drop', 'scoop',
  'serving', 'nlea', 'racc', 'portion', 'recipe', 'order', 'paired', 'unit',
]);

const MAX_PIECE_GRAMS = 500;

// A part of an item — never a whole single-sitting serving by itself.
// "sheet" covers phyllo/puff pastry: a two-word phrase pairing it with the
// food's own name ("sheet dough") never reaches noun construction, since
// this set is checked before any other resolution path.
const SUB_PIECE = new Set([
  'slice', 'wedge', 'piece', 'pat', 'strip', 'segment', 'section', 'sprig', 'leaf', 'stalk', 'spear', 'floret',
  'cube', 'chunk', 'round', 'ring', 'ball', 'kernel', 'sheet',
]);

// A container, or a whole item too big for one sitting. A roast is excluded
// below regardless of this set, so it doesn't need to appear here.
const MULTI = new Set([
  'can', 'bottle', 'packet', 'bag', 'package', 'box', 'container', 'jar', 'stick', 'loaf', 'cake', 'pie', 'pizza',
  'crust', 'melon', 'head', 'bunch', 'block', 'wheel', 'tub', 'pouch', 'glass', 'drink', 'envelope', 'carton',
]);

// A container this small is a one-serving unit regardless of the row's own
// reference serving.
const SMALL_CONTAINER = new Set(['packet', 'stick', 'envelope', 'bag']);
const SMALL_CONTAINER_MAX_GRAMS = 50;

// State words, a batch-derivation word, a generic-serving word, a bare
// dimension's own words (a stray one outside any parenthetical, as in
// "fruit 2-1/4" high x 2-1/2" dia"), a cutting style ("shank cross cut"
// names the cut, not how it was cut), a shape word ("doughnut oval"), and
// "individual"/"each" (too generic to name a piece on their own): never part
// of a piece's noun on their own.
const FILLER = new Set([
  'raw', 'cooked', 'whole', 'each', 'individual', 'yield', 'yields',
  'high', 'wide', 'long', 'thick', 'dia', 'diameter', 'x', 'cross', 'cut', 'oval',
]);

// A "yields" aside states how much of the whole this piece represents, but
// only for these named cuts — a bare "unit"/"lemon"/"coconut" yield is
// describing the source item the food is made from, not a piece of the
// food itself, so it's never kept regardless of the aside.
const YIELD_CUT_SET = new Set([
  'chop', 'steak', 'patty', 'drumstick', 'thigh', 'breast', 'wing', 'leg', 'ear', 'fillet', 'filet', 'shank',
]);

// regular/average/standard read the same as medium; snack-size/thin/bite-size
// read the same as small/large/etc — all rank below the typical size.
const TYPICAL_SIZE = new Set(['medium', 'regular', 'average', 'standard']);
const OTHER_SIZE = new Set(['small', 'large', 'jumbo', 'mini', 'miniature', 'snack-size', 'thin', 'bite-size']);

// A comma, preposition, or parenthetical ends a portion's head phrase; the
// clause after it qualifies the piece rather than naming it.
const PREPOSITIONS = new Set(['with', 'without', 'from', 'of', 'excluding', 'or']);

// One count is never more than this many calories (checked on the per-count
// weight, not the portion's own stated amount), must be a real amount rather
// than a trace, and — for a container or multi-serving whole only — no more
// than double the row's own reference serving.
const CALORIE_CAP_PER_COUNT = 600;
const MIN_PIECE_GRAMS = 3;
const ONE_SITTING_MULTIPLE = 2;
const HEAVY_ODD_NOUN_MULTIPLE = 3;

// Mass nouns stated as a count ("10 fruit") and nouns whose plural is the
// singular ("10 shrimp", "goldfish").
const NEVER_PLURALIZE = new Set(['fruit', 'shrimp']);

// Plurals a suffix rule can't reach: the "f"/"fe" split before "-ves" has no
// general pattern (half/halve, knife/knive, leaf/leave, loaf/loave all
// differ), so each pair is spelled out.
const IRREGULAR_PLURALS: [string, string][] = [
  ['half', 'halves'],
  ['leaf', 'leaves'],
  ['knife', 'knives'],
  ['loaf', 'loaves'],
];

// "-ies" reverses to "-y" (cherries -> cherry) except for this small set of
// words that are already "-ie" in their base form (cookies -> cookie, not
// "cookie" mistaken for a "-y" word).
const IES_KEEP = new Set(['cookie', 'pie', 'brownie', 'pierogie']);

const CLASS = { whole: 0, subPiece: 1, multi: 2 } as const;
type FoodClass = (typeof CLASS)[keyof typeof CLASS];

// 0 ranks first: see resolve.
type Tier = 0 | 1 | 2;

function stem(word: string): string {
  return word.length > 1 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function inSet(set: Set<string>, word: string): boolean {
  return set.has(word) || set.has(stem(word)) || set.has(singularize(word));
}

// An irregular pair, "-ies"/"-oes"/"-ches"/"-shes"/"-xes"/"-sses", or a plain
// "s" reverses to the singular; anything else (including "-fish" words,
// which never pluralize) is already singular.
function singularize(word: string): string {
  const irregular = IRREGULAR_PLURALS.find(([, plural]) => plural === word);
  if (irregular !== undefined) {
    return irregular[0];
  }

  if (word.endsWith('ies')) {
    const dropS = word.slice(0, -1);
    return IES_KEEP.has(dropS) ? dropS : `${word.slice(0, -3)}y`;
  }

  if (word.endsWith('oes')) {
    return word.slice(0, -2);
  }

  if (/(?:ches|shes|xes|sses)$/.test(word)) {
    return word.slice(0, -2);
  }

  if (word.length > 1 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }

  return word;
}

// The reverse of singularize, applied to a noun already in its base form.
function pluralize(word: string): string {
  if (word.endsWith('fish') || NEVER_PLURALIZE.has(word)) {
    return word;
  }

  const irregular = IRREGULAR_PLURALS.find(([singular]) => singular === word);
  if (irregular !== undefined) {
    return irregular[1];
  }

  if (/[^aeiou]y$/.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }

  if (/[^aeiou]o$/.test(word)) {
    return `${word}es`;
  }

  return /(?:x|ch|sh|s|z)$/.test(word) ? `${word}es` : `${word}s`;
}

// '' for SR Legacy, whose measureUnit.name is always "undetermined".
function unitName(p: UsdaPortion): string {
  const u = (p.measureUnit?.name ?? '').toLowerCase();
  return u === 'undetermined' ? '' : u;
}

function phrase(p: UsdaPortion): string {
  return `${unitName(p)} ${p.modifier ?? ''}`.trim();
}

function leadWord(p: UsdaPortion): string {
  return (/[a-z]+/i.exec(phrase(p))?.[0] ?? '').toLowerCase();
}

// "with bone"/"bone-in"/"with skin and bone" all state a piece the row's
// boneless nutrition doesn't describe. "boneless" and any phrasing where
// "removed" follows "bone" ("bone removed", "bone and skin removed") state
// the same boneless piece the row's nutrition already describes, so they're
// spared.
function hasBone(p: UsdaPortion): boolean {
  const ph = phrase(p);
  if (!/\bbone/i.test(ph)) {
    return false;
  }

  return !/\bboneless\b/i.test(ph) && !/\bbone\b[\s\S]*\bremoved\b/i.test(ph);
}

function hasYieldAside(p: UsdaPortion): boolean {
  return /\byields?\b/i.test(phrase(p));
}

// "cooked from 4 oz raw" states this piece is the opposite state from the
// row it's on; "yield from 135.8 g raw meat" is deriving the piece's weight,
// not stating the piece itself is raw, so it's spared (the state word
// follows "from" rather than leading into it).
function statesOppositeCookState(p: UsdaPortion, description: string): boolean {
  const opposite = /\braw\b/i.test(description) ? 'cooked' : /\bcooked\b/i.test(description) ? 'raw' : undefined;
  if (opposite === undefined) {
    return false;
  }

  return new RegExp(`\\b${opposite}\\s+from\\b`, 'i').test(phrase(p));
}

type SkinState = 'with' | 'without' | undefined;

function skinState(text: string): SkinState {
  if (/\bwithout skin\b/i.test(text) || /\bmeat only\b/i.test(text)) {
    return 'without';
  }

  if (/\bwith skin\b/i.test(text) || /\bmeat and skin\b/i.test(text)) {
    return 'with';
  }

  return undefined;
}

// The modifier's own words, in original case and with hyphenated words kept
// whole ("balsam-pear"); a leading dimension ("2-1/3" dia") means no word at
// all. Kept in original case so a capitalized word can still be told apart
// from the rest of the phrase.
function modifierWords(p: UsdaPortion): string[] {
  const source = (p.modifier ?? '').replace(/\([^)]*\)/g, ' ').trim();
  if (!/^[a-z']/i.test(source)) {
    return [];
  }

  return (source.match(/[a-z'-]+|,/gi) ?? []).filter((w) => /[a-z,]/i.test(w));
}

function isContentWord(lower: string): boolean {
  return !FILLER.has(lower) && !inSet(NOT_A_PIECE, lower);
}

// The head phrase only: truncated at the first comma or preposition, since
// what follows qualifies the piece rather than naming it ("chop without
// refuse", "ear, medium"). `hadBoundary` says whether a comma/preposition
// actually split the phrase — true for "fillet, medium", false for "potato
// medium" or "medium McDonald's shake", where nothing marks an earlier word
// as its own noun rather than a plain modifier of the size word that
// follows.
function headPhraseWords(words: string[]): { words: string[]; hadBoundary: boolean } {
  const cut = words.findIndex((w) => w === ',' || PREPOSITIONS.has(w.toLowerCase()));
  const kept = cut === -1 ? words : words.slice(0, cut);
  const hadBoundary = cut !== -1;

  const filtered = kept.filter((w) => {
    const lower = w.toLowerCase();
    return isContentWord(lower) && !TYPICAL_SIZE.has(lower) && !OTHER_SIZE.has(lower) && lower !== 'extra';
  });

  return { words: filtered, hadBoundary };
}

// Pluralize only the final word of a multi-word noun phrase, in from its
// base singular form.
function singularPhrase(words: string[]): string {
  return [...words.slice(0, -1), singularize(words[words.length - 1]!)].join(' ');
}

// USDA capitalizes brand-ish filler ("McDonald's shake", "Chiclets"), but
// not every capitalized word is filler — some are just the head noun
// itself, qualified by an earlier lowercase word ("midget Gherkin"). Only
// the phrase's last word may be capitalized and still count: an earlier
// capitalized word dropping out means the noun that's left is just a guess
// at what the brand word qualified, so the whole phrase is untrustworthy
// ("Arrowroot biscuit" drops entirely, not just "Arrowroot"); a lone
// trailing capitalized word with nothing else is equally too uncertain
// ("Chiclets" alone drops, leaving "stick" the only candidate).
function baseNounPhrase(words: string[]): string | undefined {
  const lastIdx = words.length - 1;
  const survivors = words.filter((w, i) => i === lastIdx || !/^[A-Z]/.test(w));
  if (survivors.length === 0 || (survivors.length === 1 && /^[A-Z]/.test(survivors[0]!))) {
    return undefined;
  }

  if (survivors.length !== words.length) {
    return undefined;
  }

  return singularPhrase(survivors.map((w) => w.toLowerCase()));
}

// "extra" only signals a size alongside "large"/"small" ("extra lean" isn't
// a size).
function extraPair(tokens: string[]): string | undefined {
  const i = tokens.indexOf('extra');
  const next = tokens[i + 1];
  return i !== -1 && (next === 'large' || next === 'small') ? `extra ${next}` : undefined;
}

function sizeNoun(tokens: string[]): string | undefined {
  const typical = tokens.find((t) => TYPICAL_SIZE.has(t));
  if (typical !== undefined) {
    return typical;
  }

  return extraPair(tokens) ?? tokens.find((t) => OTHER_SIZE.has(t));
}

// A typical-size word only earns tier 0 when it's the phrase's one and only
// qualifier ("slice, regular"); an unrelated word alongside it ("slice
// regular, crust not eaten") still means this isn't the plain typical
// piece, so it falls straight to tier 2 rather than tying with the real one.
function sizeTier(tokens: string[], identity: Set<string>, bareTier: Tier): Tier {
  const extra = tokens.some((t) => !identity.has(t) && !TYPICAL_SIZE.has(t) && !OTHER_SIZE.has(t) && t !== 'extra');
  if (extra) {
    return 2;
  }

  if (tokens.some((t) => TYPICAL_SIZE.has(t))) {
    return 0;
  }

  return tokens.some((t) => OTHER_SIZE.has(t)) || extraPair(tokens) !== undefined ? 2 : bareTier;
}

// "1/8 of" or smaller says the whole is too big for one sitting; "3/8 of"
// isn't. Denominator compared against 8x the numerator so any fraction at
// or under an eighth qualifies, not just literal eighths.
function fractionDenominator(p: UsdaPortion): number | undefined {
  const m = /\b(\d+)\/(\d+)\s+of\b/.exec(phrase(p));
  if (m === null) {
    return undefined;
  }

  const denominator = Number(m[2]);
  return denominator >= 8 * Number(m[1]) ? denominator : undefined;
}

// A portion's own "without X" or "excluding X" names a part that the row's
// other portions should not offer as a candidate — it's an accessory this
// row's piece leaves out, not the piece itself ("package without flavor
// packet" means the bare "packet" elsewhere isn't a piece of this food).
function accessoryWords(p: UsdaPortion): string[] {
  const m = /\b(?:without|excluding)\s+([a-z][a-z ]*)/i.exec(phrase(p));
  return m === null ? [] : m[1]!.toLowerCase().split(/\s+/).map(stem);
}

type Resolved = { noun: string; class: FoodClass; tier: Tier; viaSizeNoun: boolean };

// The identity word, in order: a sub-piece/multi word in the head phrase
// (the Foundation unit first), else a size word — combined with any named
// head phrase before it — else the head phrase itself ("midget Gherkin" ->
// "midget gherkin"). A typical size word (medium/regular/average/standard)
// next to a real noun is implicit and dropped ("fillet, medium" ->
// "fillet"); a non-typical size stays ("small pita"). A size word ranks
// medium/regular/average/standard first, plain second, other-size last; any
// other noun ranks bare above qualified ("cracker, oyster"). A MULTI word
// the row's own description names as the food ("fish sticks") is the whole
// item, not a container or multi-serving whole.
function resolve(p: UsdaPortion, descWords: Set<string>): Resolved | null {
  const unit = unitName(p);
  const words = modifierWords(p);
  const tokens = words.filter((w) => w !== ',').map((w) => w.toLowerCase()).filter(isContentWord);
  const plainTier = (noun: string): Tier => (tokens.some((t) => singularize(t) !== noun) ? 2 : 1);

  const { words: phraseWords, hadBoundary } = headPhraseWords(words);
  const headWords = [unit, ...phraseWords.map((w) => w.toLowerCase())];
  const part = headWords.find((w) => inSet(SUB_PIECE, w) || inSet(MULTI, w));
  if (part !== undefined) {
    const noun = singularize(part);
    const isMulti = !inSet(SUB_PIECE, noun) && inSet(MULTI, noun);
    const cls = isMulti && descWords.has(stem(noun)) ? CLASS.whole : inSet(SUB_PIECE, noun) ? CLASS.subPiece : CLASS.multi;
    return { noun, class: cls, tier: sizeTier(tokens, new Set([part]), plainTier(noun)), viaSizeNoun: false };
  }

  const sized = sizeNoun(tokens);
  if (sized !== undefined) {
    const named = hadBoundary ? baseNounPhrase(phraseWords) : undefined;
    const dropSize = named !== undefined && TYPICAL_SIZE.has(sized);
    const noun = dropSize ? named : named === undefined ? sized : `${sized} ${named}`;
    const consumed = new Set([sized, ...phraseWords.map((w) => w.toLowerCase())]);
    return { noun, class: CLASS.whole, tier: sizeTier(tokens, consumed, 2), viaSizeNoun: named === undefined };
  }

  const named = baseNounPhrase(phraseWords);
  if (named === undefined) {
    // Nothing usable in the modifier itself — a Foundation row's own
    // structured unit name ("Onion", "Tomatoes") is still a trustworthy
    // noun on its own, unlike a guess parsed out of free text.
    if (unit !== '' && unit !== 'each') {
      return { noun: singularize(unit), class: CLASS.whole, tier: tokens.length > 0 ? 2 : 1, viaSizeNoun: false };
    }

    return null;
  }

  const namedWords = named.split(' ');
  const leftover = tokens.some((t) => !namedWords.includes(t) && !namedWords.includes(stem(t)) && !namedWords.includes(singularize(t)));
  return { noun: named, class: CLASS.whole, tier: leftover ? 2 : 1, viaSizeNoun: false };
}

type Candidate = Resolved & {
  portion: UsdaPortion; foodItself: boolean; skinScore: number;
  perServing: number; gpp: number;
};

// Class dominates (whole, sub-piece, multi), then tier, then skin agreement
// (a soft tiebreak — a candidate that names the opposite skin state from the
// row's own description loses to one that agrees or says nothing), then
// description match (only between candidates within 1.5x of each other's
// weight — a tortilla still beats an enchilada, but a whole fish no longer
// beats a filet 2x lighter just for sharing the row's own word), then
// amount 1, lightest, sequenceNumber, id.
function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.class !== b.class) {
    return a.class - b.class;
  }

  if (a.tier !== b.tier) {
    return a.tier - b.tier;
  }

  if (a.skinScore !== b.skinScore) {
    return a.skinScore - b.skinScore;
  }

  const ratio = Math.max(a.gpp, b.gpp) / Math.min(a.gpp, b.gpp);
  if (ratio <= 1.5 && a.foodItself !== b.foodItself) {
    return Number(b.foodItself) - Number(a.foodItself);
  }

  return Number(b.portion.amount === 1) - Number(a.portion.amount === 1)
    || a.gpp - b.gpp
    || (a.portion.sequenceNumber ?? 999) - (b.portion.sequenceNumber ?? 999)
    || (a.portion.id ?? 0) - (b.portion.id ?? 0);
}

// "10 strip" reads wrong; a size-word noun ("1 medium") stays as written. A
// non-integer count above 1 ("2.33 links") ships as one count at its
// per-count weight instead — a tap logs whole pieces.
function finalPiece(c: Candidate): { gramWeight: number; perServing: number } {
  if (c.perServing > 1 && !Number.isInteger(c.perServing)) {
    return { gramWeight: c.gpp, perServing: 1 };
  }

  return { gramWeight: c.portion.gramWeight!, perServing: c.perServing };
}

function countNoun(c: Candidate, perServing: number): string {
  if (c.viaSizeNoun) {
    return c.noun;
  }

  return perServing <= 1 ? singularize(c.noun) : pluralize(c.noun);
}

// A measure/serving portion normally isn't a piece (NOT_A_PIECE), but an oz
// or serving lead can state one directly in its aside: "oz (49 kernels)" is
// 49 kernels at 28.35 g, "serving (1 hot dog)" is 1 hot dog at 52 g. Other
// NOT_A_PIECE leads ("cup shelled (50 halves)", "recipe yield (60 pieces)")
// are restating the same measure in piece-like words, not counting a real
// piece, so they never reach this. The digit must be followed by
// whitespace, which a fraction ("1/8 of") or dimension ("2-1/3" dia) never
// is, so this can't misfire on those asides.
function asideCandidate(p: UsdaPortion): { noun: string; perServing: number } | undefined {
  if (leadWord(p) !== 'oz' && leadWord(p) !== 'serving') {
    return undefined;
  }

  const m = /\((\d+)\s+([a-z][a-z ]*)\)/i.exec(p.modifier ?? '');
  if (m === null) {
    return undefined;
  }

  const perServing = Number(m[1]);
  const words = m[2]!.toLowerCase().split(/\s+/).filter((w) => w !== 'whole');
  if (words.length === 0 || words.some((w) => inSet(NOT_A_PIECE, w))) {
    // "cup (8 fl oz)" restates the outer measure in different units — not a
    // piece count.
    return undefined;
  }

  return { noun: singularPhrase(words), perServing };
}

// The row's own single-sitting reference weight, used only by the
// one-sitting gate below: its RACC portion, else its NLEA serving, else a
// plain "serving" portion — whichever this row actually states, in that
// order of trust.
function referenceServingGrams(portions: UsdaPortion[]): number | undefined {
  const racc = portions.find((p) => unitName(p) === 'racc');
  if (racc?.gramWeight !== undefined) {
    return racc.gramWeight;
  }

  const nlea = portions.find((p) => /\bnlea\b/i.test(phrase(p)));
  if (nlea?.gramWeight !== undefined) {
    return nlea.gramWeight;
  }

  // "serving 9 servings per 24 oz package" is one product size's own count,
  // not a reference amount — a row bundling several package sizes states
  // one per size, so none of them singly represents "the" reference serving.
  return portions.find((p) => leadWord(p) === 'serving' && !/\bper\b/i.test(phrase(p)))?.gramWeight;
}

// A container this row states no reference serving for still ships when
// it's plainly one sitting on its own: a small packet/stick/envelope, a
// drink (this row states a fl oz measure), or no heavier than the row's own
// bare 1-cup portion. Otherwise there's no signal it's a single serving
// (a can of broth, a cheese package, a bag of frozen berries) and it's
// dropped rather than guessed at.
function oneCupGrams(portions: UsdaPortion[]): number | undefined {
  return portions.find((p) => {
    if (leadWord(p) !== 'cup' || p.amount !== 1) {
      return false;
    }

    // A trailing parenthetical ("cup (8 fl oz)") just restates the volume —
    // it doesn't qualify the cup the way "cup, sliced" does.
    const rest = phrase(p).replace(/\([^)]*\)/g, ' ').replace(/^cup\b/i, '').trim();
    return rest === '';
  })?.gramWeight;
}

function passesContainerHeuristic(c: Candidate, hasFlOzPortion: boolean, cupGrams: number | undefined): boolean {
  if (SMALL_CONTAINER.has(c.noun.split(' ').pop()!) && c.gpp < SMALL_CONTAINER_MAX_GRAMS) {
    return true;
  }

  if (hasFlOzPortion) {
    return true;
  }

  return cupGrams !== undefined && c.gpp <= cupGrams;
}

function passesServingGates(
  c: Candidate, caloriesPer100: number, referenceServing: number | undefined,
  hasFlOzPortion: boolean, cupGrams: number | undefined,
): boolean {
  if ((c.gpp / 100) * caloriesPer100 > CALORIE_CAP_PER_COUNT) {
    return false;
  }

  if ((c.portion.gramWeight ?? 0) < MIN_PIECE_GRAMS) {
    return false;
  }

  if (c.class === CLASS.multi) {
    if (c.perServing !== 1) {
      return false;
    }

    if (referenceServing !== undefined) {
      return c.gpp <= ONE_SITTING_MULTIPLE * referenceServing;
    }

    return passesContainerHeuristic(c, hasFlOzPortion, cupGrams);
  }

  return true;
}

// `description` is the food's USDA description, used for the state/skin
// agreement and description-match rules below. `caloriesPer100` is the
// row's own per-100g calories, used only by the calorie-cap gate.
export function pickPiece(portions: UsdaPortion[] | undefined, description = '', caloriesPer100 = 0): { gramWeight: number; pieces: Pieces } | null {
  const descWords = new Set((description.toLowerCase().match(/[a-z]+/g) ?? []).map(stem));
  const rowSkin = skinState(description);
  const list = portions ?? [];
  const rowExcluded = new Set(list.flatMap(accessoryWords));
  const referenceServing = referenceServingGrams(list);
  const hasFlOzPortion = list.some((p) => leadWord(p) === 'fl');
  const cupGrams = oneCupGrams(list);

  const candidates: Candidate[] = [];
  for (const portion of list) {
    if (hasBone(portion) || statesOppositeCookState(portion, description)) {
      continue;
    }

    if (inSet(NOT_A_PIECE, leadWord(portion))) {
      const aside = asideCandidate(portion);
      if (aside === undefined || rowExcluded.has(stem(aside.noun))) {
        continue;
      }

      const head = aside.noun.split(' ').pop()!;
      if (head === 'roast' || (hasYieldAside(portion) && !YIELD_CUT_SET.has(head))) {
        continue;
      }

      const cls = inSet(SUB_PIECE, head) ? CLASS.subPiece : inSet(MULTI, head) ? CLASS.multi : CLASS.whole;
      const ownSkin = skinState(phrase(portion));
      const skinScore = rowSkin !== undefined && ownSkin !== undefined && ownSkin !== rowSkin ? 1 : 0;
      candidates.push({
        noun: aside.noun, class: cls, tier: 1, viaSizeNoun: false, portion,
        foodItself: false, skinScore, perServing: aside.perServing,
        gpp: (portion.gramWeight ?? 0) / aside.perServing,
      });
      continue;
    }

    const gpp = (portion.gramWeight ?? NaN) / (portion.amount ?? NaN);
    if (!(gpp > 0 && gpp <= MAX_PIECE_GRAMS)) {
      continue;
    }

    const r = resolve(portion, descWords);
    if (r === null) {
      continue;
    }

    const head = r.noun.split(' ').pop()!;
    if (rowExcluded.has(stem(r.noun)) || head === 'roast' || (hasYieldAside(portion) && !YIELD_CUT_SET.has(head))) {
      continue;
    }

    // A whole-class noun this row's own description never mentions is
    // trustworthy up to a point ("hush puppy" for a food with no cup
    // portion to compare against); past 3x the row's own cup weight it's
    // more likely a mis-parsed fragment than a real single piece
    // ("squash" for cooked purslane, whose only other portion is a cup).
    if (r.class === CLASS.whole && cupGrams !== undefined && !descWords.has(stem(r.noun)) && gpp > HEAVY_ODD_NOUN_MULTIPLE * cupGrams) {
      continue;
    }

    const foodItself = r.class === CLASS.whole && (r.viaSizeNoun || descWords.has(stem(r.noun)));
    const ownSkin = skinState(phrase(portion));
    const skinScore = rowSkin !== undefined && ownSkin !== undefined && ownSkin !== rowSkin ? 1 : 0;
    candidates.push({ ...r, portion, foodItself, skinScore, perServing: portion.amount!, gpp });
  }

  // Fraction promotion: a sub-piece stated as "1/N of" the whole (N <= 8x
  // its own numerator) says the whole is too big for one sitting, so any
  // whole candidate at least half that N-piece weight is dropped. Sorting
  // afterward needs no special case — class alone then decides in the
  // promoted piece's favor once its whole rivals are gone.
  const droppedWholes = new Set<Candidate>();
  for (const c of candidates) {
    if (c.class !== CLASS.subPiece) {
      continue;
    }

    const denominator = fractionDenominator(c.portion);
    if (denominator === undefined) {
      continue;
    }

    const threshold = (denominator / 2) * c.gpp;
    for (const w of candidates) {
      if (w.class === CLASS.whole && w.gpp >= threshold) {
        droppedWholes.add(w);
      }
    }
  }

  const survivors = candidates.filter((c) => !droppedWholes.has(c)
    && passesServingGates(c, caloriesPer100, referenceServing, hasFlOzPortion, cupGrams));
  if (survivors.length === 0) {
    return null;
  }

  const best = survivors.sort(compareCandidates)[0]!;
  const { gramWeight, perServing } = finalPiece(best);
  return { gramWeight, pieces: { perServing, noun: countNoun(best, perServing) } };
}
