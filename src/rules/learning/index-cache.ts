/**
 * Per-pack indexes of the content: the skills' item universes and the lexicon's lookups.
 *
 * The runtime hands every read and transition the same frozen content pack, so each index is built
 * once per pack (a `WeakMap` keyed by the pack's data) and shared by every command, legality check
 * and view. Tests that build content objects by hand get their own index the same way.
 */
import type { DeepReadonly } from '@aegis/runtime';
import {
  BOARD_GENERATORS,
  formCells,
  lexiconId,
  parseGappedText,
  skillItemIndex,
  soundRefTarget,
  soundRefWord,
  textWords,
} from '../contract';
import type { FormCell, GappedText, Sentence, SoundRef, Word, WordFamily } from '../contract';
import type { Data, Index } from '../types';

type Read<T> = DeepReadonly<T>;

/** A memo per content pack. */
export function perPack<T>(build: (data: Data) => T): (data: Data) => T {
  const cache = new WeakMap<object, T>();
  return (data) => {
    let value = cache.get(data);
    if (value === undefined) {
      value = build(data);
      cache.set(data, value);
    }
    return value;
  };
}

export const sortText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Every skill's item universe (`skillItemIndex`), by skill ID. */
export const itemIndex: (data: Data) => Index = perPack((data) => skillItemIndex(data));

/** Whether a generator makes boards (minigames) rather than single problems. */
export function isBoardGenerator(generator: string): boolean {
  return (BOARD_GENERATORS as readonly string[]).includes(generator);
}

/** A sentence of the lexicon with its gapped text parsed and its words listed. */
export interface ParsedSentence {
  sentence: Read<Sentence>;
  parsed: GappedText;
  /** The words of the filled text (`textWords`), as `tokens[].t` lists them. */
  words: string[];
}

export interface LexiconIndex {
  words: ReadonlyMap<string, Read<Word>>;
  families: ReadonlyMap<string, Read<WordFamily>>;
  /** Word IDs of each family, in lexicon order. */
  members: ReadonlyMap<string, readonly string[]>;
  sentences: ReadonlyMap<string, ParsedSentence>;
  /** Sentences with a gap on a word's spelling point, by `<word>:<at>`, in lexicon order. */
  pointSentences: ReadonlyMap<string, readonly string[]>;
  synonyms: ReadonlyMap<string, ReadonlySet<string>>;
  antonyms: ReadonlyMap<string, ReadonlySet<string>>;
  /** The general words of a specific word, and the specific words of a general word. */
  generals: ReadonlyMap<string, ReadonlySet<string>>;
  specifics: ReadonlyMap<string, ReadonlySet<string>>;
  /** Sound-alike partners by item target (`byyt`, `piit:pil`): the other side of each pair. */
  soundAlikes: ReadonlyMap<string, readonly Read<SoundRef>[]>;
  /** Words that are a side of a sound-alike pair (by word ID, forms included). */
  soundAlikeWords: ReadonlySet<string>;
  /** Every lemma and every form of the lexicon as written: what a misspelling must not equal. */
  spellings: ReadonlySet<string>;
}

function addTo<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  let set = map.get(key);
  if (set === undefined) map.set(key, (set = new Set()));
  set.add(value);
}

const formCache = new WeakMap<object, FormCell[]>();

/** `formCells` of a word, once per word record. */
export function formsOf(word: Read<Word>): FormCell[] {
  let forms = formCache.get(word);
  if (forms === undefined) {
    forms = formCells(word);
    formCache.set(word, forms);
  }
  return forms;
}

/**
 * Every form of a word as written: its lemma, its paradigm's variants and composed forms (a
 * colloquial word may have no paradigm: then only its lemma).
 */
export function writtenForms(word: Read<Word>): string[] {
  const forms = new Set<string>([word.lemma, ...formsOf(word).map((form) => form.text)]);
  const verb = word.verb?.paradigm;
  const cells = [
    ...(word.noun?.paradigm?.sg ?? []),
    ...(word.noun?.paradigm?.pl ?? []),
    ...(verb
      ? [verb.inf, ...verb.pres, ...verb.imp, ...Object.values(verb.past), ...(verb.fut ?? [])]
      : []),
  ];
  for (const cell of cells) {
    for (const text of typeof cell === 'string' ? [cell] : cell) forms.add(text);
  }
  return [...forms];
}

