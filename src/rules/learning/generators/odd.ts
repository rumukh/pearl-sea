/**
 * `odd-one-out` (design §5.7, curriculum §7.2): 3-6 words, usually 4, of which exactly one differs
 * on the skill's basis (a word dimension, the word family, or listed against not listed) and the
 * others share it. The drawn item's word is one of the words that belong: a `class:<basis>:<word>`
 * or `fam:<word>` item is trained by recognising its group (a word alone in its family is the odd
 * one beside another family instead).
 *
 * The companions are real lexicon words of the skill's filter (the `words` stream), never a word
 * written like another lexicon word. A family set takes the other members of the item's family
 * (those outside the filter last, and only of its registers and grades, companions.ts `suits`)
 * and never takes its odd word from a kin family (they share the root): the sound-alike family's
 * words first, then the same listed letter's. A listed set prefers words of the same letter, so
 * the difference is the listed word, not the letter. The shown order comes from `distractors`.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { parseItemId, wordDimensionValue } from '../../contract';
import type { Hint, ListedLetter, OddBasis, OddProblem, Skill, Word } from '../../contract';
import { lexiconIndex, perPack } from '../index-cache';
import { reflexiveClash, wordText } from '../item-info';
import { shuffle } from '../random';
import { kinFamilies, skillWords, suits, unambiguous } from './companions';
import { cannotPractise } from './shared';
import type { GeneratorSources } from './shared';
import type { Data } from '../../types';

type Read<T> = DeepReadonly<T>;
type OddSkill = DeepReadonly<Extract<Skill, { generator: 'odd-one-out' }>>;

const MIN_SIZE = 3;
const MAX_SIZE = 6;

/** The listed letter of a word's family, or `null`. */
function listedLetter(data: Data, word: Read<Word>): ListedLetter | null {
  const family = word.family ? lexiconIndex(data).families.get(word.family.id) : undefined;
  return family?.letter ?? null;
}

/**
 * A word's value on the basis: a dimension's value, its family, or whether it is listed. A word of
 * no family is not a listed word (every listed word is in its letter's family), unless its
 * spelling says it is one (a `vyjm` point): then the lexicon lacks its family and it is skipped.
 */
function basisValue(data: Data, word: Read<Word>, basis: OddBasis): string | null {
  if (basis === 'family') return word.family?.id ?? null;
  if (basis === 'listed') {
    if (word.family) return listedLetter(data, word) !== null ? 'listed' : 'not-listed';
    const listedPoint = (word.spelling ?? []).some(
      (point) => point.rule === 'vyjm' || point.rule === 'vyjm-prefix',
    );
    return listedPoint ? null : 'not-listed';
  }
  return wordDimensionValue(word, basis);
}

/** The word an odd-one-out item is about. */
function itemWord(data: Data, item: string, basis: OddBasis): Read<Word> | null {
  const parsed = parseItemId(item);
  let id: string | null = null;
  if (parsed?.kind === 'fam' && (basis === 'family' || basis === 'listed')) id = parsed.word;
  if (parsed?.kind === 'class' && parsed.dimension === basis && parsed.detail === null) {
    id = parsed.target;
  }
  return id === null ? null : (lexiconIndex(data).words.get(id) ?? null);
}

/**
 * The words a set can be made of: those that belong with the item's word and those that differ, in
 * preference tiers; or, for a word whose family has no other member (`alone`), a whole other
 * family that belongs together, the item's word being the odd one.
 */
interface Plan {
  word: Read<Word>;
  same: Read<Word>[][];
  odd: Read<Word>[][];
  alone: boolean;
}

const nonEmpty = (tiers: Read<Word>[][]) => tiers.filter((tier) => tier.length > 0);

/** For a word alone in its family: the other families' members that could make the set. */
function otherFamily(data: Data, family: string, pool: readonly Read<Word>[]): Read<Word>[][] {
  const byFamily = new Map<string, Read<Word>[]>();
  for (const w of pool) {
    const id = w.family!.id;
    if (kinFamilies(data, family, id)) continue;
    byFamily.set(id, [...(byFamily.get(id) ?? []), w]);
  }
  return [...byFamily.values()].filter((members) => members.length >= MIN_SIZE - 1);
}

/** A word a set may show, with its value on the skill's basis. */
interface Entry {
  word: Read<Word>;
  value: string;
  text: string;
}

const poolCache: (data: Data) => Map<string, Entry[]> = perPack(() => new Map());

/** The skill's words a set may show (never a homograph), with their basis values; cached. */
function basisPool(data: Data, skill: OddSkill): Entry[] {
  const cache = poolCache(data);
  let pool = cache.get(skill.id);
  if (pool === undefined) {
    pool = skillWords(data, skill.id, skill.params.words).flatMap((word) => {
      const basis = skill.params.basis;
      const shownAlone =
        unambiguous(data, word) && !(basis === 'reflexive' && reflexiveClash(data, word));
      const value = shownAlone ? basisValue(data, word, basis) : null;
      return value === null ? [] : [{ word, value, text: wordText(word, basis).toLowerCase() }];
    });
    cache.set(skill.id, pool);
  }
  return pool;
}

