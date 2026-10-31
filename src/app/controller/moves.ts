/**
 * Moves in the order they were made. A move made while the one before it is still being sent
 * (and saved) waits for it instead of being dropped: quick taps on the Pexeso cards or the fish
 * in a net all count. Each move runs only after every earlier one has finished, whether that one
 * succeeded or failed, and a failed move's error goes to its own caller alone.
 */
export interface MoveQueue<T> {
  /** Run `item` after every earlier item; resolves with what the run returned. */
  push(item: T): Promise<boolean>;
  /** Items pushed and not finished yet (including the one running). */
  pending(): number;
}

export function createMoveQueue<T>(run: (item: T) => Promise<boolean>): MoveQueue<T> {
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  return {
    push(item) {
      pending++;
      const result = tail.then(async () => {
        try {
          return await run(item);
        } finally {
          pending--;
        }
      });
      tail = result.catch(() => undefined);
      return result;
    },
    pending: () => pending,
  };
}
