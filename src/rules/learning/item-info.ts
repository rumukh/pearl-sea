/**
 * What an item is about, read from its ID and the lexicon: the word or sentence it belongs to, the
 * spelling rule it trains, the value a classification asks, how it is labelled for grown-ups, and
 * what "the same word" means for the no-repeat rule.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { CONSONANT_ITEMS, parseItemId, wordDimensionValue } from '../contract';
import type {
  Dimension,
  FormCell,
  FormDimension,
  ParsedItem,
  SegmentRole,
  SpellingPoint,
  SpellingRule,
  Token,
  Word,
} from '../contract';
import { formOfTarget, formsOf, itemIndex, lexiconIndex, perPack } from './index-cache';
import type { ParsedSentence } from './index-cache';
import type { Data } from '../types';

type Read<T> = DeepReadonly<T>;

/** Dimensions a sentence classification asks of the sentence as a whole. */
export const SENTENCE_DIMENSIONS: readonly Dimension[] = ['sentence-kind', 'clauses'];

/** The spelling point a `spell:` item names, with its word. */
export function spellPoint(
  data: Data,
  word: string,
  at: number,
): { word: Read<Word>; point: Read<SpellingPoint> } | null {
  const found = lexiconIndex(data).words.get(word);
  const point = found?.spelling?.find((p) => p.at === at);
  return found && point ? { word: found, point } : null;
}

/** The spelling rule a `spell:` or `gap:` item trains, or `null`. */
export function itemRule(data: Data, item: string): SpellingRule | null {
  const parsed = parseItemId(item);
  if (parsed?.kind === 'spell') return spellPoint(data, parsed.word, parsed.at)?.point.rule ?? null;
  if (parsed?.kind === 'gap') {
    return (
      lexiconIndex(data).sentences.get(parsed.sentence)?.sentence.gaps[parsed.gap]?.rule ?? null
    );
  }
  return null;
}

/** What a classification item looks at, with the value it asks. */
export type ClassTarget =
  | { kind: 'consonant'; letter: string; value: string }
  | { kind: 'word'; word: Read<Word>; value: string }
  | { kind: 'segment'; word: Read<Word>; index: number; role: SegmentRole; span: [number, number] }
  | { kind: 'form'; word: Read<Word>; form: FormCell; value: string }
  | { kind: 'token'; sentence: ParsedSentence; index: number; token: Read<Token>; value: string }
  | { kind: 'sentence'; sentence: ParsedSentence; value: string };

/** The value of a dimension for a token of a sentence (as `skillItems` reads it). */
export function tokenValue(token: Read<Token>, dimension: Dimension): string | null {
  switch (dimension) {
    case 'case':
    case 'person':
      return token[dimension] === undefined ? null : String(token[dimension]);
    case 'gender':
      return token.gender === undefined
        ? null
        : token.gender === 'ma' || token.gender === 'mi'
          ? 'm'
          : token.gender;
    case 'gender-class':
      return token.gender ?? null;
    case 'pos':
    case 'number':
    case 'tense':
    case 'mood':
    case 'member':
      return (token[dimension] as string | undefined) ?? null;
    default:
      return null;
  }
}

/** The value a whole sentence has for `sentence-kind` or `clauses`. */
export function sentenceValue(sentence: ParsedSentence, dimension: Dimension): string | null {
  if (dimension === 'sentence-kind') return sentence.sentence.kind ?? null;
  if (dimension === 'clauses') {
    const clauses = sentence.sentence.clauses;
    return clauses === undefined ? null : clauses > 1 ? 'compound' : 'simple';
  }
  return null;
}

/** The code-point span of segment `index` of a word (`segments` rebuild the lower-case lemma). */
export function segmentSpan(word: Read<Word>, index: number): [number, number] | null {
  const segments = word.segments ?? [];
  if (index < 0 || index >= segments.length) return null;
  let start = 0;
  for (let i = 0; i < index; i++) start += [...segments[i]![1]].length;
  return [start, start + [...segments[index]![1]].length];
}

/** A verb without its reflexive pronoun: its infinitive (bát), or the lemma without se or si. */
export function bareVerb(word: Read<Word>): string {
  const inf = word.verb?.paradigm?.inf;
  if (inf !== undefined) return typeof inf === 'string' ? inf : (inf[0] ?? word.lemma);
  return word.lemma.replace(/ s[ei]$/u, '');
}

/**
 * How a word is shown on its own when `dimension` is asked of it: its lemma, but a verb asked
 * for its reflexive pronoun without the pronoun (bát, not bát se, which would give se away).
 */
