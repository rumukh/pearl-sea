/**
 * Examples for hints (design §5.3): a hint teaches the method on another word, never the asked
 * word, a revealing form of it or a member of its family. An example is chosen deterministically
 * from the lexicon:
 *
 * - a word (or a sentence gap) of the same rule, from another family than every word the problem
 *   shows: not their own, not one sharing a root (`kin`), not a sound-alike family;
 * - never a word that only looks like another family's, since families are marked only for the
 *   listed words and the 4th grade's word families: the asked word with an alternative (vila for
 *   víla), or a word whose point has the asked point's letters around it (měkkýš for měkký: m_kk;
 *   výhra for vyhrát: v_hr);
 * - a standard word, never a word of the problem (no name the sentence holds, no form of a word
 *   it shows), and nothing it shows is a form of a problem word's family;
 * - where the deciding letter varies (párové souhlásky, the prefixes' d and z), one with another
 *   letter first, so the example never hands over the letter; then grade 3 words first (every
 *   child knows them); then a noun, an adjective, a verb, an adverb (never a function word such
 *   as aby); then lexicon order, so the content's order sets the canonical example.
 *
 * Where no example is safe, the hint is the rule line alone.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { MAX_HINT_EXAMPLES, codePoints } from '../contract';
import type { SpellingPoint, SpellingRule, Word } from '../contract';
import { gapToken } from './item-info';
import { lexiconIndex, perPack, writtenForms } from './index-cache';
import type { ParsedSentence } from './index-cache';
import type { Data } from '../types';

type Read<T> = DeepReadonly<T>;

/** What a hint's examples must keep clear of: the asked word, its answer, its problem. */
export interface HintContext {
  word: Read<Word> | null;
  point: Read<SpellingPoint> | null;
  /** The asked word as the problem shows it answered: the lemma, or the sentence's token. */
  answer: string;
  /** The sentence the gap is in, with the gap's index, or `null` for a word alone. */
  sentence: { parsed: ParsedSentence; gap: number } | null;
  /** The other words the problem shows (an odd-one-out set). */
  others: readonly Read<Word>[];
}

/** Rules whose line shows examples of words with a point of the rule. */
const WORD_EXAMPLE_RULES: readonly SpellingRule[] = [
  'velke-pismeno',
  'u-zacatek',
  'u-predpona',
  'vyjm-prefix',
  'predpona-souhlaska',
  'bje-vje',
  'mne',
];
/** Rules whose deciding letter varies from word to word: an example with another one first. */
const LETTER_RULES: readonly SpellingRule[] = ['parova', 'predpona-souhlaska'];
/**
 * The function words of a compound form or a reflexive lemma (budu plavat, plaval jsem, plaval
 * bych, bát se): never the word itself, so never a giveaway on their own.
 */
const AUXILIARIES = new Set([
  'se',
  'si',
  'jsem',
  'jsi',
  'je',
  'jsme',
  'jste',
  'jsou',
  'budu',
  'budeš',
  'bude',
  'budeme',
  'budete',
  'budou',
  'bych',
  'bys',
  'by',
  'bychom',
  'byste',
]);

const lower = (text: string): string => text.toLowerCase();
const partsOf = (text: string): string[] => lower(text).split(/\s+/u).filter(Boolean);

/** The context of a hint on a gap of a word alone or of a sentence, or on an odd-one-out set. */
export function hintContext(
  word: Read<Word> | null,
  point: Read<SpellingPoint> | null,
  sentence: { parsed: ParsedSentence; gap: number } | null,
  others: readonly Read<Word>[] = [],
): HintContext {
  const answer = sentence ? gapToken(sentence.parsed, sentence.gap) : (word?.lemma ?? '');
  return { word, point, answer, sentence, others };
}

// ------------------------------------------------------------------------------ the lexicon

interface RuleWord {
  word: Read<Word>;
  point: Read<SpellingPoint>;
  order: number;
}

