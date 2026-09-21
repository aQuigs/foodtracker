// One load every caller shares: started on the first need, kept once it
// succeeds, and forgotten when it fails, so the next need tries again.
export type SharedLoad<T> = {
  get(): Promise<T>;
  // Forgets the kept attempt and hands it back, so the next get() starts over.
  reset(): Promise<T> | null;
};

export function sharedLoad<T>(start: () => Promise<T>): SharedLoad<T> {
  let kept: Promise<T> | null = null;

  return {
    get() {
      if (kept === null) {
        const attempt = start();
        kept = attempt;
        attempt.catch(() => {
          if (kept === attempt) {
            kept = null;
          }
        });
      }

      return kept;
    },
    reset() {
      const dropped = kept;
      kept = null;
      return dropped;
    },
  };
}
