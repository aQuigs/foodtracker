import type { ShellManifest } from '../src/sw/routing.js';
import { byPath, filesDigest, type NamedBytes } from './filesDigest.js';

export type ShellFile = NamedBytes;

// Source maps are for devtools, not for running the app offline.
function isShell(file: ShellFile): boolean {
  return !file.path.endsWith('.map');
}

export async function shellManifest(base: string, files: ShellFile[]): Promise<ShellManifest> {
  const shell = files.filter(isShell).sort(byPath);
  const hash = (await filesDigest(shell)).slice(0, 8);

  return { base, paths: shell.map((f) => base + f.path), hash };
}

// The build refuses a worker that cannot boot the app: a plugin hook that
// ran before Vite emitted the document or the bundle would leave them out
// with every test still green, and a path listed twice makes the install's
// addAll reject as one batch.
export function assertBootable(shell: ShellManifest, assetsDir: string): void {
  const missing: string[] = [];

  if (!shell.paths.includes(`${shell.base}index.html`)) {
    missing.push('index.html');
  }

  if (!shell.paths.some((path) => path.startsWith(`${shell.base}${assetsDir}/`) && path.endsWith('.js'))) {
    missing.push('the app bundle');
  }

  if (missing.length > 0) {
    throw new Error(`service worker shell is missing ${missing.join(' and ')}`);
  }

  if (new Set(shell.paths).size !== shell.paths.length) {
    throw new Error('service worker shell lists a path twice: a public/ file shares its name with a build output');
  }
}