function plan(data: Data, skill: OddSkill, item: string): Plan | null {
  const { basis } = skill.params;
  const word = itemWord(data, item, basis);
  if (word === null || !unambiguous(data, word)) return null;
  const value = basisValue(data, word, basis);
  if (value === null) return null;
  const lexicon = lexiconIndex(data);
  const text = word.lemma.toLowerCase();
  const entries = basisPool(data, skill).filter((e) => e.word.id !== word.id && e.text !== text);
  const pool = entries.map((e) => e.word);
  let same: Read<Word>[][];
  let odd: Read<Word>[][];
  if (basis === 'family') {
    const family = value;
    const inPool = new Set(pool.map((w) => w.id));
    const members = (lexicon.members.get(family) ?? [])
      .map((id) => lexicon.words.get(id)!)
      .filter(
        (w) =>
          w.id !== word.id &&
          w.lemma.toLowerCase() !== text &&
          unambiguous(data, w) &&
          suits(w, skill.params.words),
      );
    if (members.length === 0) {
      // Alone in its family: another family belongs together, and this word is the odd one.
      const families = otherFamily(data, family, pool);
      return families.length > 0 ? { word, same: families, odd: [[word]], alone: true } : null;
    }
    same = [members.filter((w) => inPool.has(w.id)), members.filter((w) => !inPool.has(w.id))];
    const record = lexicon.families.get(family);
    const sound = record?.soundAlike ?? null;
    const letter = record?.letter ?? null;
    const others = pool.filter((w) => !kinFamilies(data, family, w.family!.id));
    const isSound = (w: Read<Word>) => sound !== null && w.family!.id === sound;
    const sameLetter = (w: Read<Word>) => letter !== null && listedLetter(data, w) === letter;
    odd = [
      others.filter(isSound),
      others.filter((w) => !isSound(w) && sameLetter(w)),
      others.filter((w) => !isSound(w) && !sameLetter(w)),
    ];
  } else if (basis === 'listed') {
    const letter = listedLetter(data, word);
    const initial = text[0];
    const near = (w: Read<Word>) =>
      letter !== null
        ? listedLetter(data, w) === letter || w.lemma.toLowerCase()[0] === letter
        : w.lemma.toLowerCase()[0] === initial;
    const alike = entries.filter((e) => e.value === value).map((e) => e.word);
    const other = entries.filter((e) => e.value !== value).map((e) => e.word);
    same = [alike.filter(near), alike.filter((w) => !near(w))];
    odd = [other.filter(near), other.filter((w) => !near(w))];
  } else {
    same = [entries.filter((e) => e.value === value).map((e) => e.word)];
    odd = [entries.filter((e) => e.value !== value).map((e) => e.word)];
  }
  same = nonEmpty(same);
  odd = nonEmpty(odd);
  return same.length > 0 && odd.length > 0 ? { word, same, odd, alone: false } : null;
}

/** Whether the skill can make a set for `item`. */
export function oddServable(data: Data, skill: OddSkill, item: string): boolean {
  return plan(data, skill, item) !== null;
}

/** `count` words from preference tiers (the first tier first), distinct in writing. */
function draw(
  tiers: readonly Read<Word>[][],
  count: number,
  taken: Set<string>,
  random: GeneratorSources['words'],
): Read<Word>[] {
  const chosen: Read<Word>[] = [];
  for (const tier of tiers) {
    for (const word of shuffle(tier, random)) {
      if (chosen.length >= count) return chosen;
      const text = word.lemma.toLowerCase();
      if (taken.has(text)) continue;
      taken.add(text);
      chosen.push(word);
    }
  }
  return chosen;
}

export function oddProblem(skill: OddSkill, item: string, sources: GeneratorSources): OddProblem {
  const data = sources.data;
  const found = plan(data, skill, item);
  if (found === null) throw cannotPractise('odd-one-out', item);
  const { word, same, odd, alone } = found;
  const taken = new Set([word.lemma.toLowerCase()]);
  let belong: Read<Word>[];
  let oddWord: Read<Word> | undefined;
  if (alone) {
    // One other family makes the set; the item's word is the odd one.
    const family = sources.words.pick(same);
    const size = Math.max(MIN_SIZE, Math.min(skill.params.size, MAX_SIZE, family.length + 1));
    belong = draw([family], size - 1, taken, sources.words);
    oddWord = word;
  } else {
    const available = same.reduce((sum, tier) => sum + tier.length, 0);
    const size = Math.max(MIN_SIZE, Math.min(skill.params.size, MAX_SIZE, available + 2));
    belong = [word, ...draw(same, size - 2, taken, sources.words)];
    [oddWord] = draw(odd, 1, taken, sources.words);
  }
  if (oddWord === undefined || belong.length < MIN_SIZE - 1) {
    throw cannotPractise('odd-one-out', item);
  }
  const shown = shuffle([...belong, oddWord], sources.distractors);
  const letter = listedLetter(data, word);
  const hint: Hint | null =
    skill.params.basis === 'listed' && letter !== null ? { kind: 'listed', letter } : null;
  return {
    kind: 'odd',
    basis: skill.params.basis,
    words: shown.map((w) => ({ word: w.id, text: wordText(w, skill.params.basis) })),
    correct: shown.indexOf(oddWord),
    hint,
  };
}
