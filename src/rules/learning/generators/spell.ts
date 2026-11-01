/**
 * The spelling generators (contract §6.1): `spell.word` (a word with 1-3 letter gaps),
 * `spell.sentence` (a sentence with 1-3 gaps, filled one by one: Inkoustová věta) and
 * `spell.mistake` (a sentence with one mistake: find it, then fix it: Lov chyb).
 *
 * Every gap is a spelling point of a word (`spell:<word>:<at>`) or a sentence gap that is no
 * word's point (`gap:<sentence>:<gap>`), so a sentence gap on a word's point trains the word's own
 * item. A word is never asked bare when one of its gap's options or pad keys spells another word
 * of the lexicon (být × bít, pila × píla, pyl × pil): such a point is asked in a sentence that has
 * a gap on it, and an item with no such sentence cannot be served (`spellServable`).
 */
import type { DeepReadonly } from '@aegis/runtime';
import { codePoints, gapItem, matchesSentenceFilter, parseItemId, spellItem } from '../../contract';
import type {
  Gap,
  GapsProblem,
  MistakeProblem,
  SentenceFilter,
  SpellingPoint,
  SpellingRule,
  TextPart,
  Word,
} from '../../contract';
import { gapOptions, padKeys } from '../distractors';
import { gapHint } from '../hints';
import { lexiconIndex } from '../index-cache';
import type { ParsedSentence } from '../index-cache';
import { spellPoint } from '../item-info';
import { sample } from '../random';
import type { GeneratorSources } from './shared';
import { cannotPractise } from './shared';
import type { Data } from '../../types';

type Read<T> = DeepReadonly<T>;

/** The word with the letters of `point` replaced by `text`. */
function respelled(word: Read<Word>, point: Read<SpellingPoint>, text: string): string {
  const letters = codePoints(word.lemma);
  const length = codePoints(point.correct).length;
  return [...letters.slice(0, point.at), text, ...letters.slice(point.at + length)].join('');
}

/**
 * Whether a point is ambiguous bare: one of its alternatives or of its rule's pad keys spells
 * another lemma or form of the lexicon. Such a point is asked only in a sentence.
 */
export function ambiguousBare(data: Data, word: Read<Word>, point: Read<SpellingPoint>): boolean {
  const spellings = lexiconIndex(data).spellings;
  const keys = padKeys(point.rule, point.correct, point.alt);
  return [...point.alt, ...keys].some((text) => {
    if (text === point.correct) return false;
    const other = respelled(word, point, text);
    return other !== word.lemma && spellings.has(other);
  });
}

/** Two points overlap when their letters share a position. */
function overlaps(a: Read<SpellingPoint>, b: Read<SpellingPoint>): boolean {
  const aEnd = a.at + codePoints(a.correct).length;
  const bEnd = b.at + codePoints(b.correct).length;
  return a.at < bEnd && b.at < aEnd;
}

/** A gap of a word's spelling point, with its options and keys. */
function wordGap(
  data: Data,
  word: Read<Word>,
  point: Read<SpellingPoint>,
  choices: number,
  sources: GeneratorSources,
): Gap {
  return {
    correct: point.correct,
    options: gapOptions(
      point.rule,
      point.correct,
      point.alt,
      choices,
      sources.distractors,
      codePoints(word.lemma)[point.at - 1] ?? null,
    ),
    keys: padKeys(point.rule, point.correct, point.alt),
    rule: point.rule,
    word: word.id,
    item: spellItem(word.id, point.at),
    hint: gapHint(data, point.rule, word, point, null),
  };
}

/** Text parts with adjacent text merged and empty text dropped. */
function compact(parts: readonly TextPart[]): TextPart[] {
  const out: TextPart[] = [];
  for (const part of parts) {
    const last = out[out.length - 1];
    if (part.kind === 'text') {
      if (part.text === '') continue;
      if (last?.kind === 'text') last.text += part.text;
      else out.push({ kind: 'text', text: part.text });
    } else out.push(part);
  }
  return out;
}

