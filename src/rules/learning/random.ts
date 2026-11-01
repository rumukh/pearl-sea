/** Seeded helpers on the runtime's random streams. */
import type { RandomStream } from '@aegis/runtime';

/** A seeded Fisher-Yates shuffle. */
export function shuffle<T>(items: readonly T[], random: RandomStream): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random.int(0, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** `count` items drawn without repetition, in draw order. */
export function sample<T>(items: readonly T[], count: number, random: RandomStream): T[] {
  return shuffle(items, random).slice(0, Math.max(0, count));
}
