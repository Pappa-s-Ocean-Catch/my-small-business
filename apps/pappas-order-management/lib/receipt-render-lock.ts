// Render/capture is serialized separately from transmission, so snapshots can
// release the shared view before a slow printer finishes.
const tails = new Map<string, Promise<void>>();
export async function acquireReceiptRender(surface: string): Promise<() => void> {
  const previous = tails.get(surface) ?? Promise.resolve();
  let unlock = () => {};
  const gate = new Promise<void>((resolve) => { unlock = resolve; });
  const tail = previous.then(() => gate);
  tails.set(surface, tail);
  await previous;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    unlock();
    if (tails.get(surface) === tail) tails.delete(surface);
  };
}
