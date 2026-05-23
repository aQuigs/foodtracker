import { expect } from '@esm-bundle/chai';
import { exportState, parseImport } from '../../src/ui/importExport.js';
import { freshState } from '../../src/domain/seed.js';
import type { State } from '../../src/domain/types.js';

describe('exportState', () => {
  it('returns pretty-printed JSON', () => {
    const s = freshState();
    const out = exportState(s);
    expect(out).to.be.a('string');
    expect(out).to.contain('\n');
    expect(JSON.parse(out)).to.deep.equal(s);
  });
});

describe('parseImport', () => {
  it('returns the parsed state for a round-tripped export', () => {
    const before = freshState();
    const out = exportState(before);
    const r = parseImport(out);
    expect(r).to.deep.equal({ kind: 'ok', state: before });
  });

  it('rejects malformed JSON with a message', () => {
    const r = parseImport('not json {{');
    expect(r.kind).to.equal('error');
  });

  it('rejects state with the wrong shape', () => {
    const r = parseImport(JSON.stringify({ foods: [], entries: [] }));
    expect(r.kind).to.equal('error');
  });

  it('rejects state with a wrong version', () => {
    const r = parseImport(JSON.stringify({ version: 99, foods: [], entries: [] }));
    expect(r.kind).to.equal('error');
  });

  it('rejects an entry with non-positive grams', () => {
    const r = parseImport(JSON.stringify({
      version: 2, foods: [],
      entries: [{ id: 'e', date: '2026-05-23', foodId: 'x', amount: 1, unit: 'g', grams: 0, loggedAt: 'x' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects a food with empty-string createdAt', () => {
    const r = parseImport(JSON.stringify({
      version: 1,
      foods: [{
        id: 'f', name: 'F',
        kcalPer100g: 1, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0,
        createdAt: '', deletedAt: null,
      }],
      entries: [],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects an entry with empty-string date', () => {
    const r = parseImport(JSON.stringify({
      version: 1, foods: [],
      entries: [{ id: 'e', date: '', foodId: 'x', grams: 10, loggedAt: '2026-05-23T10:00:00Z' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects an entry with empty-string loggedAt', () => {
    const r = parseImport(JSON.stringify({
      version: 1, foods: [],
      entries: [{ id: 'e', date: '2026-05-23', foodId: 'x', grams: 10, loggedAt: '' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects empty input', () => {
    const r = parseImport('');
    expect(r.kind).to.equal('error');
  });

  it('accepts a state with entries that reference unknown foodIds (no referential check)', () => {
    const orphaned = {
      version: 2,
      foods: [],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'ghost', amount: 100, unit: 'g', grams: 100, loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const r = parseImport(JSON.stringify(orphaned));
    expect(r.kind).to.equal('ok');
  });

  it('migrates a v1 export to v2 on import', () => {
    const v1 = {
      version: 1,
      foods: [{ id: 'f', name: 'F', kcalPer100g: 100, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, createdAt: 'x', deletedAt: null }],
      entries: [{ id: 'e', date: '2026-05-23', foodId: 'f', grams: 80, loggedAt: 'y' }],
    };
    const r = parseImport(JSON.stringify(v1));
    expect(r.kind).to.equal('ok');
    if (r.kind === 'ok') {
      expect(r.state.version).to.equal(2);
      expect(r.state.foods[0]).to.include({ primaryUnit: 'g', weightPerUnit: 100 });
      expect(r.state.entries[0]).to.include({ amount: 80, unit: 'g', grams: 80 });
    }
  });

  it('accepts a state with a soft-deleted food', () => {
    const s: State = freshState();
    s.foods = s.foods.map((f, i) => i === 0 ? { ...f, deletedAt: '2026-05-22T00:00:00Z' } : f);
    const r = parseImport(exportState(s));
    expect(r.kind).to.equal('ok');
  });
});