interface RuleGap {
  sentence: string;
  text: string;
  alternatives: readonly string[];
  word: string | null;
  point: number | undefined;
}

interface Lookups {
  /** Words with a point of each rule (their first such point), in lexicon order. */
  ruleWords: Map<SpellingRule, RuleWord[]>;
  /** Sentence gaps of each rule, in lexicon order. */
  ruleGaps: Map<SpellingRule, RuleGap[]>;
  /** Lower-case forms of each word (and their words): written forms and its points' tests. */
  shapes: Map<string, Set<string>>;
  /** Each family's close families: itself, its kin and its sound-alike family, both ways. */
  near: Map<string, Set<string>>;
  /** The shapes of the members of each family's close families (lazily). */
  nearShapes: Map<string, Set<string>>;
}

const lookups: (data: Data) => Lookups = perPack((data) => {
  const lexicon = lexiconIndex(data);
  const ruleWords = new Map<SpellingRule, RuleWord[]>();
  const shapes = new Map<string, Set<string>>();
  data.lexicon.words.forEach((word, order) => {
    const set = new Set<string>();
    const add = (text: string) => {
      set.add(lower(text));
      for (const part of partsOf(text)) if (!AUXILIARIES.has(part)) set.add(part);
    };
    for (const form of writtenForms(word)) add(form);
    for (const point of word.spelling ?? []) if (point.test) add(point.test);
    shapes.set(word.id, set);
    const seen = new Set<SpellingRule>();
    for (const point of word.spelling ?? []) {
      if (seen.has(point.rule)) continue;
      seen.add(point.rule);
      ruleWords.set(point.rule, [...(ruleWords.get(point.rule) ?? []), { word, point, order }]);
    }
  });
  const ruleGaps = new Map<SpellingRule, RuleGap[]>();
  for (const [id, parsed] of lexicon.sentences) {
    parsed.sentence.gaps.forEach((gap, index) => {
      const written = parsed.parsed.gaps[index];
      if (written === undefined) return;
      ruleGaps.set(gap.rule, [
        ...(ruleGaps.get(gap.rule) ?? []),
        {
          sentence: id,
          text: written.correct,
          alternatives: written.alternatives,
          word: gap.word,
          point: gap.point,
        },
      ]);
    });
  }
  const near = new Map<string, Set<string>>();
  const nearOf = (id: string) => {
    let set = near.get(id);
    if (set === undefined) near.set(id, (set = new Set([id])));
    return set;
  };
  for (const family of lexicon.families.values()) {
    nearOf(family.id);
    for (const other of [...family.kin, ...(family.soundAlike ? [family.soundAlike] : [])]) {
      nearOf(family.id).add(other);
      nearOf(other).add(family.id);
    }
  }
  return { ruleWords, ruleGaps, shapes, near, nearShapes: new Map() };
});

/** The shapes of every member of a family's close families. */
function nearShapesOf(data: Data, family: string): Set<string> {
  const { near, nearShapes, shapes } = lookups(data);
  let set = nearShapes.get(family);
  if (set === undefined) {
    set = new Set<string>();
    for (const id of near.get(family) ?? [family]) {
      for (const member of lexiconIndex(data).members.get(id) ?? []) {
        for (const shape of shapes.get(member) ?? []) set.add(shape);
      }
    }
    nearShapes.set(family, set);
  }
  return set;
}

/** The letters around a point of a word, lower case (`m_kk` is m before the gap, k after). */
function aroundOf(word: Read<Word>, point: Read<SpellingPoint>): string {
  const letters = codePoints(lower(word.lemma));
  const end = point.at + codePoints(point.correct).length;
  return `${letters[point.at - 1] ?? ''}_${letters[end] ?? ''}`;
}

/** The word's lemma with the point's letters replaced by `text`. */
function respelled(word: Read<Word>, point: Read<SpellingPoint>, text: string): string {
  const letters = codePoints(word.lemma);
  const end = point.at + codePoints(point.correct).length;
  return [...letters.slice(0, point.at), text, ...letters.slice(end)].join('');
}

