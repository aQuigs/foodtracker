import { expect } from '@esm-bundle/chai';
import type { FoodSourceRepository } from '../../src/persistence/foodSourceRepository.js';
import type { SourcedFood, FoodSourceManifest, SearchOptions } from '../../src/domain/types.js';

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

    describe('isHydrated() / currentVersion()', () => {
      it('isHydrated(source) returns false when empty', async () => {
        expect(await repo.isHydrated('usda')).to.equal(false);
      });

      it('currentVersion(source) returns null when empty', async () => {
        expect(await repo.currentVersion('usda')).to.equal(null);
      });

      it('isHydrated(source) returns true after hydrate(source, ...)', async () => {
        await repo.hydrate('usda', [usda('a', 'Apple')], usdaManifest('v1', 1));
        expect(await repo.isHydrated('usda')).to.equal(true);
      });

      it('currentVersion(source) reflects the manifest version after hydrate', async () => {
        await repo.hydrate('usda', [usda('a', 'Apple')], usdaManifest('v7', 1));
        expect(await repo.currentVersion('usda')).to.equal('v7');
      });

      it('per-source isolation: hydrating one source does not affect another', async () => {
        await repo.hydrate('usda', [usda('a', 'Apple')], usdaManifest('v1', 1));
        expect(await repo.isHydrated('pantry')).to.equal(false);
        expect(await repo.currentVersion('pantry')).to.equal(null);
      });
    });

    describe('hydrate()', () => {
      it('stores items so getById() can retrieve them', async () => {
        await repo.hydrate('usda', [usda('apple-1', 'Apple')], usdaManifest('v1', 1));
        const found = await repo.getById('apple-1');
        expect(found?.name).to.equal('Apple');
      });

      it('rejects when manifest.source does not match the source argument', async () => {
        let threw = false;
        try {
          await repo.hydrate('usda', [usda('a', 'Apple')],
            { ...usdaManifest('v1', 1), source: 'pantry' });
        } catch (e) {
          threw = true;
          expect((e as Error).message).to.match(/manifest\.source/);
        }
        expect(threw).to.equal(true);
        expect(await repo.isHydrated('usda')).to.equal(false);
      });

      it('re-hydrating the same source replaces its prior contents', async () => {
        await repo.hydrate('usda', [usda('a', 'Apple'), usda('b', 'Banana')], usdaManifest('v1', 2));
        await repo.hydrate('usda', [usda('c', 'Cherry')], usdaManifest('v2', 1));
        expect(await repo.getById('a')).to.equal(null);
        expect(await repo.getById('b')).to.equal(null);
        expect((await repo.getById('c'))?.name).to.equal('Cherry');
        expect(await repo.currentVersion('usda')).to.equal('v2');
      });

      it('re-hydrating one source does not touch another source', async () => {
        await repo.hydrate('usda',   [usda('a', 'Apple')],  usdaManifest('v1', 1));
        await repo.hydrate('pantry', [{ ...usda('p', 'Pantry item'), source: 'pantry', sourceId: 'p' }],
          { ...usdaManifest('v1', 1), source: 'pantry' });

        await repo.hydrate('usda', [usda('b', 'Banana')], usdaManifest('v2', 1));
        expect(await repo.isHydrated('pantry')).to.equal(true);
        expect((await repo.getById('p'))?.name).to.equal('Pantry item');
      });
    });

    describe('clear()', () => {
      it('removes items for the named source only', async () => {
        await repo.hydrate('usda',   [usda('a', 'Apple')], usdaManifest('v1', 1));
        await repo.hydrate('pantry', [{ ...usda('p', 'Pantry'), source: 'pantry', sourceId: 'p' }],
          { ...usdaManifest('v1', 1), source: 'pantry' });

        await repo.clear('usda');
        expect(await repo.isHydrated('usda')).to.equal(false);
        expect(await repo.currentVersion('usda')).to.equal(null);
        expect(await repo.getById('a')).to.equal(null);
        expect(await repo.isHydrated('pantry')).to.equal(true);
        expect((await repo.getById('p'))?.name).to.equal('Pantry');
      });

      it('clearing an empty / unknown source is a no-op (no throw)', async () => {
        await repo.clear('never-hydrated');
        expect(await repo.isHydrated('never-hydrated')).to.equal(false);
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

      it('respects the limit', async () => {
        const results = await repo.search('b', { limit: 1 });
        expect(results).to.have.lengthOf(1);
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

    describe('getById()', () => {
      it('returns the item when present', async () => {
        await repo.hydrate('usda', [usda('a', 'Apple')], usdaManifest('v1', 1));
        const found = await repo.getById('a');
        expect(found?.name).to.equal('Apple');
        expect(found?.source).to.equal('usda');
      });

      it('returns null when missing', async () => {
        expect(await repo.getById('nope')).to.equal(null);
      });
    });

    describe('count()', () => {
      it('returns 0 when empty', async () => {
        expect(await repo.count()).to.equal(0);
      });

      it('total count across all sources when no arg', async () => {
        await repo.hydrate('usda',   [usda('a', 'Apple'), usda('b', 'Banana')], usdaManifest('v1', 2));
        await repo.hydrate('pantry', [{ ...usda('p', 'Pantry'), source: 'pantry', sourceId: 'p' }],
          { ...usdaManifest('v1', 1), source: 'pantry' });
        expect(await repo.count()).to.equal(3);
      });

      it('per-source count when source arg is given', async () => {
        await repo.hydrate('usda',   [usda('a', 'Apple'), usda('b', 'Banana')], usdaManifest('v1', 2));
        await repo.hydrate('pantry', [{ ...usda('p', 'Pantry'), source: 'pantry', sourceId: 'p' }],
          { ...usdaManifest('v1', 1), source: 'pantry' });
        expect(await repo.count('usda')).to.equal(2);
        expect(await repo.count('pantry')).to.equal(1);
      });

      it('count for an unknown source is 0', async () => {
        expect(await repo.count('never-hydrated')).to.equal(0);
      });
    });
  });
}
