import type { ShellManifest } from '../src/sw/routing.js';

export type ShellFile = {
  path: string;
  bytes: Uint8Array;
};

const ENCODER = new TextEncoder();
const NUL = new Uint8Array([0]);

// Source maps are for devtools, not for running the app offline.
function isShell(file: ShellFile): boolean {
  return !file.path.endsWith('.map');
}

// Codepoint order, not locale order: the sort feeds the hash, and every
// machine that builds the same files must name the same cache.
function byPath(a: ShellFile, b: ShellFile): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

// Path and bytes, each NUL-terminated, so a rename and an edit both change
// the hash and no boundary between files is ambiguous.
function frame(files: ShellFile[]): Uint8Array<ArrayBuffer> {
  const parts = files.flatMap((f) => [ENCODER.encode(f.path), NUL, f.bytes, NUL]);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));

  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}

export async function shellManifest(base: string, files: ShellFile[]): Promise<ShellManifest> {
  const shell = files.filter(isShell).sort(byPath);
  const digest = await crypto.subtle.digest('SHA-256', frame(shell));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8);

  return { base, paths: shell.map((f) => base + f.path), hash };
}