// ------------------------------------------------------------------------------ the guard

/** What every example of a context must keep clear of. */
interface Guard {
  /** The asked word as answered, lower case. */
  answer: string;
  /**
   * Lower-case forms no example may show: of every problem word's close families (its own, its
   * kin, its sound-alike family). A word of such a family shows one, its lemma, so it is never an
   * example either.
   */
  banned: ReadonlySet<string>[];
  /** The problem's words and the lower-case words it shows. */
  ids: Set<string>;
  texts: Set<string>;
  /** The letters around the asked point, and the asked word with each alternative. */
  around: string | null;
  respelled: Set<string>;
}

function guardOf(data: Data, context: HintContext): Guard {
  const lexicon = lexiconIndex(data);
  const { shapes } = lookups(data);
  const words = new Map<string, Read<Word>>();
  const take = (word: Read<Word> | null | undefined) => {
    if (word) words.set(word.id, word);
  };
  const texts = new Set<string>([lower(context.answer)]);
  take(context.word);
  for (const other of context.others) {
    take(other);
    texts.add(lower(other.lemma));
  }
  const parsed = context.sentence?.parsed;
  if (parsed) {
    for (const gap of parsed.sentence.gaps)
      if (gap.word !== null) take(lexicon.words.get(gap.word));
    for (const token of parsed.sentence.tokens ?? []) {
      texts.add(lower(token.t));
      if (token.word !== undefined) take(lexicon.words.get(token.word));
    }
    for (const text of parsed.words) texts.add(lower(text));
  }
  const banned: ReadonlySet<string>[] = [];
  for (const word of words.values()) {
    const family = word.family?.id;
    banned.push(
      family === undefined ? (shapes.get(word.id) ?? new Set()) : nearShapesOf(data, family),
    );
  }
  const { word, point } = context;
  return {
    answer: lower(context.answer),
    banned,
    ids: new Set(words.keys()),
    texts,
    around: word && point ? aroundOf(word, point) : null,
    respelled: new Set(
      word && point ? point.alt.map((alt) => lower(respelled(word, point, alt))) : [],
    ),
  };
}

/** Whether `text` shows a banned form or the answer: whole, a word of it or a phrase within it. */
function shows(guard: Guard, text: string): boolean {
  const parts = partsOf(text);
  for (let from = 0; from < parts.length; from++) {
    for (let to = from + 1; to <= parts.length; to++) {
      if (to === from + 1 && AUXILIARIES.has(parts[from]!)) continue;
      const phrase = parts.slice(from, to).join(' ');
      if (phrase === guard.answer || guard.banned.some((set) => set.has(phrase))) return true;
    }
  }
  return false;
}

/** Whether a text may be shown beside the problem: no banned form, no word of the problem. */
function fitText(guard: Guard, text: string): boolean {
  if (shows(guard, text)) return false;
  return !partsOf(text).some((part) => !AUXILIARIES.has(part) && guard.texts.has(part));
}

/**
 * Whether a word (with its point of the rule, where known) may stand as an example: of no family
 * close to a problem word (its lemma would show a banned form), not a look-alike of the asked
 * word, standard and of nothing the problem shows.
 */
function fitWord(
  data: Data,
  guard: Guard,
  word: Read<Word>,
  point: Read<SpellingPoint> | null = null,
): boolean {
  if (word.register === 'colloquial' || guard.ids.has(word.id)) return false;
  if (guard.respelled.has(lower(word.lemma))) return false;
  if (point !== null && guard.around !== null && aroundOf(word, point) === guard.around) {
    return false;
  }
  for (const shape of lookups(data).shapes.get(word.id) ?? []) {
    if (guard.texts.has(shape)) return false;
  }
  return !shows(guard, word.lemma);
}

/** The asked point's deciding letter, lower case, or `null`. */
const letterOf = (point: Read<SpellingPoint> | null): string | null =>
  point === null ? null : lower(point.correct);

