/**
 * `relation` (design §5.7, curriculum §7.2): a word and 2-4 options (the grade's `choices`), of
 * which exactly one is in the relation with it (synonym, antonym, general, specific, coordinate,
 * sound-alike, related) and no other option is.
 *
 * The drawn item `rel:<relation>:<word>` names the word to pick: `rel:general:zviirxe` is "zvíře is
 * the general word" (of the shown pes), `rel:antonym:malyy` "malý is the antonym" (of velký). The
 * shown word is drawn among the item word's partners (`problems`); the other options come first from
 * the opposite relation (an antonym offered for a synonym, a coordinate word for a general one, the
 * general word for a coordinate one, the sound-alike family's words for a related one), then from
 * the skill's words of the same part of speech (`words`), never a word of a kin family for
 * `related`, never another lexicon word's homograph. A shown word or option the filter does not
 * select keeps to its registers and grades (companions.ts `suits`). The shown order comes from
 * `distractors`.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { parseItemId, soundRefTarget } from '../../contract';
import type { RelationProblem, Skill, SoundRef, Word, WordRef, WordRelation } from '../../contract';
import { formOfTarget, lexiconIndex, perPack, soundRefText } from '../index-cache';
import { shuffle } from '../random';
import { kinFamilies, skillWords, suits, unambiguous } from './companions';
import { cannotPractise } from './shared';
import type { GeneratorSources } from './shared';
import type { Data } from '../../types';

type Read<T> = DeepReadonly<T>;
type RelationSkill = DeepReadonly<Extract<Skill, { generator: 'relation' }>>;

/** An option or the shown word: a lexicon word, or a word form (a sound-alike side). */
interface Shown {
  /** The item target it stands for (`piit`, `piit:pil`). */
  key: string;
  word: Read<Word>;
  ref: WordRef;
}

function ofWord(word: Read<Word>): Shown {
  return { key: word.id, word, ref: { word: word.id, text: word.lemma } };
}

function ofKey(data: Data, key: string): Shown | null {
  const lexicon = lexiconIndex(data);
  const word = lexicon.words.get(key);
  if (word !== undefined) return ofWord(word);
  const form = formOfTarget(data, key);
  const owner = form === null ? undefined : lexicon.words.get(form.word);
  return form && owner ? { key, word: owner, ref: { word: owner.id, text: form.text } } : null;
}

function ofRef(data: Data, ref: Read<SoundRef>): Shown | null {
  if (typeof ref === 'string') return ofKey(data, ref);
  const owner = lexiconIndex(data).words.get(ref.word);
  if (owner === undefined) return null;
  return {
    key: soundRefTarget(ref),
    word: owner,
    ref: { word: owner.id, text: soundRefText(data, ref) },
  };
}

const ids = (set: ReadonlySet<string> | undefined) => [...(set ?? [])];

/** The words the item's word is in `relation` with, as the problem would show them. */
function partners(data: Data, relation: WordRelation, answer: Shown): Shown[] {
  const lexicon = lexiconIndex(data);
  const words = (list: readonly string[]) =>
    list.flatMap((id) => {
      const word = lexicon.words.get(id);
      return word === undefined ? [] : [ofWord(word)];
    });
  const id = answer.word.id;
  switch (relation) {
    case 'synonym':
      return words(ids(lexicon.synonyms.get(id)));
    case 'antonym':
      return words(ids(lexicon.antonyms.get(id)));
    case 'general':
      // The answer is the general word: shown is one of its specific words.
      return words(ids(lexicon.specifics.get(id)));
    case 'specific':
      return words(ids(lexicon.generals.get(id)));
    case 'coordinate':
      return words(
        ids(lexicon.generals.get(id))
          .flatMap((general) => ids(lexicon.specifics.get(general)))
          .filter((other, i, all) => other !== id && all.indexOf(other) === i),
      );
    case 'sound-alike':
      return (lexicon.soundAlikes.get(answer.key) ?? []).flatMap((ref) => {
        const shown = ofRef(data, ref);
        return shown === null ? [] : [shown];
      });
    case 'related': {
      const family = answer.word.family?.id;
      return family === undefined
        ? []
        : words((lexicon.members.get(family) ?? []).filter((other) => other !== id));
    }
  }
}

/** Whether `option` is in `relation` with the shown word (then it cannot be a wrong option). */
function related(data: Data, relation: WordRelation, shown: Shown, option: Shown): boolean {
  const lexicon = lexiconIndex(data);
  const a = shown.word.id;
  const b = option.word.id;
  switch (relation) {
    case 'synonym':
      return lexicon.synonyms.get(a)?.has(b) ?? false;
    case 'antonym':
      return lexicon.antonyms.get(a)?.has(b) ?? false;
    case 'general':
      return lexicon.generals.get(a)?.has(b) ?? false;
    case 'specific':
      return lexicon.specifics.get(a)?.has(b) ?? false;
    case 'coordinate': {
      const generals = lexicon.generals.get(a);
      return a !== b && ids(lexicon.generals.get(b)).some((g) => generals?.has(g) ?? false);
    }
    case 'sound-alike':
      return (lexicon.soundAlikes.get(shown.key) ?? []).some(
        (ref) => (typeof ref === 'string' ? ref : ref.word) === b,
      );
    case 'related': {
      const fa = shown.word.family?.id;
      const fb = option.word.family?.id;
      return fa !== undefined && fb !== undefined && kinFamilies(data, fa, fb);
    }
  }
}

