/**
 * Problems and answers: structured, never pre-rendered. The shell renders a problem (with the
 * reading font, the ink blots and the letter pad) and the verbalizer reads it aloud; the rules
 * check answers. Every problem is self-contained: `expectedAnswer` derives the answer of each step
 * from the problem alone.
 *
 * | Kind       | What the child does                                                        | Steps                       |
 * | ---------- | -------------------------------------------------------------------------- | --------------------------- |
 * | `gaps`     | fills the ink-blot gaps of a word or sentence, one gap per step            | one per gap (1-3)           |
 * | `classify` | names one dimension of a word (part of speech, gender, case, pattern, …)   | 1                           |
 * | `odd`      | picks the word that does not belong                                        | 1                           |
 * | `relation` | picks the word in a relation (synonym, antonym, general word, …)           | 1                           |
 * | `mistake`  | taps the word the ink spelled wrong, then fixes it (Lov chyb)              | 2: find, then fix           |
 *
 * Item IDs name what the Leitner boxes remember (docs/contract.md §5.4): a spelling point of a
 * word, a sentence gap, a classification of a word, a relation, a pair, a word's place in the
 * alphabet, a word's structure or its family.
 */
import { failure, schema, success } from '@aegis/runtime';
import type { Outcome, Schema } from '@aegis/runtime';
import { CONTENT_ID_PATTERN } from './ids';
import { DIMENSIONS } from './kinds';
import type { Dimension } from './kinds';
import {
  GENDER_CLASSES,
  LISTED_LETTERS,
  NOUN_PATTERNS,
  SPELLING_RULES,
  WORD_RELATIONS,
} from './language';
import type {
  Case,
  GenderClass,
  ListedLetter,
  NounPattern,
  SpellingRule,
  WordRelation,
} from './language';
import type { TextPart } from './lexicon';
import { contentId, int, lazy, nullable, objectWithOptional, oneOf, refine } from './schema';

// ---------------------------------------------------------------------------------------------
// Hints

/**
 * The methods a `method` hint names, each a content line `grammar.method.<method>` (S3 writes them):
 * the case questions asked in turn, the pattern from the gender and the 1st and 2nd case, the
 * tense, the mood and the verb form by their tests, and how sound-alike words differ.
 */
export const HINT_METHODS = [
  'case',
  'pattern',
  'tense',
  'mood',
  'verb-form',
  'sound-alike',
] as const;
export type HintMethod = (typeof HINT_METHODS)[number];

/**
 * A hint shows the strategy, not just the answer (docs/design.md §5.3):
 * - `family`: a related word that proves the spelling (mlýn → mlynář);
 * - `test-word`: a form that makes the sound clear (hrad → hrady, led → ledy);
 * - `listed`: the school rhyme of the listed words after `letter`;
 * - `ten-ta-to`: the gender test (ten pes, ta ryba, to moře); with `plural`, the test of a plural
 *   subject (ti psi, ty ryby, ta kuřata) for agreement;
 * - `case-question`: the case question (kdo? co?, koho? čeho?, …);
 * - `pattern`: the pattern and its ending (o hradech, o strojích);
 * - `rule`: the general explanation of a spelling rule;
 * - `method`: how to find the answer step by step (`HINT_METHODS`), never the answer;
 * - `not-listed`: the word is not a listed word (nor related to one), so i: shown with the gap's
 *   letters blanked (`span`, code points of the lemma: b_lý), never spelled out.
 */
export type Hint =
  | { kind: 'family'; word: string; related: string }
  | { kind: 'test-word'; word: string; test: string }
  | { kind: 'listed'; letter: ListedLetter }
  | { kind: 'ten-ta-to'; gender: GenderClass; plural?: true }
  | { kind: 'case-question'; case: Case }
  | { kind: 'pattern'; pattern: NounPattern }
  | { kind: 'rule'; rule: SpellingRule }
  | { kind: 'method'; method: HintMethod }
  | { kind: 'not-listed'; word: string; span: [number, number] };

// ---------------------------------------------------------------------------------------------
// Problems

/** One gap: the letters (or a whole token) the child writes, and what is offered to choose. */
export interface Gap {
  /** The right text (`ý`, `mně`, `odplavala`, `Vltava`). */
  correct: string;
  /** Options for choice input, in seeded order; includes `correct`; 2-4 entries. */
  options: string[];
  /** Keys of the big letter pad for letter input (i í y ý, ú ů, d t, …); includes `correct`. */
  keys: string[];
  rule: SpellingRule;
  /** The lexicon word the gap is in, or `null`. */
  word: string | null;
  /** The item this gap trains (a spelling point or a sentence gap). */
  item: string;
  hint: Hint | null;
}