export function wordText(word: Read<Word>, dimension: string): string {
  return dimension === 'reflexive' && word.verb ? bareVerb(word) : word.lemma;
}

/** The reflexive values (`none` for none) of the lexicon's verbs, by bare verb in lower case. */
const bareVerbValues: (data: Data) => ReadonlyMap<string, ReadonlySet<string>> = perPack((data) => {
  const values = new Map<string, Set<string>>();
  for (const word of data.lexicon.words) {
    if (!word.verb) continue;
    const key = bareVerb(word).toLowerCase();
    const set = values.get(key) ?? new Set<string>();
    set.add(word.verb.reflexive ?? 'none');
    values.set(key, set);
  }
  return values;
});

/**
 * Whether a verb shown bare is also another verb of the lexicon with another reflexive value
 * (hrát beside hrát si): its reflexive pronoun cannot be asked of it alone.
 */
export function reflexiveClash(data: Data, word: Read<Word>): boolean {
  return (bareVerbValues(data).get(bareVerb(word).toLowerCase())?.size ?? 0) > 1;
}

/** What a `class:` item looks at and the value it asks, or `null` when the lexicon has no such target. */
export function classTarget(data: Data, item: string): ClassTarget | null {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'class') return null;
  return classTargetOf(data, parsed);
}

function classTargetOf(
  data: Data,
  parsed: Extract<ParsedItem, { kind: 'class' }>,
): ClassTarget | null {
  const lexicon = lexiconIndex(data);
  const { dimension, target, detail } = parsed;
  if (dimension === 'consonant') {
    const entry = CONSONANT_ITEMS.find((c) => c.id === target);
    return entry ? { kind: 'consonant', letter: entry.letter, value: entry.value } : null;
  }
  const sentence = lexicon.sentences.get(target);
  if (sentence !== undefined && (SENTENCE_DIMENSIONS.includes(dimension) || detail !== null)) {
    if (detail === null) {
      const value = sentenceValue(sentence, dimension);
      return value === null ? null : { kind: 'sentence', sentence, value };
    }
    const index = Number(detail);
    const token = sentence.sentence.tokens?.[index];
    const value = token === undefined ? null : tokenValue(token, dimension);
    return token !== undefined && value !== null
      ? { kind: 'token', sentence, index, token, value }
      : null;
  }
  const word = lexicon.words.get(target);
  if (word === undefined) return null;
  if (dimension === 'segment') {
    const index = Number(detail);
    const segment = word.segments?.[index];
    const span = segmentSpan(word, index);
    return segment && span ? { kind: 'segment', word, index, role: segment[0], span } : null;
  }
  if (detail !== null) {
    const form = formsOf(word).find((f) => f.cell === detail);
    const value = form?.values[dimension as FormDimension];
    return form && value !== undefined ? { kind: 'form', word, form, value } : null;
  }
  const value = wordDimensionValue(word, dimension);
  return value === null ? null : { kind: 'word', word, value };
}

/**
 * The key of "the same word" for the no-repeat rule (design §6.3: a word's items count as one):
 * a word (`w:`), a sentence (`s:`) or a consonant letter (`c:`).
 */
export function wordKey(data: Data, item: string): string {
  const parsed = parseItemId(item);
  if (parsed === null) return item;
  switch (parsed.kind) {
    case 'spell':
      return `w:${parsed.word}`;
    case 'gap':
      return `s:${parsed.sentence}`;
    case 'class': {
      if (parsed.dimension === 'consonant') return `c:${parsed.target}`;
      const target = classTargetOf(data, parsed);
      if (target?.kind === 'token' || target?.kind === 'sentence') return `s:${parsed.target}`;
      return `w:${parsed.target}`;
    }
    case 'rel':
    case 'pair': {
      const colon = parsed.word.indexOf(':');
      return `w:${colon === -1 ? parsed.word : parsed.word.slice(0, colon)}`;
    }
    default:
      return `w:${parsed.word}`;
  }
}

/** The word a word-based item belongs to (its target word), or `null`. */
export function itemWord(data: Data, item: string): string | null {
  const key = wordKey(data, item);
  return key.startsWith('w:') ? key.slice(2) : null;
}

