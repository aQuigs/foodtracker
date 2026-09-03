type Phase = 'seeking' | 'between' | 'element' | 'closed';
type ElementKind = 'bracketed' | 'string' | 'bare';

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

// Streams a JSON document too large to parse in memory. It has no notion of
// object keys — it scans for the first "[" outside any string and yields
// every element of THAT array, whichever property happens to hold it (in
// the USDA dump, "BrandedFoods" simply happens to be first), or a bare
// top-level array. Elements may be split across any number of push() calls
// at any byte offset (mid-string, mid-escape, mid-number); the scanner
// reassembles them before handing each one to JSON.parse.
export class JsonArrayItemScanner {
  private phase: Phase = 'seeking';
  private inString = false;
  private escaped = false;
  private depth = 0;
  private elementKind: ElementKind = 'bare';
  private buffer = '';
  private segStart = -1;

  push(chunk: string): unknown[] {
    const items: unknown[] = [];
    const n = chunk.length;

    if (this.phase === 'element') {
      this.segStart = 0;
    }

    for (let i = 0; i < n; i++) {
      if (this.phase === 'closed') {
        break;
      }

      if (this.phase === 'seeking') {
        this.stepSeeking(chunk[i]!);
        continue;
      }

      if (this.phase === 'between') {
        i = this.stepBetween(chunk, i);
        continue;
      }

      const outcome = this.stepElement(chunk[i]!);
      if (outcome === 'continue') {
        continue;
      }

      const end = outcome === 'closeInclusive' ? i + 1 : i;
      this.buffer += chunk.slice(this.segStart, end);
      items.push(JSON.parse(this.buffer));
      this.buffer = '';
      this.segStart = -1;
      this.phase = 'between';

      if (outcome === 'closeExclusive') {
        i--;
      }
    }

    if (this.phase === 'element' && this.segStart !== -1) {
      this.buffer += chunk.slice(this.segStart, n);
      this.segStart = -1;
    }

    return items;
  }

  end(): void {
    if (this.phase !== 'closed') {
      throw new Error('JsonArrayItemScanner.end(): the array was never closed (truncated input, or no array found)');
    }
  }

  private stepSeeking(c: string): void {
    if (this.inString) {
      if (this.escaped) {
        this.escaped = false;
      } else if (c === '\\') {
        this.escaped = true;
      } else if (c === '"') {
        this.inString = false;
      }

      return;
    }

    if (c === '"') {
      this.inString = true;
      return;
    }

    if (c === '[') {
      this.phase = 'between';
    }
  }

  // Skips whitespace/commas between elements. Returns the index to resume
  // from — unchanged unless it starts a new element, in which case the
  // current char is replayed through stepElement on the next loop turn.
  private stepBetween(chunk: string, i: number): number {
    const c = chunk[i]!;

    if (WHITESPACE.has(c) || c === ',') {
      return i;
    }

    if (c === ']') {
      this.phase = 'closed';
      return i;
    }

    this.phase = 'element';
    this.segStart = i;
    this.inString = false;
    this.escaped = false;
    this.depth = 0;
    this.elementKind = c === '"' ? 'string' : c === '{' || c === '[' ? 'bracketed' : 'bare';

    return i - 1;
  }

  // Advances one char into the current element. 'closeInclusive' means this
  // char is the element's last (a closing quote/bracket); 'closeExclusive'
  // means this char belongs to the NEXT phase (a bare token's terminator).
  private stepElement(c: string): 'continue' | 'closeInclusive' | 'closeExclusive' {
    if (this.inString) {
      if (this.escaped) {
        this.escaped = false;
      } else if (c === '\\') {
        this.escaped = true;
      } else if (c === '"') {
        this.inString = false;
        if (this.elementKind === 'string' && this.depth === 0) {
          return 'closeInclusive';
        }
      }

      return 'continue';
    }

    if (c === '"') {
      this.inString = true;
      return 'continue';
    }

    // A bare token (number/true/false/null) never legitimately contains a
    // bracket — any of these chars terminates it rather than nesting.
    if (this.elementKind === 'bare') {
      return c === ',' || c === ']' || c === '}' || WHITESPACE.has(c) ? 'closeExclusive' : 'continue';
    }

    if (c === '{' || c === '[') {
      this.depth++;
      return 'continue';
    }

    if (c === '}' || c === ']') {
      this.depth--;
      return this.elementKind === 'bracketed' && this.depth === 0 ? 'closeInclusive' : 'continue';
    }

    return 'continue';
  }
}