/** The sentences a sentence skill may use for an item: they have the item's gap, in a rule it lists. */
export function sentencesFor(
  data: Data,
  item: string,
  filter: Read<SentenceFilter> | null,
  rules: readonly SpellingRule[] | null,
): { sentence: ParsedSentence; gap: number }[] {
  const lexicon = lexiconIndex(data);
  const parsed = parseItemId(item);
  const fits = (sentence: ParsedSentence, gap: number) => {
    const annotation = sentence.sentence.gaps[gap];
    return (
      annotation !== undefined &&
      (filter === null || matchesSentenceFilter(sentence.sentence, filter)) &&
      (rules === null || rules.includes(annotation.rule))
    );
  };
  if (parsed?.kind === 'gap') {
    const sentence = lexicon.sentences.get(parsed.sentence);
    const annotation = sentence?.sentence.gaps[parsed.gap];
    // A gap on a word's point trains the word's item, never a `gap:` item.
    if (!sentence || !annotation || (annotation.word !== null && annotation.point !== undefined)) {
      return [];
    }
    return fits(sentence, parsed.gap) ? [{ sentence, gap: parsed.gap }] : [];
  }
  if (parsed?.kind !== 'spell') return [];
  const found: { sentence: ParsedSentence; gap: number }[] = [];
  for (const id of lexicon.pointSentences.get(`${parsed.word}:${parsed.at}`) ?? []) {
    const sentence = lexicon.sentences.get(id)!;
    sentence.sentence.gaps.forEach((annotation, gap) => {
      if (
        annotation.word === parsed.word &&
        annotation.point === parsed.at &&
        fits(sentence, gap)
      ) {
        found.push({ sentence, gap });
      }
    });
  }
  return found;
}

/** The letter right before gap `index` of a sentence (with the gaps before it filled), or `null`. */
function letterBeforeGap(sentence: ParsedSentence, index: number): string | null {
  let before = '';
  for (const part of sentence.parsed.parts) {
    if (part.kind === 'gap' && part.gap === index) break;
    before += part.kind === 'text' ? part.text : sentence.parsed.gaps[part.gap]!.correct;
  }
  return codePoints(before).at(-1) ?? null;
}

/** The gap of sentence gap `index`, with options from its written alternatives. */
function sentenceGap(
  data: Data,
  sentence: ParsedSentence,
  index: number,
  sources: GeneratorSources,
): Gap {
  const parsed = sentence.parsed.gaps[index]!;
  const annotation = sentence.sentence.gaps[index]!;
  const lexicon = lexiconIndex(data);
  const word = annotation.word === null ? null : (lexicon.words.get(annotation.word) ?? null);
  const point =
    word !== null && annotation.point !== undefined
      ? (word.spelling?.find((p) => p.at === annotation.point) ?? null)
      : null;
  const count = Math.min(sources.choices, 1 + parsed.alternatives.length);
  return {
    correct: parsed.correct,
    options: gapOptions(
      annotation.rule,
      parsed.correct,
      parsed.alternatives,
      count,
      sources.distractors,
      letterBeforeGap(sentence, index),
    ),
    keys: padKeys(annotation.rule, parsed.correct, parsed.alternatives),
    rule: annotation.rule,
    word: annotation.word,
    item: sentenceGapItem(sentence, index),
    hint: gapHint(data, annotation.rule, word, point, { parsed: sentence, gap: annotation }),
  };
}

/** The item a sentence gap trains: its word's spelling point, else the gap itself. */
function sentenceGapItem(sentence: ParsedSentence, index: number): string {
  const annotation = sentence.sentence.gaps[index]!;
  return annotation.word !== null && annotation.point !== undefined
    ? spellItem(annotation.word, annotation.point)
    : gapItem(sentence.sentence.id, index);
}

