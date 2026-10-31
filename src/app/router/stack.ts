/**
 * The screen stack: an in-memory history the shell controls. Play never relies on the browser's
 * history or Back button; screens offer an explicit Back, and the root cannot be popped.
 */
export interface ScreenStack<T> {
  current(): T;
  depth(): number;
  entries(): readonly T[];
  /** The entry Back would return to, or undefined at the root. */
  previous(): T | undefined;
  push(entry: T): void;
  replace(entry: T): void;
  /** Pop and return the new current entry, or undefined (and no change) at the root. */
  back(): T | undefined;
  /**
   * The nearest entry from the top that matches, after popping everything above it; undefined
   * (and no change) when none matches.
   */
  popTo(match: (entry: T) => boolean): T | undefined;
  reset(entry: T): void;
}

export const MAX_DEPTH = 32;

export function createScreenStack<T>(root: T): ScreenStack<T> {
  const stack: T[] = [root];
  return {
    current: () => stack[stack.length - 1]!,
    depth: () => stack.length,
    entries: () => [...stack],
    previous: () => (stack.length > 1 ? stack[stack.length - 2] : undefined),
    push(entry) {
      if (stack.length >= MAX_DEPTH) stack.splice(1, 1);
      stack.push(entry);
    },
    replace(entry) {
      stack[stack.length - 1] = entry;
    },
    back() {
      if (stack.length <= 1) return undefined;
      stack.pop();
      return stack[stack.length - 1];
    },
    popTo(match) {
      for (let index = stack.length - 1; index >= 0; index--) {
        if (!match(stack[index]!)) continue;
        stack.length = index + 1;
        return stack[index];
      }
      return undefined;
    },
    reset(entry) {
      stack.length = 0;
      stack.push(entry);
    },
  };
}
