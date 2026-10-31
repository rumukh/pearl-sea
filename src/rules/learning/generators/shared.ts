/**
 * What every problem generator shares: the sources it may draw from.
 */
import type { RandomStream } from '@aegis/runtime';
import type { Data } from '../../types';

/**
 * Where a generator draws from. `problems` decides items, shapes and the carrying sentences;
 * `distractors` the options and their order; `words` the companion words (odd sets, fish, family
 * neighbours, fillers). Nothing else is random, so the same streams and content always give the
 * same problem.
 */
export interface GeneratorSources {
  readonly problems: RandomStream;
  readonly distractors: RandomStream;
  readonly words: RandomStream;
  readonly data: Data;
  /** Choice options of a gap whose skill does not set them (the grade's `balance.input.choices`). */
  readonly choices: number;
}

/** The error for an item the skill can never produce (a caller bug or invalid content). */
export function cannotPractise(generator: string, item: string): Error {
  return new Error(`Generator ${generator} cannot practise ${item}.`);
}