/** The parts of speech an example may be, best first: never a function word (aby, my). */
const EXAMPLE_POS: readonly string[] = ['noun', 'adj', 'verb', 'adv'];

/** Candidates of a word kind, sorted by each key in turn (lower first), then lexicon order. */
function sorted<T extends RuleWord>(list: readonly T[], keys: readonly ((c: T) => number)[]): T[] {
  return list
    .filter((c) => EXAMPLE_POS.includes(c.word.pos))
    .sort((a, b) => {
      for (const key of keys) {
        const difference = key(a) - key(b);
        if (difference !== 0) return difference;
      }
      return a.order - b.order;
    });
}

/** Grade 3 words first: every child knows them. */
const byGrade = (c: RuleWord): number => (c.word.grade === 3 ? 0 : 1);
/** Nouns, then adjectives, verbs and adverbs. */
const byPos = (c: RuleWord): number => EXAMPLE_POS.indexOf(c.word.pos);

/**
 * A rule's word candidates in preference order: another deciding letter first where the rule's
 * letter varies, then grade 3, then nouns, adjectives, verbs and adverbs, then lexicon order.
 */
function ranked(rule: SpellingRule, context: HintContext, candidates: readonly RuleWord[]) {
  const asked = LETTER_RULES.includes(rule) ? letterOf(context.point) : null;
  const byLetter = (c: RuleWord) => (asked !== null && lower(c.point.correct) === asked ? 1 : 0);
  return sorted(candidates, [byLetter, byGrade, byPos]);
}

// ------------------------------------------------------------------------------ examples

/** A form of the word with o where its ů is (dům → domu, kůň → koně), or `null`. */
function alternationForm(word: Read<Word>, point: Read<SpellingPoint>): string | null {
  const lemma = codePoints(word.lemma);
  for (const form of writtenForms(word)) {
    const letters = codePoints(form);
    if (form === word.lemma || form.includes(' ') || letters[point.at] !== 'o') continue;
    if (letters.slice(0, point.at).join('') === lemma.slice(0, point.at).join('')) return form;
  }
  return null;
}

/**
 * The example of a test word (`parova`, `u-uprostred`): another word of the rule and its form
 * that makes the sound clear (hrad → hrady, dům → domy), or `null`. A test that is a form of its
 * word comes first (the line says "jiný tvar slova"), then one that is a related word (hádka →
 * hádat).
 */
export function testWordExample(
  data: Data,
  context: HintContext,
  rule: 'parova' | 'u-uprostred',
): { word: string; test: string } | null {
  const guard = guardOf(data, context);
  const asked = rule === 'parova' ? letterOf(context.point) : null;
  const candidates = (lookups(data).ruleWords.get(rule) ?? []).flatMap((candidate) => {
    const { word, point } = candidate;
    const test = point.test ?? (rule === 'u-uprostred' ? alternationForm(word, point) : null);
    return test === null || test === undefined ? [] : [{ ...candidate, test }];
  });
  const byLetter = (c: RuleWord) => (asked !== null && lower(c.point.correct) === asked ? 1 : 0);
  const byForm = (c: (typeof candidates)[number]) =>
    writtenForms(c.word).includes(c.test) ? 0 : 1;
  for (const c of sorted(candidates, [byLetter, byForm, byGrade, byPos])) {
    if (fitWord(data, guard, c.word, c.point) && fitText(guard, c.test)) {
      return { word: c.word.id, test: c.test };
    }
  }
  return null;
}

/**
 * The example of a related listed word (`vyjm`, and an odd-one-out set on the listed basis): a
 * related word of another listed family and its listed word (mlynář → mlýn), a family of another
 * letter than the asked word's first, or `null`.
 */