/** A sentence with the gaps `shown` (indices into its gaps) as ink blots; the rest filled. */
export function sentenceProblem(
  data: Data,
  sentence: ParsedSentence,
  shown: readonly number[],
  sources: GeneratorSources,
): GapsProblem {
  const order = [...shown].sort((a, b) => a - b);
  const parts: TextPart[] = sentence.parsed.parts.map((part) => {
    if (part.kind === 'text') return part;
    const at = order.indexOf(part.gap);
    return at === -1
      ? { kind: 'text', text: sentence.parsed.gaps[part.gap]!.correct }
      : { kind: 'gap', gap: at };
  });
  return {
    kind: 'gaps',
    sentence: sentence.sentence.id,
    parts: compact(parts),
    gaps: order.map((index) => sentenceGap(data, sentence, index, sources)),
  };
}

/**
 * The gaps a sentence skill shows: the drawn gap and up to two more of the skill's rules (at most
 * 3, in text order), each item once: a word written twice (_dál a dál_) is asked at the drawn gap,
 * the other one filled.
 */
function shownGaps(
  sentence: ParsedSentence,
  drawn: number,
  rules: readonly SpellingRule[],
): number[] {
  const asked = new Set([sentenceGapItem(sentence, drawn)]);
  const others = sentence.sentence.gaps
    .map((annotation, index) => ({ annotation, index }))
    .filter(({ annotation, index }) => {
      if (index === drawn || !rules.includes(annotation.rule)) return false;
      const item = sentenceGapItem(sentence, index);
      if (asked.has(item)) return false;
      asked.add(item);
      return true;
    })
    .map(({ index }) => index);
  return [drawn, ...others.slice(0, 2)].sort((a, b) => a - b);
}

export interface SpellRequest {
  /** Only the drawn item's gap (a re-ask, the placement check, the race). */
  single?: boolean;
  /** The word alone where possible (a re-ask of a sentence round's item). */
  alone?: boolean;
}

/** Whether a `spell:` item can be asked by `spell.word` (bare, or in a sentence on its point). */
export function spellServable(data: Data, item: string): boolean {
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'spell') return false;
  const found = spellPoint(data, parsed.word, parsed.at);
  if (found === null) return false;
  return (
    !ambiguousBare(data, found.word, found.point) || sentencesFor(data, item, null, null).length > 0
  );
}

/** `spell.word`: the word with the drawn point and up to `maxGaps - 1` more as gaps. */
export function spellWordProblem(
  params: Read<{ rules: SpellingRule[]; maxGaps: number; choices: number }>,
  item: string,
  sources: GeneratorSources,
  request: SpellRequest = {},
): GapsProblem {
  const data = sources.data;
  const parsed = parseItemId(item);
  const found = parsed?.kind === 'spell' ? spellPoint(data, parsed.word, parsed.at) : null;
  if (found === null || !params.rules.includes(found.point.rule)) {
    throw cannotPractise('spell.word', item);
  }
  const { word, point } = found;
  if (ambiguousBare(data, word, point)) {
    // A sound-alike or otherwise ambiguous point: the sentence decides.
    const sentences = sentencesFor(data, item, null, null);
    if (sentences.length === 0) throw cannotPractise('spell.word', item);
    const pick = sources.problems.pick(sentences);
    return sentenceProblem(data, pick.sentence, [pick.gap], sources);
  }
  const others = (word.spelling ?? []).filter(
    (other) =>
      other.at !== point.at &&
      params.rules.includes(other.rule) &&
      !overlaps(other, point) &&
      !ambiguousBare(data, word, other),
  );
  const extra = request.single ? [] : sample(others, params.maxGaps - 1, sources.problems);
  const points: Read<SpellingPoint>[] = [point];
  for (const other of extra) if (!points.some((p) => overlaps(p, other))) points.push(other);
  points.sort((a, b) => a.at - b.at);
  const letters = codePoints(word.lemma);
  const parts: TextPart[] = [];
  let cursor = 0;
  points.forEach((p, index) => {
    parts.push({ kind: 'text', text: letters.slice(cursor, p.at).join('') });
    parts.push({ kind: 'gap', gap: index });
    cursor = p.at + codePoints(p.correct).length;
  });
  parts.push({ kind: 'text', text: letters.slice(cursor).join('') });
  return {
    kind: 'gaps',
    sentence: null,
    parts: compact(parts),
    gaps: points.map((p) => wordGap(data, word, p, params.choices, sources)),
  };
}

