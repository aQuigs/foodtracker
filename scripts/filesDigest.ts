export type NamedBytes = {
  path: string;
  bytes: Uint8Array;
};

const ENCODER = new TextEncoder();
const NUL = new Uint8Array([0]);

// Codepoint order, not locale order: the sort feeds the hash, and every
// machine that builds the same files must get the same digest.
export function byPath(a: NamedBytes, b: NamedBytes): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

// Path and bytes, each NUL-terminated, so a rename and an edit both change
// the hash and no boundary between files is ambiguous.
function frame(files: NamedBytes[]): Uint8Array<ArrayBuffer> {
  const parts = files.flatMap((f) => [ENCODER.encode(f.path), NUL, f.bytes, NUL]);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));

  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}

export async function filesDigest(files: NamedBytes[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', frame([...files].sort(byPath)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