export function familyExample(
  data: Data,
  context: HintContext,
): { word: string; related: string } | null {
  const lexicon = lexiconIndex(data);
  const guard = guardOf(data, context);
  const own = context.word?.family ? lexicon.families.get(context.word.family.id) : undefined;
  const candidates = (lookups(data).ruleWords.get('vyjm') ?? []).flatMap((candidate) => {
    const family = candidate.word.family ? lexicon.families.get(candidate.word.family.id) : null;
    const head = family ? lexicon.words.get(family.head) : undefined;
    if (!family || family.letter === null || !head || head.id === candidate.word.id) return [];
    return [{ ...candidate, family, head }];
  });
  const byLetter = (c: (typeof candidates)[number]) =>
    own && c.family.letter === own.letter ? 1 : 0;
  for (const c of sorted(candidates, [byLetter, byGrade, byPos])) {
    if (fitWord(data, guard, c.word, c.point) && fitWord(data, guard, c.head)) {
      return { word: c.word.id, related: c.head.id };
    }
  }
  return null;
}

/** Up to `MAX_HINT_EXAMPLES` words of a rule from different families, as their lemmas. */
function wordExamples(data: Data, context: HintContext, rule: SpellingRule): string[] {
  const guard = guardOf(data, context);
  const picked: string[] = [];
  const families = new Set<string>();
  for (const { word, point } of ranked(rule, context, lookups(data).ruleWords.get(rule) ?? [])) {
    if (picked.length >= MAX_HINT_EXAMPLES) break;
    const family = word.family?.id ?? word.id;
    if (families.has(family) || picked.includes(word.lemma)) continue;
    if (!fitWord(data, guard, word, point)) continue;
    picked.push(word.lemma);
    families.add(family);
  }
  return picked;
}

/** Whether a gap of another sentence may give an example. */
function fitGap(data: Data, context: HintContext, guard: Guard, gap: RuleGap): boolean {
  if (context.sentence && gap.sentence === context.sentence.parsed.sentence.id) return false;
  const word = gap.word === null ? undefined : lexiconIndex(data).words.get(gap.word);
  const point = word?.spelling?.find((p) => p.at === gap.point) ?? null;
  if (word !== undefined && !fitWord(data, guard, word, point)) return false;
  return fitText(guard, gap.text);
}

/**
 * The examples of a rule line, or none: words of the rule (up to two, different families); for
 * `obojetna-i` a sound-alike pair, the y-word first (výr, vír); for `predpona-predlozka` one
 * written together and one apart (podplula, pod mostem); for `spisovne` the standard form, then
 * the colloquial one (mléko, mlíko). Lines that teach with their own examples or terms (`shoda`,
 * `vzor`, `mne-zajmeno`) and those whose examples would be the answers (`interpunkce`, `spojka`)
 * show none, nor do the rules of a syllable or a sound.
 */
export function ruleExamples(data: Data, context: HintContext, rule: SpellingRule): string[] {
  if (WORD_EXAMPLE_RULES.includes(rule)) return wordExamples(data, context, rule);
  const guard = guardOf(data, context);
  const gaps = lookups(data).ruleGaps.get(rule) ?? [];
  if (rule === 'obojetna-i') {
    const spellings = lexiconIndex(data).spellings;
    for (const { word, point } of ranked(rule, context, lookups(data).ruleWords.get(rule) ?? [])) {
      if (!fitWord(data, guard, word, point)) continue;
      for (const alt of point.alt) {
        const twin = respelled(word, point, alt);
        if (twin !== word.lemma && spellings.has(twin) && fitText(guard, twin)) {
          return [twin, word.lemma];
        }
      }
    }
    return [];
  }
  if (rule === 'predpona-predlozka') {
    const fit = gaps.filter((gap) => fitGap(data, context, guard, gap));
    const together = fit.find((gap) => !gap.text.includes(' '));
    const apart = fit.find((gap) => gap.text.includes(' '));
    return together && apart ? [together.text, apart.text] : [];
  }
  if (rule === 'spisovne') {
    for (const gap of gaps) {
      const colloquial = gap.alternatives[0];
      if (colloquial === undefined || !fitGap(data, context, guard, gap)) continue;
      if (fitText(guard, colloquial)) return [gap.text, colloquial];
    }
    return [];
  }
  return [];
}
