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
    const r = parseImport(exportState(before));
    expect(r).to.deep.equal({ kind: 'ok', state: before });
  });

  it('rejects malformed JSON', () => {
    expect(parseImport('not json {{').kind).to.equal('error');
  });

  it('rejects state with the wrong shape', () => {
    expect(parseImport(JSON.stringify({ unrelated: true })).kind).to.equal('error');
  });

  it('rejects an entry with non-positive amount', () => {
    const r = parseImport(JSON.stringify({
      version: 1, foods: [],
      entries: [{ id: 'e', date: '2026-05-23', foodId: 'x', amount: 0, unit: 'g', loggedAt: 'x' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects a food with empty-string createdAt', () => {
    const r = parseImport(JSON.stringify({
      version: 1,
      foods: [{
        id: 'f', name: 'F',
        nutritionFacts: { calories: 1, protein: 0, carbs: 0, fat: 0 },
        servingSize: 100, servingUnit: 'g',
        createdAt: '', deletedAt: null,
      }],
      entries: [],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects an entry with empty-string date', () => {
    const r = parseImport(JSON.stringify({
      version: 1, foods: [],
      entries: [{ id: 'e', date: '', foodId: 'x', amount: 10, unit: 'g', loggedAt: '2026-05-23T10:00:00Z' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects an entry with empty-string loggedAt', () => {
    const r = parseImport(JSON.stringify({
      version: 1, foods: [],
      entries: [{ id: 'e', date: '2026-05-23', foodId: 'x', amount: 10, unit: 'g', loggedAt: '' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects empty input', () => {
    expect(parseImport('').kind).to.equal('error');
  });

  it('accepts a state with entries that reference unknown foodIds (no referential check)', () => {
    const r = parseImport(JSON.stringify({
      version: 1, foods: [],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'ghost', amount: 100, unit: 'g', loggedAt: '2026-05-23T10:00:00Z' }],
    }));
    expect(r.kind).to.equal('ok');
  });

  it('accepts a state with a soft-deleted food', () => {
    const s: State = freshState();
    s.foods = s.foods.map((f, i) => i === 0 ? { ...f, deletedAt: '2026-05-22T00:00:00Z' } : f);
    expect(parseImport(exportState(s)).kind).to.equal('ok');
  });
});