/** A word shown on its own or as a token of a sentence, as `classify` and `odd` show it. */
export interface WordRef {
  word: string | null;
  text: string;
}

export interface GapsProblem {
  kind: 'gaps';
  /** The sentence ID, or `null` for a single word. */
  sentence: string | null;
  parts: TextPart[];
  gaps: Gap[];
}

export interface ClassifyProblem {
  kind: 'classify';
  dimension: Dimension;
  /**
   * The word to classify, alone or as the highlighted token `at` of `context`; for a whole
   * sentence (`sentence-kind`, `clauses`) the sentence itself, `word: null`, up to 240 characters
   * and without its end mark for `sentence-kind` (the mark would give the kind away), with no
   * `context`.
   */
  target: WordRef;
  /**
   * The sentence of a token target: its tokens, the highlighted one `at`, and `marks`, the
   * punctuation written right after each token (`''` for none: _Delfíne, skoč!_ is
   * `['Delfíne', 'skoč']` with `[',', '!']`), without which an address reads as a subject.
   */
  context: { tokens: string[]; at: number; marks?: string[] } | null;
  /** For `segment`: the highlighted part of the word, `[start, end)` in code points. */
  span: [number, number] | null;
  /**
   * The category values offered; includes `correct`. In the dimension's school order
   * (`DIMENSION_VALUES`: cases 1-7, the parts of speech 1-10, the patterns by gender), never
   * shuffled, so each value keeps its place on screen.
   */
  options: string[];
  correct: string;
  hint: Hint | null;
}

export interface OddProblem {
  kind: 'odd';
  /** What the odd word differs in: a dimension, its word family, or listed vs not listed. */
  basis: Dimension | 'family' | 'listed';
  words: WordRef[];
  /** Index of the word that does not belong. */
  correct: number;
  hint: Hint | null;
}

export interface RelationProblem {
  kind: 'relation';
  relation: WordRelation;
  target: WordRef;
  options: WordRef[];
  correct: number;
  hint: Hint | null;
}

export interface MistakeProblem {
  kind: 'mistake';
  sentence: string;
  /** The sentence as shown, one token spelled wrong. */
  tokens: string[];
  /**
   * The punctuation right after each token (`''` for none). With `marks`, `tokens` and `around`
   * hold no marks (_dosita_ and `.`, not _dosita._); without it, a token keeps its marks.
   */
  marks?: string[];
  /** Index of the wrong token (step 1: find it). */
  wrong: number;
  /** The fix (step 2): a gap whose `correct` replaces the wrong token's misspelled part. */
  fix: Gap;
  /** The wrong token's text split around the fix (`ml` + gap + `n`). */
  around: [string, string];
}

export type Problem = GapsProblem | ClassifyProblem | OddProblem | RelationProblem | MistakeProblem;
export type ProblemKind = Problem['kind'];
export const PROBLEM_KINDS = ['gaps', 'classify', 'odd', 'relation', 'mistake'] as const;

// ---------------------------------------------------------------------------------------------
// Answers

/**
 * An answer to one step:
 * - `text`: the letters or token written into a gap (choice, letter pad or typed);
 * - `option`: a category value (`classify`);
 * - `pick`: the index of a word in a list (`odd`, `relation`, the find step of `mistake`).
 */
export type AnswerValue =
  | { kind: 'text'; value: string }
  | { kind: 'option'; value: string }
  | { kind: 'pick'; index: number };

/** How many answer steps a problem has. */
export function problemSteps(problem: Problem): number {
  if (problem.kind === 'gaps') return problem.gaps.length;
  return problem.kind === 'mistake' ? 2 : 1;
}

/** The expected answer of step `step` (0-based). */
export function expectedAnswer(problem: Problem, step: number): AnswerValue {
  if (step < 0 || step >= problemSteps(problem)) throw new RangeError(`No step ${step}.`);
  switch (problem.kind) {
    case 'gaps':
      return { kind: 'text', value: problem.gaps[step]!.correct };
    case 'classify':
      return { kind: 'option', value: problem.correct };
    case 'odd':
    case 'relation':
      return { kind: 'pick', index: problem.correct };
    case 'mistake':
      return step === 0
        ? { kind: 'pick', index: problem.wrong }
        : { kind: 'text', value: problem.fix.correct };
  }
}

/**
 * Typed text as compared: NFC, surrounding spaces trimmed, inner runs of spaces collapsed.
 * Case is kept: capital letters are part of what is taught.
 */
