import { expect } from '@esm-bundle/chai';
import { shellManifest } from '../../scripts/shellManifest.js';
import type { ShellFile } from '../../scripts/shellManifest.js';

function file(path: string, text: string): ShellFile {
  return { path, bytes: new TextEncoder().encode(text) };
}

const FILES: ShellFile[] = [
  file('index.html', '<!doctype html>'),
  file('assets/index-abc123.js', 'console.log(1)'),
  file('assets/index-abc123.js.map', '{}'),
  file('manifest.webmanifest', '{}'),
];

describe('shellManifest', () => {
  it('lists every file under the base, sorted, without source maps', async () => {
    const { base, paths } = await shellManifest('/foodtracker/', FILES);

    expect(base).to.equal('/foodtracker/');
    expect(paths).to.deep.equal([
      '/foodtracker/assets/index-abc123.js',
      '/foodtracker/index.html',
      '/foodtracker/manifest.webmanifest',
    ]);
  });

  it('hashes content, not order or source maps', async () => {
    const a = await shellManifest('/', FILES);
    const reordered = await shellManifest('/', [...FILES].reverse());
    const noMap = await shellManifest('/', FILES.filter((f) => !f.path.endsWith('.map')));

    expect(a.hash).to.match(/^[0-9a-f]{8}$/);
    expect(reordered.hash).to.equal(a.hash);
    expect(noMap.hash).to.equal(a.hash);
  });

  it('changes the hash when any file changes, even one with a stable name', async () => {
    const a = await shellManifest('/', FILES);
    const edited = await shellManifest('/', FILES.map((f) => (f.path === 'index.html' ? file(f.path, '<!doctype html><title>x') : f)));
    const renamed = await shellManifest('/', FILES.map((f) => (f.path === 'index.html' ? file('home.html', '<!doctype html>') : f)));

    expect(edited.hash).to.not.equal(a.hash);
    expect(renamed.hash).to.not.equal(a.hash);
  });
});