/** `spell.sentence`: a sentence with the drawn gap and the skill's other gaps (1-3). */
export function spellSentenceProblem(
  params: Read<{ sentences: SentenceFilter; rules: SpellingRule[] }>,
  item: string,
  sources: GeneratorSources,
  request: SpellRequest = {},
): GapsProblem {
  const data = sources.data;
  if (request.alone) {
    const parsed = parseItemId(item);
    const found = parsed?.kind === 'spell' ? spellPoint(data, parsed.word, parsed.at) : null;
    if (found !== null && !ambiguousBare(data, found.word, found.point)) {
      return spellWordProblem(
        { rules: [found.point.rule], maxGaps: 1, choices: sources.choices },
        item,
        sources,
        { single: true },
      );
    }
  }
  const candidates = sentencesFor(data, item, params.sentences, params.rules);
  if (candidates.length === 0) throw cannotPractise('spell.sentence', item);
  const pick = sources.problems.pick(candidates);
  const shown = request.single ? [pick.gap] : shownGaps(pick.sentence, pick.gap, params.rules);
  return sentenceProblem(data, pick.sentence, shown, sources);
}

/**
 * The shown sentence of a mistake: every gap filled right except `wrong`, which shows `text`,
 * split into tokens at spaces (a gap's own spaces stay inside its token), with the wrong token
 * and the text around the gap in it.
 */
export function mistakeTokens(
  sentence: ParsedSentence,
  wrong: number,
  text: string,
): { tokens: string[]; index: number; around: [string, string] } {
  let shown = '';
  let start = -1;
  for (const part of sentence.parsed.parts) {
    if (part.kind === 'text') shown += part.text;
    else if (part.gap === wrong) {
      start = shown.length;
      shown += text;
    } else shown += sentence.parsed.gaps[part.gap]!.correct;
  }
  const end = start + text.length;
  const tokens: string[] = [];
  let index = -1;
  let around: [string, string] = ['', ''];
  let tokenStart = 0;
  for (let at = 0; at <= shown.length; at++) {
    const inside = at >= start && at < end;
    if (at < shown.length && (shown[at] !== ' ' || inside)) continue;
    if (at > tokenStart) {
      if (start >= tokenStart && start <= at && index === -1) {
        index = tokens.length;
        around = [shown.slice(tokenStart, start), shown.slice(end, at)];
      }
      tokens.push(shown.slice(tokenStart, at));
    }
    tokenStart = at + 1;
  }
  return { tokens, index, around };
}

/** `spell.mistake`: a sentence with the drawn gap spelled wrong (one of its alternatives). */
export function spellMistakeProblem(
  params: Read<{ sentences: SentenceFilter; rules: SpellingRule[] }>,
  item: string,
  sources: GeneratorSources,
): MistakeProblem {
  const data = sources.data;
  const candidates = sentencesFor(data, item, params.sentences, params.rules);
  if (candidates.length === 0) throw cannotPractise('spell.mistake', item);
  const pick = sources.problems.pick(candidates);
  const parsedGap = pick.sentence.parsed.gaps[pick.gap]!;
  const wrongText = sources.distractors.pick(parsedGap.alternatives);
  const { tokens, index, around } = mistakeTokens(pick.sentence, pick.gap, wrongText);
  return {
    kind: 'mistake',
    sentence: pick.sentence.sentence.id,
    tokens,
    wrong: index,
    fix: sentenceGap(data, pick.sentence, pick.gap, sources),
    around,
  };
}
