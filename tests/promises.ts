// Promise helpers with no app imports, so tests of code that runs outside
// the app (the service worker) can use them without pulling the app in.
export async function rejectionOf(p: Promise<unknown>): Promise<Error> {
  try {
    await p;
  } catch (e) {
    return e as Error;
  }

  throw new Error('expected the promise to reject');
}
