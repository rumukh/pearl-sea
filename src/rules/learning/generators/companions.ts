/**
 * Companion words for problems that show several words (odd-one-out sets, relation options): the
 * lexicon words a skill's word filter selects, and the words a set may not show because another
 * lexicon word is written the same (a homograph would make a set ambiguous).
 */
import type { DeepReadonly } from '@aegis/runtime';
import { DEFAULT_REGISTERS, matchesWordFilter } from '../../contract';
import type { Word, WordFilter } from '../../contract';
import { lexiconIndex, perPack } from '../index-cache';
import type { Data } from '../../types';

type Read<T> = DeepReadonly<T>;

const selections: (data: Data) => Map<string, Read<Word>[]> = perPack(() => new Map());

/** The words a skill's filter selects (cached per pack and skill), in lexicon order. */
export function skillWords(data: Data, skill: string, filter: Read<WordFilter>): Read<Word>[] {
  const cache = selections(data);
  let words = cache.get(skill);
  if (words === undefined) {
    const families = lexiconIndex(data).families;
    words = data.lexicon.words.filter((word) => matchesWordFilter(word, filter, families));
    cache.set(skill, words);
  }
  return words;
}

/**
 * Whether a word may be shown by a skill although its filter does not select it (a family member,
 * a relation partner, a tempting option): it keeps to the filter's registers (standard Czech unless
 * a register skill names colloquial, contract §8) and grades.
 */
export function suits(word: Read<Word>, filter: Read<WordFilter>): boolean {
  return (
    (filter.registers ?? DEFAULT_REGISTERS).includes(word.register ?? 'standard') &&
    (filter.grades === undefined || filter.grades.includes(word.grade))
  );
}

/** Lemmas written by more than one lexicon word (homographs such as two senses of one word). */
export const sharedLemmas: (data: Data) => ReadonlySet<string> = perPack((data) => {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const word of data.lexicon.words) {
    const key = word.lemma.toLowerCase();
    if (seen.has(key)) shared.add(key);
    seen.add(key);
  }
  return shared;
});

/** Whether a word can stand in a set of words without being read as another word. */
export function unambiguous(data: Data, word: Read<Word>): boolean {
  return !sharedLemmas(data).has(word.lemma.toLowerCase());
}

/** Whether two families share a root (`kin`, listed on either side). */
export function kinFamilies(data: Data, a: string, b: string): boolean {
  const families = lexiconIndex(data).families;
  return (
    a === b ||
    (families.get(a)?.kin.includes(b) ?? false) ||
    (families.get(b)?.kin.includes(a) ?? false)
  );
}