export function normalizeTyped(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Whether `value` answers step `step` of `problem`. */
export function isCorrectAnswer(problem: Problem, step: number, value: AnswerValue): boolean {
  const expected = expectedAnswer(problem, step);
  if (expected.kind !== value.kind) return false;
  if (expected.kind === 'pick') return value.kind === 'pick' && value.index === expected.index;
  if (value.kind === 'pick') return false;
  return normalizeTyped(value.value) === normalizeTyped(expected.value);
}

// ---------------------------------------------------------------------------------------------
// Item IDs

/**
 * Item kinds and their IDs:
 *
 * | Kind    | ID                                   | Trains                                          |
 * | ------- | ------------------------------------ | ----------------------------------------------- |
 * | `spell` | `spell:<word>:<at>`                  | a spelling point of a word (mlýn: ý at 2)       |
 * | `gap`   | `gap:<sentence>:<gap>`               | a sentence gap that is not a word's spelling point (shoda, vzor, mě/mně, …) |
 * | `class` | `class:<dimension>:<target>[:<detail>]` | a classification (part of speech, gender, case, person, …) |
 * | `rel`   | `rel:<relation>:<word>`              | a relation of a word (its synonym, antonym, …)  |
 * | `pair`  | `pair:<pair kind>:<word>`            | a memory-match pair of a word                    |
 * | `abc`   | `abc:<word>`                         | a word's place in alphabetical order            |
 * | `seg`   | `seg:<word>`                         | a word's structure (stavba slova)               |
 * | `fam`   | `fam:<word>`                         | a word's family                                  |
 *
 * A classification's target and detail depend on what is classified (skills.ts
 * `CONTEXT_DIMENSIONS`): a word on its own is `class:pos:ryba`; a consonant letter is
 * `class:consonant:cx` (its `lexiconId`); a form names the word and its paradigm cell
 * (`class:person:plavat:past1`, lexicon.ts `formCells`); a token of a sentence names the sentence
 * and the token index (`class:case:s.ryby-1:0`); a whole sentence names the sentence
 * (`class:sentence-kind:s.ryby-1`); a part of a word names the word and the segment index
 * (`class:segment:vyletext:1`).
 */
export const ITEM_KINDS = ['spell', 'gap', 'class', 'rel', 'pair', 'abc', 'seg', 'fam'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_ID_PATTERN =
  /^(spell|gap|class|rel|pair|abc|seg|fam):[a-z0-9]+(?:[-.:][a-z0-9]+)*$/;
export const ITEM_ID_MAX_LENGTH = 128;

export const itemIdSchema: Schema<string> = schema.string({
  minLength: 5,
  maxLength: ITEM_ID_MAX_LENGTH,
  pattern: ITEM_ID_PATTERN,
});

/** Memory-match pairs (`pairs` generator). */
export const PAIR_KINDS = [
  'family', // word ↔ related word (mlýn ↔ mlynář)
  'synonym',
  'antonym',
  'general', // general ↔ specific word
  'sound-alike', // být ↔ bít, each with a picture or gloss
  'plural', // singular ↔ plural (ryba ↔ ryby)
  'pattern', // noun ↔ its pattern (kapr ↔ pán, rybník ↔ hrad)
  'standard', // colloquial ↔ standard (dobrej ↔ dobrý)
] as const;
export type PairKind = (typeof PAIR_KINDS)[number];

export function spellItem(word: string, at: number): string {
  return `spell:${word}:${at}`;
}
export function gapItem(sentence: string, gap: number): string {
  return `gap:${sentence}:${gap}`;
}
export function classItem(dimension: Dimension, word: string, detail?: string): string {
  return detail === undefined
    ? `class:${dimension}:${word}`
    : `class:${dimension}:${word}:${detail}`;
}
export function relationItem(relation: WordRelation, word: string): string {
  return `rel:${relation}:${word}`;
}
export function pairItem(pair: PairKind, word: string): string {
  return `pair:${pair}:${word}`;
}
export function alphabetItem(word: string): string {
  return `abc:${word}`;
}
export function segmentItem(word: string): string {
  return `seg:${word}`;
}
export function familyItem(word: string): string {
  return `fam:${word}`;
}

/** An item ID taken apart, or `null` if it is not one. */
export type ParsedItem =
  | { kind: 'spell'; word: string; at: number }
  | { kind: 'gap'; sentence: string; gap: number }
  | { kind: 'class'; dimension: Dimension; target: string; detail: string | null }
  | { kind: 'rel'; relation: WordRelation; word: string }
  | { kind: 'pair'; pair: PairKind; word: string }
  | { kind: 'abc' | 'seg' | 'fam'; word: string };

/** Content IDs may contain `:`; item parts are split from the ends that cannot. */
export function parseItemId(id: string): ParsedItem | null {
  if (id.length > ITEM_ID_MAX_LENGTH || !ITEM_ID_PATTERN.test(id)) return null;
  const colon = id.indexOf(':');
  const kind = id.slice(0, colon) as ItemKind;
  const rest = id.slice(colon + 1);
  const lastNumber = (text: string): [string, number] | null => {
    const match = /^(.+):(0|[1-9][0-9]{0,2})$/.exec(text);
    return match ? [match[1]!, Number(match[2])] : null;
  };
  const head = (text: string): [string, string] | null => {
    const at = text.indexOf(':');
    return at > 0 ? [text.slice(0, at), text.slice(at + 1)] : null;
  };
  switch (kind) {
    case 'spell': {
      const parts = lastNumber(rest);
      return parts && CONTENT_ID_PATTERN.test(parts[0])
        ? { kind, word: parts[0], at: parts[1] }
        : null;
    }
    case 'gap': {
      const parts = lastNumber(rest);
      return parts && CONTENT_ID_PATTERN.test(parts[0])
        ? { kind, sentence: parts[0], gap: parts[1] }
        : null;
    }
    case 'class': {
      const parts = head(rest);
      if (!parts || !(DIMENSIONS as readonly string[]).includes(parts[0])) return null;
      const detailAt = parts[1].lastIndexOf(':');
      const detail = detailAt > 0 ? parts[1].slice(detailAt + 1) : null;
      const target = detailAt > 0 ? parts[1].slice(0, detailAt) : parts[1];
      return /^[a-z0-9]+$/.test(detail ?? 'x') && CONTENT_ID_PATTERN.test(target)
        ? { kind, dimension: parts[0] as Dimension, target, detail }
        : null;
    }
    case 'rel': {
      const parts = head(rest);
      return parts && (WORD_RELATIONS as readonly string[]).includes(parts[0])
        ? { kind, relation: parts[0] as WordRelation, word: parts[1] }
        : null;
    }
    case 'pair': {
      const parts = head(rest);
      return parts && (PAIR_KINDS as readonly string[]).includes(parts[0])
        ? { kind, pair: parts[0] as PairKind, word: parts[1] }
        : null;
    }
    default:
      return { kind, word: rest };
  }
}

// ---------------------------------------------------------------------------------------------
// Schemas

const shortText = schema.string({ minLength: 1, maxLength: 48 });
const tokenText = schema.string({ minLength: 1, maxLength: 64 });
/** The punctuation after a token: no letter, digit or space, at most 4 characters, or none. */
const mark = refine(schema.string({ maxLength: 4 }), (text) =>
  /^[^\p{L}\p{N}\s]*$/u.test(text) ? null : 'Expected punctuation only.',
);
const marks = schema.array(mark, { min: 1, max: 32 });
/** A non-empty `[start, end)` span of code points within a word. */
const wordSpan = refine(
  schema.array(int(0, 63), { min: 2, max: 2 }) as unknown as Schema<[number, number]>,
  ([start, end]) => (start < end ? null : 'Expected start < end.'),
);

export const hintSchema: Schema<Hint> = schema.union(
  schema.object({ kind: schema.literal('family'), word: contentId, related: contentId }),
  schema.object({ kind: schema.literal('test-word'), word: contentId, test: shortText }),
  schema.object({ kind: schema.literal('listed'), letter: oneOf(LISTED_LETTERS) }),
  objectWithOptional(
    { kind: schema.literal('ten-ta-to'), gender: oneOf(GENDER_CLASSES) },
    { plural: schema.literal(true) },
  ),
  schema.object({ kind: schema.literal('case-question'), case: int(1, 7) as Schema<Case> }),
  schema.object({ kind: schema.literal('pattern'), pattern: oneOf(NOUN_PATTERNS) }),
  schema.object({ kind: schema.literal('rule'), rule: oneOf(SPELLING_RULES) }),
  schema.object({ kind: schema.literal('method'), method: oneOf(HINT_METHODS) }),
  schema.object({ kind: schema.literal('not-listed'), word: contentId, span: wordSpan }),
) as Schema<Hint>;

const textPartSchema: Schema<TextPart> = schema.union(
  schema.object({ kind: schema.literal('text'), text: schema.string({ maxLength: 240 }) }),
  schema.object({ kind: schema.literal('gap'), gap: int(0, 2) }),
);

const gapSchema: Schema<Gap> = schema.object({
  correct: tokenText,
  options: schema.array(tokenText, { min: 2, max: 4 }),
  keys: schema.array(shortText, { min: 2, max: 12 }),
  rule: oneOf(SPELLING_RULES),
  word: nullable(contentId),
  item: itemIdSchema,
  hint: nullable(hintSchema),
});

const wordRefSchema: Schema<WordRef> = schema.object({
  word: nullable(contentId),
  text: tokenText,
});
const tokens = schema.array(tokenText, { min: 1, max: 32 });
/** A classification's target: a word or token, or a whole sentence (up to 240 characters). */
const classifyTargetSchema: Schema<WordRef> = schema.object({
  word: nullable(contentId),
  text: schema.string({ minLength: 1, maxLength: 240 }),
});

/** Structural checks the field schemas cannot express (the gap really is among the options …). */
function coherent(problem: Problem): string | null {
  const gapOk = (gap: Gap) =>
    gap.options.includes(gap.correct) && gap.keys.includes(gap.correct)
      ? null
      : 'Gap answer not offered.';
  switch (problem.kind) {
    case 'gaps': {
      const referenced = problem.parts.flatMap((part) => (part.kind === 'gap' ? [part.gap] : []));
      if (referenced.join() !== problem.gaps.map((_, index) => index).join()) {
        return 'Every gap appears once, in order.';
      }
      return problem.gaps.map(gapOk).find((message) => message !== null) ?? null;
    }
    case 'classify':
      if (!problem.options.includes(problem.correct)) return 'The answer is not offered.';
      if (problem.context && problem.context.at >= problem.context.tokens.length) {
        return 'The highlighted token is out of range.';
      }
      if (
        problem.context?.marks &&
        problem.context.marks.length !== problem.context.tokens.length
      ) {
        return 'Every token has one mark entry.';
      }
      return null;
    case 'odd':
    case 'relation':
      return problem.correct < (problem.kind === 'odd' ? problem.words : problem.options).length
        ? null
        : 'The answer index is out of range.';
    case 'mistake':
      if (problem.marks && problem.marks.length !== problem.tokens.length) {
        return 'Every token has one mark entry.';
      }
      return problem.wrong < problem.tokens.length ? gapOk(problem.fix) : 'No such token.';
  }
}

const problemUnion: Schema<Problem> = schema.union(
  schema.object({
    kind: schema.literal('gaps'),
    sentence: nullable(contentId),
    parts: schema.array(textPartSchema, { min: 1, max: 16 }),
    gaps: schema.array(gapSchema, { min: 1, max: 3 }),
  }),
  schema.object({
    kind: schema.literal('classify'),
    dimension: oneOf(DIMENSIONS),
    target: classifyTargetSchema,
    context: nullable(objectWithOptional({ tokens, at: int(0, 31) }, { marks })),
    span: nullable(
      schema.array(int(0, 63), { min: 2, max: 2 }) as unknown as Schema<[number, number]>,
    ),
    options: schema.array(shortText, { min: 2, max: 14 }),
    correct: shortText,
    hint: nullable(hintSchema),
  }),
  schema.object({
    kind: schema.literal('odd'),
    basis: oneOf([...DIMENSIONS, 'family', 'listed'] as const),
    words: schema.array(wordRefSchema, { min: 3, max: 6 }),
    correct: int(0, 5),
    hint: nullable(hintSchema),
  }),
  schema.object({
    kind: schema.literal('relation'),
    relation: oneOf(WORD_RELATIONS),
    target: wordRefSchema,
    options: schema.array(wordRefSchema, { min: 2, max: 6 }),
    correct: int(0, 5),
    hint: nullable(hintSchema),
  }),
  objectWithOptional(
    {
      kind: schema.literal('mistake'),
      sentence: contentId,
      tokens,
      wrong: int(0, 31),
      fix: gapSchema,
      around: schema.array(schema.string({ maxLength: 64 }), {
        min: 2,
        max: 2,
      }) as unknown as Schema<[string, string]>,
    },
    { marks },
  ),
);

export const problemSchema: Schema<Problem> = lazy(() => ({
  parse(value: unknown, path = ''): Outcome<Problem> {
    const parsed = problemUnion.parse(value, path);
    if (!parsed.ok) return parsed;
    const problem = coherent(parsed.value);
    return problem === null ? success(parsed.value) : failure('invalid-data', problem, { path });
  },
}));

export const answerValueSchema: Schema<AnswerValue> = schema.union(
  schema.object({
    kind: schema.literal('text'),
    value: schema.string({ minLength: 1, maxLength: 64 }),
  }),
  schema.object({ kind: schema.literal('option'), value: shortText }),
  schema.object({ kind: schema.literal('pick'), index: int(0, 31) }),
);

/** A problem step: which gap, or the find/fix step of a mistake. */
export type ProblemStep = number;
