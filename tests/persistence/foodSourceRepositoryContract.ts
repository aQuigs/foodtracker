import { expect } from '@esm-bundle/chai';
import type { FoodSourceRepository } from '../../src/persistence/foodSourceRepository.js';
import type { SourcedFood, FoodSourceManifest, SearchOptions } from '../../src/domain/types.js';
import { rejectionOf } from '../_helpers.js';

const usda = (id: string, name: string, tags?: string[]): SourcedFood => ({
  id,
  name,
  nutritionFacts: { calories: 100, protein: 5, carbs: 10, fat: 2 },
  servingSize: 100,
  servingUnit: 'g',
  source: 'usda',
  sourceId: id,
  ...(tags ? { tags } : {}),
});

const usdaManifest = (version = 'v1', itemCount = 0): FoodSourceManifest => ({
  source: 'usda',
  version,
  itemCount,
  sha256: 'a'.repeat(64),
  generatedAt: '2026-05-28T00:00:00.000Z',
});

export type ContractFactoryResult = {
  repo: FoodSourceRepository;
  cleanup?: () => Promise<void>;
};

export function describeFoodSourceRepositoryContract(
  name: string,
  makeRepo: () => Promise<ContractFactoryResult>,
) {
  describe(`${name} (FoodSourceRepository contract)`, () => {
    let repo: FoodSourceRepository;
    let cleanup: (() => Promise<void>) | undefined;

    beforeEach(async () => {
      const r = await makeRepo();
      repo = r.repo;
      cleanup = r.cleanup;
    });

    afterEach(async () => {
      if (cleanup) {
        await cleanup();
      }
    });

    const names = async (query: string): Promise<string[]> =>
      (await repo.search(query, { limit: 10 })).map((r) => r.name);

    describe('currentVersion()', () => {
      it('returns null when empty', async () => {
        expect(await repo.currentVersion('usda')).to.equal(null);
      });

      it('reflects the manifest version after hydrate', async () => {
        await repo.hydrate('usda', [usda('a', 'Apple')], usdaManifest('v7', 1));
        expect(await repo.currentVersion('usda')).to.equal('v7');
      });

      it('per-source isolation: hydrating one source does not affect another', async () => {
        await repo.hydrate('usda', [usda('a', 'Apple')], usdaManifest('v1', 1));
        expect(await repo.currentVersion('pantry')).to.equal(null);
      });
    });

    describe('hydrate()', () => {
      it('stores items so search() can find them', async () => {
        await repo.hydrate('usda', [usda('apple-1', 'Apple')], usdaManifest('v1', 1));
        expect(await names('apple')).to.deep.equal(['Apple']);
      });

      it('rejects when manifest.source does not match the source argument', async () => {
        const e = await rejectionOf(repo.hydrate('usda', [usda('a', 'Apple')],
          { ...usdaManifest('v1', 1), source: 'pantry' }));
        expect(e.message).to.match(/manifest\.source/);
        expect(await repo.currentVersion('usda')).to.equal(null);
      });

      it('re-hydrating the same source replaces its prior contents', async () => {
        await repo.hydrate('usda', [usda('a', 'Apple'), usda('b', 'Banana')], usdaManifest('v1', 2));
        await repo.hydrate('usda', [usda('c', 'Cherry')], usdaManifest('v2', 1));
        expect(await names('apple')).to.deep.equal([]);
        expect(await names('banana')).to.deep.equal([]);
        expect(await names('cherry')).to.deep.equal(['Cherry']);
        expect(await repo.currentVersion('usda')).to.equal('v2');
      });

      it('re-hydrating one source does not touch another source', async () => {
        await repo.hydrate('usda',   [usda('a', 'Apple')],  usdaManifest('v1', 1));
        await repo.hydrate('pantry', [{ ...usda('p', 'Pantry item'), source: 'pantry', sourceId: 'p' }],
          { ...usdaManifest('v1', 1), source: 'pantry' });

        await repo.hydrate('usda', [usda('b', 'Banana')], usdaManifest('v2', 1));
        expect(await repo.currentVersion('pantry')).to.equal('v1');
        expect(await names('pantry')).to.deep.equal(['Pantry item']);
      });

      it('rejects when an item\'s source does not match the source argument', async () => {
        const e = await rejectionOf(repo.hydrate('usda',
          [usda('a', 'Apple'), { ...usda('b', 'Banana'), source: 'pantry' }],
          usdaManifest('v1', 2)));
        expect(e.message).to.match(/source/);
        expect(await repo.currentVersion('usda')).to.equal(null);
        expect(await names('apple')).to.deep.equal([]);
      });
    });

    describe('search()', () => {
      beforeEach(async () => {
        await repo.hydrate('usda', [
          usda('a', 'Apple'),
          usda('b', 'Banana'),
          usda('c', 'Blueberry'),
          usda('d', 'Cherry'),
        ], usdaManifest('v1', 4));
      });

      it('returns items matching the query (case-insensitive substring)', async () => {
        const results = await repo.search('app', { limit: 10 });
        expect(results.map((r) => r.name)).to.include('Apple');
      });

      it('matches every whitespace token in any order (not one contiguous run)', async () => {
        await repo.hydrate('usda', [
          usda('g', 'Yogurt, Greek, plain, nonfat'),
          usda('s', 'Greek salad'),
        ], usdaManifest('v2', 2));

        const results = await repo.search('greek yogurt', { limit: 10 });
        expect(results.map((r) => r.name)).to.deep.equal(['Yogurt, Greek, plain, nonfat']);
      });

      it('respects the limit', async () => {
        const results = await repo.search('b', { limit: 1 });
        expect(results).to.have.lengthOf(1);
      });

      it('limit 0 returns no results', async () => {
        const results = await repo.search('a', { limit: 0 });
        expect(results).to.have.lengthOf(0);
      });

      it('omitting limit returns every match', async () => {
        const results = await repo.search('a', {});
        expect(results.map((r) => r.name)).to.deep.equal(['Apple', 'Banana']);
      });

      it('orders by lowercased name, ties broken by id, limit applied after ordering', async () => {
        await repo.hydrate('usda', [
          usda('b', 'banana'),
          usda('x2', 'apple'),
          usda('a', 'Apricot'),
          usda('x1', 'APPLE'),
        ], usdaManifest('v2', 4));

        const all = await repo.search('a', { limit: 10 });
        expect(all.map((r) => r.id)).to.deep.equal(['x1', 'x2', 'a', 'b']);

        const first = await repo.search('a', { limit: 2 });
        expect(first.map((r) => r.id)).to.deep.equal(['x1', 'x2']);
      });

      it('orders by the folded key, so an accented name sorts as its plain spelling', async () => {
        // By raw code units 'é' (0xE9) sorts after 'f'; folded, 'cafe' < 'caffeine'.
        await repo.hydrate('usda', [
          usda('e2', 'Caffeine'),
          usda('e1', 'Café'),
        ], usdaManifest('v2', 2));

        const results = await repo.search('caf', { limit: 10 });
        expect(results.map((r) => r.id)).to.deep.equal(['e1', 'e2']);
      });

      it('matches accent-insensitively: a plain-keyboard query reaches an accented name', async () => {
        await repo.hydrate('usda', [
          usda('j', 'Jalapeños (canned)'),
          usda('g', 'Gruyère cheese'),
          usda('p', 'Pickled jalapeno relish'),
        ], usdaManifest('v2', 3));

        expect(await names('jalapeno')).to.deep.equal(['Jalapeños (canned)', 'Pickled jalapeno relish']);
        expect(await names('gruyere')).to.deep.equal(['Gruyère cheese']);
      });

      it('matches accent-insensitively: an accented query reaches a plain name', async () => {
        await repo.hydrate('usda', [
          usda('c', 'Creme brulee'),
          usda('m', 'Crème de menthe'),
        ], usdaManifest('v2', 2));

        expect(await names('crème')).to.deep.equal(['Creme brulee', 'Crème de menthe']);
      });

      it('empty query matches nothing (caller is expected to handle prompts)', async () => {
        const results = await repo.search('', { limit: 10 });
        expect(results).to.have.lengthOf(0);
      });

      it('returns empty when nothing matches', async () => {
        const results = await repo.search('zzzzzz', { limit: 10 });
        expect(results).to.have.lengthOf(0);
      });

      describe('with sources filter', () => {
        beforeEach(async () => {
          await repo.hydrate('pantry', [
            { ...usda('p1', 'Apple from pantry'), source: 'pantry', sourceId: 'p1' },
          ], { ...usdaManifest('v1', 1), source: 'pantry' });
        });

        it('omitted -> includes all sources', async () => {
          const results = await repo.search('apple', { limit: 10 });
          const sources = new Set(results.map((r) => r.source));
          expect(sources.has('usda')).to.equal(true);
          expect(sources.has('pantry')).to.equal(true);
        });

        it('restricts results to listed sources', async () => {
          const results = await repo.search('apple', { limit: 10, sources: ['usda'] });
          expect(results.every((r) => r.source === 'usda')).to.equal(true);
        });

        it('empty sources array -> no results', async () => {
          const results = await repo.search('apple', { limit: 10, sources: [] });
          expect(results).to.have.lengthOf(0);
        });
      });

      describe('with tags filter (no-op pass-through)', () => {
        it('accepts include and exclude lists', async () => {
          const opts: SearchOptions = {
            limit: 10,
            tags: { include: ['ignored'], exclude: ['also-ignored'] },
          };
          const results = await repo.search('apple', opts);
          expect(results).to.be.an('array');
        });

        it('returns the same results as an unfiltered query', async () => {
          const unfiltered = await repo.search('apple', { limit: 10 });
          const filtered = await repo.search('apple', {
            limit: 10,
            tags: { include: ['ignored'], exclude: ['also-ignored'] },
          });
          expect(filtered.map((r) => r.id)).to.deep.equal(unfiltered.map((r) => r.id));
        });
      });
    });
  });
}