/** The lexicon's lookups, built once per pack. */
export const lexiconIndex: (data: Data) => LexiconIndex = perPack((data) => {
  const lexicon = data.lexicon;
  const words = new Map(lexicon.words.map((word) => [word.id, word]));
  const families = new Map(lexicon.families.map((family) => [family.id, family]));
  const members = new Map<string, string[]>();
  for (const word of lexicon.words) {
    if (word.family) members.set(word.family.id, [...(members.get(word.family.id) ?? []), word.id]);
  }
  const sentences = new Map<string, ParsedSentence>();
  const pointSentences = new Map<string, string[]>();
  for (const sentence of lexicon.sentences) {
    let parsed: GappedText;
    try {
      parsed = parseGappedText(sentence.text);
    } catch {
      continue;
    }
    sentences.set(sentence.id, { sentence, parsed, words: textWords(parsed.plain) });
    for (const gap of sentence.gaps) {
      if (gap.word === null || gap.point === undefined) continue;
      const key = `${gap.word}:${gap.point}`;
      pointSentences.set(key, [...(pointSentences.get(key) ?? []), sentence.id]);
    }
  }
  const synonyms = new Map<string, Set<string>>();
  for (const [a, b] of lexicon.relations.synonyms) {
    addTo(synonyms, a, b);
    addTo(synonyms, b, a);
  }
  const antonyms = new Map<string, Set<string>>();
  for (const [a, b] of lexicon.relations.antonyms) {
    addTo(antonyms, a, b);
    addTo(antonyms, b, a);
  }
  const generals = new Map<string, Set<string>>();
  const specifics = new Map<string, Set<string>>();
  for (const hierarchy of lexicon.relations.hierarchies) {
    for (const specific of hierarchy.specific) {
      addTo(generals, specific, hierarchy.general);
      addTo(specifics, hierarchy.general, specific);
    }
  }
  const soundAlikes = new Map<string, Read<SoundRef>[]>();
  const soundAlikeWords = new Set<string>();
  for (const [a, b] of lexicon.relations.soundAlikes) {
    soundAlikes.set(soundRefTarget(a), [...(soundAlikes.get(soundRefTarget(a)) ?? []), b]);
    soundAlikes.set(soundRefTarget(b), [...(soundAlikes.get(soundRefTarget(b)) ?? []), a]);
    soundAlikeWords.add(soundRefWord(a));
    soundAlikeWords.add(soundRefWord(b));
  }
  const spellings = new Set<string>();
  for (const word of lexicon.words) for (const form of writtenForms(word)) spellings.add(form);
  for (const pair of lexicon.relations.soundAlikes) {
    for (const ref of pair) if (typeof ref !== 'string') spellings.add(ref.form);
  }
  return {
    words,
    families,
    members,
    sentences,
    pointSentences,
    synonyms,
    antonyms,
    generals,
    specifics,
    soundAlikes,
    soundAlikeWords,
    spellings,
  };
});

/**
 * The text a sound-alike reference names: the word's lemma, or the form it writes out.
 */
export function soundRefText(data: Data, ref: Read<SoundRef>): string {
  if (typeof ref !== 'string') return ref.form;
  return lexiconIndex(data).words.get(ref)?.lemma ?? ref;
}

/** The written form behind an item target `<word>:<form ID>` (`piit:pil` → `pil`), or `null`. */
export function formOfTarget(data: Data, target: string): { word: string; text: string } | null {
  const colon = target.lastIndexOf(':');
  if (colon <= 0) return null;
  const word = target.slice(0, colon);
  const formId = target.slice(colon + 1);
  for (const pair of data.lexicon.relations.soundAlikes) {
    for (const ref of pair) {
      if (typeof ref !== 'string' && ref.word === word && lexiconId(ref.form) === formId) {
        return { word, text: ref.form };
      }
    }
  }
  return null;
}

/** The items of `skills` (unique, sorted). */
export function itemsOf(skills: readonly string[], index: Index): string[] {
  return [...new Set(skills.flatMap((skill) => index.get(skill) ?? []))].sort(sortText);
}

/** The skills owning each item, in content order. */
export const itemSkills: (data: Data) => ReadonlyMap<string, readonly string[]> = perPack(
  (data) => {
    const index = itemIndex(data);
    const owners = new Map<string, string[]>();
    for (const skill of data.skills) {
      for (const item of index.get(skill.id) ?? []) {
        owners.set(item, [...(owners.get(item) ?? []), skill.id]);
      }
    }
    return owners;
  },
);