/** The filled token of a sentence that holds gap `gap` (spaces inside a gap stay in the token). */
export function gapToken(sentence: ParsedSentence, gap: number): string {
  let text = '';
  let at = -1;
  for (const part of sentence.parsed.parts) {
    if (part.kind === 'gap' && part.gap === gap) at = text.length;
    text += part.kind === 'text' ? part.text : sentence.parsed.gaps[part.gap]!.correct;
  }
  if (at === -1) return '';
  const correct = sentence.parsed.gaps[gap]!.correct;
  const start = text.lastIndexOf(' ', at - 1) + 1;
  const end = text.indexOf(' ', at + correct.length);
  return text.slice(start, end === -1 ? text.length : end).replace(/[.,!?…:;„“"]+$/u, '');
}

/** How an item is named for grown-ups and on the diary card: its word, and the text shown. */
export function itemLabel(data: Data, item: string): { word: string | null; text: string } {
  const lexicon = lexiconIndex(data);
  const parsed = parseItemId(item);
  const ofWord = (id: string) => ({ word: id, text: lexicon.words.get(id)?.lemma ?? id });
  if (parsed === null) return { word: null, text: item };
  switch (parsed.kind) {
    case 'spell':
      return ofWord(parsed.word);
    case 'gap': {
      const sentence = lexicon.sentences.get(parsed.sentence);
      const gap = sentence?.sentence.gaps[parsed.gap];
      return {
        word: gap?.word ?? null,
        text: sentence ? gapToken(sentence, parsed.gap) : parsed.sentence,
      };
    }
    case 'class': {
      const target = classTargetOf(data, parsed);
      if (target === null) return { word: null, text: parsed.target };
      switch (target.kind) {
        case 'consonant':
          return { word: null, text: target.letter };
        case 'form':
          return { word: target.word.id, text: target.form.text };
        case 'token':
          return { word: target.token.word ?? null, text: target.token.t };
        case 'sentence':
          return { word: null, text: target.sentence.parsed.plain };
        default:
          return ofWord(target.word.id);
      }
    }
    case 'rel':
    case 'pair': {
      const form = formOfTarget(data, parsed.word);
      return form ?? ofWord(parsed.word);
    }
    default:
      return ofWord(parsed.word);
  }
}

/**
 * The 4th-grade rules and the sentence rules: the first problem of each is taught before it is
 * asked (design §6.4). The 2nd-grade review rules of the lagoon never are.
 */
export const TAUGHT_RULES: readonly SpellingRule[] = [
  'bje-vje',
  'mne',
  'mne-zajmeno',
  'predpona-predlozka',
  'predpona-souhlaska',
  'shoda',
  'vzor',
  'interpunkce',
  'spojka',
];

/**
 * The "teach, then ask" units an item belongs to (design §6.4): a listed family (`family:<id>`,
 * for its `vyjm` points), a taught rule (`rule:<rule>`), a classification (`class:<dimension>`,
 * and `class:case:<n>` per case: a case's question comes before that case).
 */
export function teachUnits(data: Data, item: string): string[] {
  const parsed = parseItemId(item);
  if (parsed === null) return [];
  const units: string[] = [];
  const rule = itemRule(data, item);
  if (rule !== null && TAUGHT_RULES.includes(rule)) units.push(`rule:${rule}`);
  if (parsed.kind === 'spell' && (rule === 'vyjm' || rule === 'vyjm-prefix')) {
    const word = lexiconIndex(data).words.get(parsed.word);
    const family = word?.family ? lexiconIndex(data).families.get(word.family.id) : undefined;
    if (family !== undefined && family.letter !== null) units.push(`family:${family.id}`);
  }
  if (parsed.kind === 'class' && parsed.dimension !== 'consonant') {
    // The consonant classes are the 2nd grade's review: never taught first, like its rules.
    const target = classTargetOf(data, parsed);
    if (parsed.dimension === 'case' && target !== null && target.kind !== 'segment') {
      units.push(`class:case:${'value' in target ? target.value : ''}`);
    } else units.push(`class:${parsed.dimension}`);
  }
  return units;
}

/** Every item of the pack's skills by teach unit. */
export const teachUnitItems: (data: Data) => ReadonlyMap<string, readonly string[]> = perPack(
  (data) => {
    const units = new Map<string, string[]>();
    const seen = new Set<string>();
    for (const skill of data.skills) {
      for (const item of skillItemsCached(data, skill.id)) {
        if (seen.has(item)) continue;
        seen.add(item);
        for (const unit of teachUnits(data, item))
          units.set(unit, [...(units.get(unit) ?? []), item]);
      }
    }
    return units;
  },
);

function skillItemsCached(data: Data, skill: string): readonly string[] {
  return itemIndex(data).get(skill) ?? [];
}
