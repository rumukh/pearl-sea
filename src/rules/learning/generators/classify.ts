/**
 * `classify` (Určování, design §5.7): name one dimension of a consonant letter, a word, a part of a
 * word, a form, a token of a sentence or a whole sentence.
 *
 * The options are the skill's `values` (every value of the dimension when it lists none) in the
 * dimension's school order (`DIMENSION_VALUES`), never shuffled, so each value keeps its place on
 * screen. The target is shown as the child reads it: the letter, the word (a verb asked for its
 * reflexive pronoun without it: bát), the form, the token in
 * its sentence (`context`), a part of a word as its `span` (a zero ending is the empty span after
 * the last letter), or the sentence itself (for `sentence-kind` without its end mark, which would
 * give the kind away).
 */
import type { DeepReadonly } from '@aegis/runtime';
import { DIMENSION_VALUES } from '../../contract';
import type { ClassifyProblem, Dimension, Skill } from '../../contract';
import { classHint } from '../hints';
import { classTarget, reflexiveClash, wordText } from '../item-info';
import type { ClassTarget } from '../item-info';
import { unambiguous } from './companions';
import { cannotPractise } from './shared';
import type { GeneratorSources } from './shared';
import type { Data } from '../../types';

type Params = DeepReadonly<Extract<Skill, { generator: 'classify' }>['params']>;

/** The longest whole sentence a classification shows (contract §5.1). */
export const MAX_SENTENCE_TARGET = 240;
const MAX_TOKEN = 64;
const MAX_TOKENS = 32;

/** The options a classify skill offers: its values (or all), in the dimension's school order. */
export function classifyOptions(params: Params): string[] {
  const all = DIMENSION_VALUES[params.dimension];
  const values = params.values;
  return values === null ? [...all] : all.filter((value) => values.includes(value));
}

/** The value a target has (a part of a word: its role). */
function valueOf(target: ClassTarget): string {
  return target.kind === 'segment' ? target.role : target.value;
}

/** A whole sentence as shown: its filled text, without its end mark when that is the answer. */
export function sentenceTarget(plain: string, dimension: Dimension): string {
  const text = plain.trim();
  return dimension === 'sentence-kind' ? text.replace(/[\s.?!…]+$/u, '') : text;
}

/** How a target is shown: `target`, `context` and `span`, or `null` when it cannot be shown. */
function shown(
  target: ClassTarget,
  dimension: Dimension,
): Pick<ClassifyProblem, 'target' | 'context' | 'span'> | null {
  switch (target.kind) {
    case 'consonant':
      return { target: { word: null, text: target.letter }, context: null, span: null };
    case 'word':
      return {
        target: { word: target.word.id, text: wordText(target.word, dimension) },
        context: null,
        span: null,
      };
    case 'segment':
      return {
        target: { word: target.word.id, text: target.word.lemma },
        context: null,
        span: target.span,
      };
    case 'form':
      return {
        target: { word: target.word.id, text: target.form.text },
        context: null,
        span: null,
      };
    case 'token': {
      const tokens = (target.sentence.sentence.tokens ?? []).map((token) => token.t);
      if (
        tokens.length > MAX_TOKENS ||
        tokens.some((t) => t.length === 0 || t.length > MAX_TOKEN)
      ) {
        return null;
      }
      return {
        target: { word: target.token.word ?? null, text: target.token.t },
        context: { tokens, at: target.index },
        span: null,
      };
    }
    case 'sentence': {
      const text = sentenceTarget(target.sentence.parsed.plain, dimension);
      if (text.length === 0 || text.length > MAX_SENTENCE_TARGET) return null;
      return { target: { word: null, text }, context: null, span: null };
    }
  }
}

/**
 * Whether the skill can ask `item`: a target the lexicon has, shown within bounds, its value
 * offered; a word on its own (or a part of it) never written like another lexicon word, whose
 * value could differ (stát, the noun and the verb); a verb asked for its reflexive pronoun never
 * shown bare like another verb with another one (hrát, hrát si).
 */
export function classifyServable(data: Data, params: Params, item: string): boolean {
  const target = classTarget(data, item);
  if (target === null) return false;
  if ((target.kind === 'word' || target.kind === 'segment') && !unambiguous(data, target.word)) {
    return false;
  }
  if (
    params.dimension === 'reflexive' &&
    target.kind === 'word' &&
    reflexiveClash(data, target.word)
  ) {
    return false;
  }
  const options = classifyOptions(params);
  const view = shown(target, params.dimension);
  return (
    view !== null &&
    options.length >= 2 &&
    options.includes(valueOf(target)) &&
    view.target.text.length <= (target.kind === 'sentence' ? MAX_SENTENCE_TARGET : MAX_TOKEN)
  );
}

export function classifyProblem(
  params: Params,
  item: string,
  sources: GeneratorSources,
): ClassifyProblem {
  const data = sources.data;
  const target = classTarget(data, item);
  if (target === null || !classifyServable(data, params, item)) {
    throw cannotPractise('classify', item);
  }
  return {
    kind: 'classify',
    dimension: params.dimension,
    ...shown(target, params.dimension)!,
    options: classifyOptions(params),
    correct: valueOf(target),
    hint: classHint(params.dimension, target),
  };
}
