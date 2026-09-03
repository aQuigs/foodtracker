import { expect } from '@esm-bundle/chai';
import { JsonArrayItemScanner } from '../../scripts/jsonArrayScanner.js';

// A single fixture exercising every edge case the scanner must handle:
// a string containing brackets/braces/commas before the target array, a
// string element with escaped quotes and a stray backslash, an object with
// nested arrays and objects, bare number/boolean/null elements, a nested
// array element, and whitespace/newlines between items.
const FIXTURE = `{"meta":"not the array, but has [ and ] and { and } and , chars","BrandedFoods":[
  {"fdcId":1,"description":"Item one, \\"quoted\\" text with [brackets] {braces} and , commas"},
  {"fdcId":2,"nested":{"a":[1,2,3],"b":{"c":4}}},
  "bare string with \\\\backslash and \\nescaped newline",
  42,
  -3.14e2,
  true,
  false,
  null,
  [1,"two",3]
]}`;

const EXPECTED = [
  { fdcId: 1, description: 'Item one, "quoted" text with [brackets] {braces} and , commas' },
  { fdcId: 2, nested: { a: [1, 2, 3], b: { c: 4 } } },
  'bare string with \\backslash and \nescaped newline',
  42,
  -314,
  true,
  false,
  null,
  [1, 'two', 3],
];

function runInChunks(chunks: string[]): unknown[] {
  const scanner = new JsonArrayItemScanner();
  const items: unknown[] = [];
  for (const chunk of chunks) {
    items.push(...scanner.push(chunk));
  }
  scanner.end();
  return items;
}

describe('JsonArrayItemScanner', () => {
  it('parses every element of the first array, fed as one chunk', () => {
    expect(runInChunks([FIXTURE])).to.deep.equal(EXPECTED);
  });

  it('parses a bare top-level array with no wrapping object', () => {
    const bare = '[{"a":1},{"a":2}]';
    expect(runInChunks([bare])).to.deep.equal([{ a: 1 }, { a: 2 }]);
  });

  it('ignores brackets and braces inside a string before the target array starts', () => {
    const scanner = new JsonArrayItemScanner();
    const items = scanner.push('{"skip":"[ { , } ]","BrandedFoods":[1,2]}');
    scanner.end();
    expect(items).to.deep.equal([1, 2]);
  });

  it('handles a string element containing brackets, braces, commas and escaped quotes', () => {
    const scanner = new JsonArrayItemScanner();
    const items = scanner.push('["a [b] {c}, d \\"e\\""]');
    scanner.end();
    expect(items).to.deep.equal(['a [b] {c}, d "e"']);
  });

  it('handles bare numbers, booleans, null and a nested array as elements', () => {
    const scanner = new JsonArrayItemScanner();
    const items = scanner.push('[1, -2.5, true, false, null, [1,2]]');
    scanner.end();
    expect(items).to.deep.equal([1, -2.5, true, false, null, [1, 2]]);
  });

  it('handles whitespace and newlines between items', () => {
    const scanner = new JsonArrayItemScanner();
    const items = scanner.push('[\n  1,\n\t2 ,\n  3\n]');
    scanner.end();
    expect(items).to.deep.equal([1, 2, 3]);
  });

  it('reassembles an item split mid-string across chunks', () => {
    const whole = '[{"description":"peanut butter"}]';
    const at = whole.indexOf('peanut') + 3;
    expect(runInChunks([whole.slice(0, at), whole.slice(at)])).to.deep.equal([{ description: 'peanut butter' }]);
  });

  it('reassembles an item split mid-escape across chunks', () => {
    const whole = '["a\\\\b"]';
    const at = whole.indexOf('\\\\') + 1;
    expect(runInChunks([whole.slice(0, at), whole.slice(at)])).to.deep.equal(['a\\b']);
  });

  it('reassembles an item split mid-number across chunks', () => {
    const whole = '[-3.14e2, 7]';
    const at = whole.indexOf('14');
    expect(runInChunks([whole.slice(0, at), whole.slice(at)])).to.deep.equal([-314, 7]);
  });

  it('ignores content after the array closes', () => {
    const scanner = new JsonArrayItemScanner();
    const items = scanner.push('{"BrandedFoods":[1,2]}');
    scanner.end();
    expect(items).to.deep.equal([1, 2]);
  });

  it('throws from end() when an item is still open (truncated input)', () => {
    const scanner = new JsonArrayItemScanner();
    scanner.push('[{"fdcId":1,"description":"unterminated');
    expect(() => scanner.end()).to.throw();
  });

  it('throws from end() when the array was opened but never closed', () => {
    const scanner = new JsonArrayItemScanner();
    scanner.push('[1, 2,');
    expect(() => scanner.end()).to.throw();
  });

  it('throws from end() when no array ever appeared', () => {
    const scanner = new JsonArrayItemScanner();
    scanner.push('{"notes":"no array in this document"}');
    expect(() => scanner.end()).to.throw();
  });

  it('does not throw from end() when the array closed cleanly', () => {
    const scanner = new JsonArrayItemScanner();
    scanner.push('[1, 2]');
    expect(() => scanner.end()).to.not.throw();
  });

  it('produces the same items no matter where the fixture is split into two chunks', () => {
    for (let i = 0; i <= FIXTURE.length; i++) {
      const items = runInChunks([FIXTURE.slice(0, i), FIXTURE.slice(i)]);
      expect(items, `split at offset ${i}`).to.deep.equal(EXPECTED);
    }
  });
});
