import { expect } from '@esm-bundle/chai';
import { sharedLoad } from '../../src/domain/sharedLoad.js';
import { rejectionOf } from '../promises.js';

function counted<T>(results: Array<() => Promise<T>>) {
  let starts = 0;
  const start = (): Promise<T> => results[starts++]!();
  return { start, starts: () => starts };
}

describe('sharedLoad()', () => {
  it('starts nothing until asked, then hands every caller the one attempt', async () => {
    const load = counted([async () => 'a']);
    const shared = sharedLoad(load.start);
    expect(load.starts()).to.equal(0);

    const first = shared.get();
    expect(shared.get()).to.equal(first);
    expect(await first).to.equal('a');
    expect(await shared.get()).to.equal('a');
    expect(load.starts()).to.equal(1);
  });

  it('forgets a failed attempt, so the next caller tries again', async () => {
    const load = counted([async () => { throw new Error('offline'); }, async () => 'b']);
    const shared = sharedLoad(load.start);

    expect((await rejectionOf(shared.get())).message).to.equal('offline');
    expect(await shared.get()).to.equal('b');
    expect(load.starts()).to.equal(2);
  });

  it('reset() hands back the kept attempt and forgets it; a late failure of that attempt leaves the next one alone', async () => {
    let fail!: (e: Error) => void;
    const load = counted([() => new Promise<string>((_, reject) => { fail = reject; }), async () => 'c']);
    const shared = sharedLoad(load.start);

    const first = shared.get();
    expect(shared.reset()).to.equal(first);
    expect(shared.reset()).to.equal(null);

    const second = shared.get();
    fail(new Error('late'));
    await rejectionOf(first);

    expect(shared.get()).to.equal(second);
    expect(await second).to.equal('c');
  });
});
