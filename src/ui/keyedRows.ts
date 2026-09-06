export type KeyedRows<T> = {
  get(key: string): T;
  prune(keep: Iterable<string>): void;
};

// Get-or-create plus a prune step, shared by every DOM factory that keys its
// rows by an id and reuses them across renders (rather than rebuilding),
// so a focused input or an open state doesn't drop out from under the user
// on the render each keystroke or click triggers.
export function keyedRows<T>(create: (key: string) => T): KeyedRows<T> {
  const rows = new Map<string, T>();

  function get(key: string): T {
    let row = rows.get(key);
    if (row === undefined) {
      row = create(key);
      rows.set(key, row);
    }

    return row;
  }

  function prune(keep: Iterable<string>): void {
    const keepSet = keep instanceof Set ? keep : new Set(keep);
    for (const key of rows.keys()) {
      if (!keepSet.has(key)) {
        rows.delete(key);
      }
    }
  }

  return { get, prune };
}
