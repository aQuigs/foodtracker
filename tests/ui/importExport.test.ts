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

  it('rejects an entry with non-positive amount', () => {
    const r = parseImport(JSON.stringify({
      version: 3, foods: [],
      entries: [{ id: 'e', date: '2026-05-23', foodId: 'x', amount: 0, unit: 'g', loggedAt: 'x' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects a food with empty-string createdAt', () => {
    const r = parseImport(JSON.stringify({
      version: 3,
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
      version: 3, foods: [],
      entries: [{ id: 'e', date: '', foodId: 'x', amount: 10, unit: 'g', loggedAt: '2026-05-23T10:00:00Z' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects an entry with empty-string loggedAt', () => {
    const r = parseImport(JSON.stringify({
      version: 3, foods: [],
      entries: [{ id: 'e', date: '2026-05-23', foodId: 'x', amount: 10, unit: 'g', loggedAt: '' }],
    }));
    expect(r.kind).to.equal('error');
  });

  it('rejects empty input', () => {
    const r = parseImport('');
    expect(r.kind).to.equal('error');
  });

  it('accepts a state with entries that reference unknown foodIds (no referential check)', () => {
    const orphaned = {
      version: 3,
      foods: [],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'ghost', amount: 100, unit: 'g', loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const r = parseImport(JSON.stringify(orphaned));
    expect(r.kind).to.equal('ok');
  });

  it('accepts a v1 export and migrates it to v3 (g, servingSize=100)', () => {
    const v1 = {
      version: 1,
      foods: [{
        id: 'f1', name: 'Banana',
        nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
        createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
      }],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'f1', grams: 120, loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const r = parseImport(JSON.stringify(v1));
    expect(r.kind).to.equal('ok');
    if (r.kind !== 'ok') return;
    expect(r.state.version).to.equal(3);
    expect(r.state.foods[0]).to.deep.include({ servingSize: 100, servingUnit: 'g' });
    expect(r.state.entries[0]).to.deep.include({ amount: 120, unit: 'g' });
  });

  it('accepts a v2 export and migrates it to v3 (g-food unchanged)', () => {
    const v2 = {
      version: 2,
      foods: [{
        id: 'f1', name: 'Banana',
        nutritionFacts: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
        primaryUnit: 'g', weightPerUnit: 100,
        createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
      }],
      entries: [{ id: 'e1', date: '2026-05-23', foodId: 'f1', amount: 120, unit: 'g', grams: 120, loggedAt: '2026-05-23T10:00:00Z' }],
    };
    const r = parseImport(JSON.stringify(v2));
    expect(r.kind).to.equal('ok');
    if (r.kind !== 'ok') return;
    expect(r.state.version).to.equal(3);
    expect(r.state.foods[0]).to.deep.include({ servingSize: 100, servingUnit: 'g' });
    expect(r.state.foods[0]!.nutritionFacts.calories).to.equal(89);
    expect(r.state.entries[0]).to.deep.include({ amount: 120, unit: 'g' });
  });

  it('migrates a v2 count-food by scaling per-100g nutrition to per-piece', () => {
    const v2 = {
      version: 2,
      foods: [{
        id: 'egg', name: 'Egg',
        nutritionFacts: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
        primaryUnit: 'count', weightPerUnit: 50,
        createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
      }],
      entries: [],
    };
    const r = parseImport(JSON.stringify(v2));
    expect(r.kind).to.equal('ok');
    if (r.kind !== 'ok') return;
    const f = r.state.foods[0]!;
    expect(f.servingSize).to.equal(1);
    expect(f.servingUnit).to.equal('count');
    expect(f.nutritionFacts.calories).to.be.closeTo(77.5, 1e-6);
    expect(f.nutritionFacts.protein).to.be.closeTo(6.5, 1e-6);
  });

  it('migrates a v2 g-entry on a count food to a count-entry using weightPerUnit (preserves calorie history)', () => {
    const v2 = {
      version: 2,
      foods: [{
        id: 'egg', name: 'Egg',
        nutritionFacts: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
        primaryUnit: 'count', weightPerUnit: 50,
        createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
      }],
      entries: [
        { id: 'e1', date: '2026-05-23', foodId: 'egg', amount: 50, unit: 'g', grams: 50, loggedAt: '2026-05-23T10:00:00Z' },
      ],
    };
    const r = parseImport(JSON.stringify(v2));
    expect(r.kind).to.equal('ok');
    if (r.kind !== 'ok') return;
    expect(r.state.entries[0]).to.deep.include({ amount: 1, unit: 'count' });
  });

  it('accepts a state with a soft-deleted food', () => {
    const s: State = freshState();
    s.foods = s.foods.map((f, i) => i === 0 ? { ...f, deletedAt: '2026-05-22T00:00:00Z' } : f);
    const r = parseImport(exportState(s));
    expect(r.kind).to.equal('ok');
  });
});