/** The opposite relation's words for a shown word: the most tempting wrong options. */
function tempting(data: Data, relation: WordRelation, shown: Shown): Shown[] {
  const lexicon = lexiconIndex(data);
  const words = (list: readonly string[]) =>
    list.flatMap((id) => {
      const word = lexicon.words.get(id);
      return word === undefined ? [] : [ofWord(word)];
    });
  const id = shown.word.id;
  switch (relation) {
    case 'synonym':
      return words(ids(lexicon.antonyms.get(id)));
    case 'antonym':
      return words(ids(lexicon.synonyms.get(id)));
    case 'general':
      // Its coordinate words: specific, not general.
      return words(ids(lexicon.generals.get(id)).flatMap((g) => ids(lexicon.specifics.get(g))));
    case 'specific':
      // Other general words: general, but not of the shown word's kind.
      return words([...lexicon.specifics.keys()].filter((general) => general !== id));
    case 'coordinate':
      return words(ids(lexicon.generals.get(id)));
    case 'sound-alike':
      return [];
    case 'related': {
      const family = shown.word.family ? lexicon.families.get(shown.word.family.id) : undefined;
      return family?.soundAlike === undefined
        ? []
        : words(lexicon.members.get(family.soundAlike) ?? []);
    }
  }
}

interface Plan {
  relation: WordRelation;
  answer: Shown;
  shown: Shown[];
}

function plan(data: Data, skill: RelationSkill, item: string): Plan | null {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'rel' || !skill.params.relations.includes(parsed.relation)) return null;
  const answer = ofKey(data, parsed.word);
  if (answer === null || !unambiguous(data, answer.word)) return null;
  const shown = partners(data, parsed.relation, answer).filter(
    (s) =>
      unambiguous(data, s.word) &&
      s.ref.text !== answer.ref.text &&
      suits(s.word, skill.params.words),
  );
  return shown.length === 0 ? null : { relation: parsed.relation, answer, shown };
}

const optionCache: (data: Data) => Map<string, Shown[]> = perPack(() => new Map());

/** The skill's words as options (cached per pack and skill), in lexicon order. */
function skillOptions(data: Data, skill: RelationSkill): Shown[] {
  const cache = optionCache(data);
  let options = cache.get(skill.id);
  if (options === undefined) {
    options = skillWords(data, skill.id, skill.params.words).map(ofWord);
    cache.set(skill.id, options);
  }
  return options;
}

/** Whether an option can be offered beside a shown word as a wrong one. */
function wrongOption(
  data: Data,
  skill: RelationSkill,
  p: Plan,
  shown: Shown,
): (option: Shown) => boolean {
  return (option) =>
    option.key !== p.answer.key &&
    option.word.id !== shown.word.id &&
    option.ref.text !== shown.ref.text &&
    option.ref.text !== p.answer.ref.text &&
    unambiguous(data, option.word) &&
    suits(option.word, skill.params.words) &&
    !related(data, p.relation, shown, option);
}

/** The wrong options for a shown word, tiers of preference (the tempting ones first). */
function wrongOptions(data: Data, skill: RelationSkill, p: Plan, shown: Shown): Shown[][] {
  const valid = wrongOption(data, skill, p, shown);
  const pos = p.answer.word.pos;
  const pool = skillOptions(data, skill).filter(valid);
  return [
    tempting(data, p.relation, shown).filter(valid),
    pool.filter((o) => o.word.pos === pos),
    pool.filter((o) => o.word.pos !== pos),
  ].filter((tier) => tier.length > 0);
}

/** Whether a shown word has any wrong option (stops at the first). */
function hasWrongOption(data: Data, skill: RelationSkill, p: Plan, shown: Shown): boolean {
  const valid = wrongOption(data, skill, p, shown);
  return tempting(data, p.relation, shown).some(valid) || skillOptions(data, skill).some(valid);
}

/** Whether the skill can ask `item`: its word, a word to show it with, and a wrong option. */
export function relationServable(data: Data, skill: RelationSkill, item: string): boolean {
  const p = plan(data, skill, item);
  return p !== null && p.shown.some((shown) => hasWrongOption(data, skill, p, shown));
}

export function relationProblem(
  skill: RelationSkill,
  item: string,
  sources: GeneratorSources,
): RelationProblem {
  const data = sources.data;
  const p = plan(data, skill, item);
  const candidates = p === null ? [] : p.shown.filter((s) => hasWrongOption(data, skill, p, s));
  if (p === null || candidates.length === 0) throw cannotPractise('relation', item);
  const shown = sources.problems.pick(candidates);
  const count = Math.max(2, Math.min(sources.choices, 4));
  const taken = new Set([shown.ref.text, p.answer.ref.text]);
  const wrong: Shown[] = [];
  for (const tier of wrongOptions(data, skill, p, shown)) {
    for (const option of shuffle(tier, sources.words)) {
      if (wrong.length >= count - 1) break;
      if (taken.has(option.ref.text)) continue;
      taken.add(option.ref.text);
      wrong.push(option);
    }
  }
  const options = shuffle([p.answer, ...wrong], sources.distractors);
  return {
    kind: 'relation',
    relation: p.relation,
    target: { ...shown.ref },
    options: options.map((option) => ({ ...option.ref })),
    correct: options.indexOf(p.answer),
    hint: p.relation === 'sound-alike' ? { kind: 'method', method: 'sound-alike' } : null,
  };
}
