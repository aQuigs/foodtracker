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
      entries: [{ id: 'e', date: '2026-05-23', foodId: 'x', amount: 0, unit: 'g', grams: 0, loggedAt: 'x' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects a food with empty-string createdAt', () => {
    const r = parseImport(JSON.stringify({
      version: 2,
      foods: [{
        id: 'f', name: 'F',
        nutritionFacts: { calories: 1, protein: 0, carbs: 0, fat: 0 },
        primaryUnit: 'g', weightPerUnit: 100,
        createdAt: '', deletedAt: null,
      }],
      entries: [],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects an entry with empty-string date', () => {
    const r = parseImport(JSON.stringify({
      version: 2, foods: [],
      entries: [{ id: 'e', date: '', foodId: 'x', amount: 10, unit: 'g', grams: 10, loggedAt: '2026-05-23T10:00:00Z' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects an entry with empty-string loggedAt', () => {
    const r = parseImport(JSON.stringify({
      version: 2, foods: [],
      entries: [{ id: 'e', date: '2026-05-23', foodId: 'x', amount: 10, unit: 'g', grams: 10, loggedAt: '' }],
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

  it('accepts a state with a soft-deleted food', () => {
    const s: State = freshState();
    s.foods = s.foods.map((f, i) => i === 0 ? { ...f, deletedAt: '2026-05-22T00:00:00Z' } : f);
    const r = parseImport(exportState(s));
    expect(r.kind).to.equal('ok');
  });
});
