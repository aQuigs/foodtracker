import { expect } from '@esm-bundle/chai';
import { filesDigest, type NamedBytes } from '../../scripts/filesDigest.js';

function file(path: string, text: string): NamedBytes {
  return { path, bytes: new TextEncoder().encode(text) };
}

describe('filesDigest()', () => {
  it('is a sha256 hex digest that ignores the order files are listed in', async () => {
    const a = file('a.json', '[1]');
    const b = file('b/c.json', '[2]');

    const digest = await filesDigest([a, b]);

    expect(digest).to.match(/^[0-9a-f]{64}$/);
    expect(await filesDigest([b, a])).to.equal(digest);
  });

  it('changes when a file is renamed, edited, or a byte moves across a file boundary', async () => {
    const digest = await filesDigest([file('a.json', 'ab'), file('b.json', 'c')]);

    expect(await filesDigest([file('x.json', 'ab'), file('b.json', 'c')])).to.not.equal(digest);
    expect(await filesDigest([file('a.json', 'ab'), file('b.json', 'd')])).to.not.equal(digest);
    expect(await filesDigest([file('a.json', 'a'), file('b.json', 'bc')])).to.not.equal(digest);
  });
});
