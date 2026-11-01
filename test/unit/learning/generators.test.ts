/**
 * The spelling generators, exhaustively (src/rules/learning/generate.ts, generators/spell.ts), with
 * their options, letter-pad keys and hints (distractors.ts, hints.ts). For both fixture packs every
 * servable item of every problem skill is asked with several seeds, 2-4 grade choices and the
 * requests a round makes (`{}`, `single`, `alone`); so are the spell.word skills across their
 * parameter ranges (choices 2-4, maxGaps 1-3) and test skills of every rule and sentence of a pack.
 * The game's pack (content/pearl-sea.content.json) is surveyed the same way with fewer seeds and
 * its grade's choices: its own skills, and every spelling point and sentence gap of its lexicon.
 * Every problem must pass the contract's schema; every step's expected answer must be the
 * independent oracle's (test/traces/support.ts: read off the lexicon's raw letters and
 * `{correct|alt}` sentences); options, keys, items, shapes, mistakes and hints must follow
 * docs/design.md §5.2-§5.6 and §6.6 as restated here from the raw lexicon, never from the
 * generator. Points ambiguous bare (pas × pás) are asked only in sentences (být × bít, without one,
 * never), and every item of the three packs can be served.
 */
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import {
  PAIRED_CONSONANTS,
  compareCzech,
  expectedAnswer,
  gradeBalance,
  isCorrectAnswer,
  parseGappedText,
  problemSchema,
  problemSteps,
  skillItems,
} from '../../../src/rules/contract';
import type {
  AnswerValue,
  ContentData,
  Gap,
  GappedText,
  GapsProblem,
  Hint,
  MistakeProblem,
  Problem,
  Sentence,
  SentenceFilter,
  SentenceGap,
  Skill,
  SpellingPoint,
  SpellingRule,
  Word,
} from '../../../src/rules/contract';
import { gapOptions, padKeys, rankedMistakes } from '../../../src/rules/learning/distractors';
import {
  canGenerate,
  problemFor,
  servableIndex,
  unservableItems,
} from '../../../src/rules/learning/generate';
import type { GeneratorSources, ProblemRequest } from '../../../src/rules/learning/generate';
import {
  ambiguousBare,
  mistakeTokens,
  sentenceProblem,
  spellServable,
} from '../../../src/rules/learning/generators/spell';
import { gapHint } from '../../../src/rules/learning/hints';
import { itemIndex, lexiconIndex } from '../../../src/rules/learning/index-cache';
import type { ParsedSentence } from '../../../src/rules/learning/index-cache';
import { lagoonPack, miniPack, realPack } from '../../fixtures/rules/packs';
import { oracle } from '../../traces/support';

const lagoon = lagoonPack().data;
const mini = miniPack().data;
/** The fixture packs, surveyed with every seed, choice count and request. */
const PACKS = [
  ['lagoon', lagoon],
  ['mini', mini],
] as const;
/** The game's pack (content/pearl-sea.content.json), surveyed with fewer seeds: it is large. */
const real = realPack().data;
const ALL_PACKS = [...PACKS, ['real', real]] as const;

// ---------------------------------------------------------------- the raw lexicon (independent)

/** A lexicon sentence filled right, with where each of its gaps starts in the filled text. */
interface Filled {
  sentence: Sentence;
  parsed: GappedText;
  plain: string;
  starts: number[];
}

interface Raw {
  words: Map<string, Word>;
  sentences: Map<string, Filled>;
  /** Every lemma and paradigm form as written, and every sound-alike form. */
  spellings: Set<string>;
}

const raws = new Map<ContentData, Raw>();

function rawOf(data: ContentData): Raw {
  const known = raws.get(data);
  if (known !== undefined) return known;
  const sentences = new Map<string, Filled>();
  for (const sentence of data.lexicon.sentences) {
    const parsed = parseGappedText(sentence.text);
    let plain = '';
    const starts: number[] = [];
    for (const part of parsed.parts) {
      if (part.kind === 'text') plain += part.text;
      else {
        starts[part.gap] = plain.length;
        plain += parsed.gaps[part.gap]!.correct;
      }
    }
    sentences.set(sentence.id, { sentence, parsed, plain, starts });
  }
  const spellings = new Set<string>();
  const add = (cells: readonly (string | readonly string[])[]) => {
    for (const cell of cells)
      for (const text of typeof cell === 'string' ? [cell] : cell) {
        spellings.add(text);
      }
  };
  for (const word of data.lexicon.words) {
    spellings.add(word.lemma);
    add([...(word.noun?.paradigm?.sg ?? []), ...(word.noun?.paradigm?.pl ?? [])]);
    const verb = word.verb?.paradigm;
    if (verb) {
      add([verb.inf, ...verb.pres, ...verb.imp, ...Object.values(verb.past), ...(verb.fut ?? [])]);
    }
  }
  for (const pair of data.lexicon.relations.soundAlikes) {
    for (const ref of pair) if (typeof ref !== 'string') spellings.add(ref.form);
  }
  const raw = { words: new Map(data.lexicon.words.map((w) => [w.id, w])), sentences, spellings };
  raws.set(data, raw);
  return raw;
}

const IY_RULES: readonly SpellingRule[] = [
  'vyjm',
  'vyjm-prefix',
  'obojetna-i',
  'tvrda',
  'mekka',
  'dtn-mekke',
  'vzor',
];
const E_RULES: readonly SpellingRule[] = ['de-te-ne', 'be-pe-ve-me', 'bje-vje'];
const U_RULES: readonly SpellingRule[] = ['u-zacatek', 'u-predpona', 'u-uprostred', 'u-prejate'];
const VOWELS: readonly (readonly string[])[] = [
  ['a', 'á'],
  ['e', 'é'],
  ['i', 'í'],
  ['o', 'ó'],
  ['u', 'ú', 'ů'],
  ['y', 'ý'],
];
const capital = (text: string) => text.slice(0, 1).toUpperCase() + text.slice(1);

/** The big letter pad of a rule for an answer (design §5.2), in the answer's case. */
function rulePad(rule: SpellingRule, correct: string): string[] {
  const lower = correct.toLowerCase();
  if (rule === 'velke-pismeno') return [lower, capital(lower)];
  let pad: readonly string[] = [];
  if (IY_RULES.includes(rule)) pad = ['i', 'í', 'y', 'ý'];
  else if (E_RULES.includes(rule)) pad = ['e', 'é', 'ě', 'je'];
  else if (rule === 'mne' || rule === 'mne-zajmeno') pad = ['mě', 'mně'];
  else if (U_RULES.includes(rule)) pad = ['u', 'ú', 'ů'];
  else if (rule === 'delka') pad = VOWELS.find((pair) => pair.includes(lower)) ?? [];
  else if (rule === 'parova') {
    pad = PAIRED_CONSONANTS.find((pair) => (pair as readonly string[]).includes(lower)) ?? [];
  } else if (rule === 'shoda') pad = ['i', 'y', 'a'];
  return correct === lower ? [...pad] : pad.map(capital);
}

/** End marks first (. ? ! ,), then Czech alphabetical: the order of a gap's own options as keys. */
const MARKS = ['.', '?', '!', ','];
function ownKeyOrder(a: string, b: string): number {
  const mark = (text: string) => (MARKS.includes(text) ? MARKS.indexOf(text) : MARKS.length);
  return mark(a) - mark(b) || compareCzech(a, b);
}

/**
 * The slips a bě, pě, vě, mě point offers (design §6.6): the one heard, je after b, p, v, f or ně
 * after m, then e; without a letter before the gap, all three.
 */
function heardSlips(word: Word, point: SpellingPoint): string[] {
  const before = [...word.lemma.toLowerCase()][point.at - 1];
  const slips =
    before === 'm'
      ? ['ně', 'e']
      : before !== undefined && ['b', 'p', 'v', 'f'].includes(before)
        ? ['je', 'e']
        : ['je', 'ně', 'e'];
  return point.correct === point.correct.toLowerCase() ? slips : slips.map(capital);
}

/** The word with the letters of `point` replaced by `text`. */
function respell(word: Word, point: SpellingPoint, text: string): string {
  const letters = [...word.lemma];
  const end = point.at + [...point.correct].length;
  return [...letters.slice(0, point.at), text, ...letters.slice(end)].join('');
}

/** Whether a point is ambiguous bare: an alternative or a pad key spells another word or form. */
function ambiguous(data: ContentData, word: Word, point: SpellingPoint): boolean {
  const { spellings } = rawOf(data);
  return [...point.alt, ...rulePad(point.rule, point.correct)].some((text) => {
    if (text === point.correct) return false;
    const other = respell(word, point, text);
    return other !== word.lemma && spellings.has(other);
  });
}

/** The word and spelling point a `spell:` item names, or `null`. */
function spellPointOf(
  data: ContentData,
  item: string,
): { word: Word; point: SpellingPoint } | null {
  const match = /^spell:(.+):(\d+)$/.exec(item);
  const word = match ? rawOf(data).words.get(match[1]!) : undefined;
  const point = word?.spelling?.find((p) => p.at === Number(match![2]));
  return word && point ? { word, point } : null;
}

/** The item a sentence gap trains: its word's point, else the gap itself (contract §5.4). */
function sentenceItem(sentence: Sentence, index: number): string {
  const gap = sentence.gaps[index]!;
  return gap.word !== null && gap.point !== undefined
    ? `spell:${gap.word}:${gap.point}`
    : `gap:${sentence.id}:${index}`;
}

function matchesFilter(sentence: Sentence, filter: SentenceFilter): boolean {
  return (
    (filter.sentences === undefined || filter.sentences.includes(sentence.id)) &&
    (filter.topics === undefined || filter.topics.some((t) => sentence.topics.includes(t))) &&
    (filter.grades === undefined || filter.grades.includes(sentence.grade))
  );
}

/** The strategy a gap's hint shows (design §5.3). */
function expectedHint(
  data: ContentData,
  rule: SpellingRule,
  word: Word | null,
  point: SpellingPoint | null,
  gap: SentenceGap | null,
  sentence: Sentence | null,
): Hint {
  const ruleHint: Hint = { kind: 'rule', rule };
  switch (rule) {
    case 'vyjm': {
      const family = data.lexicon.families.find((f) => f.id === word?.family?.id);
      if (word === null || family === undefined) return ruleHint;
      if (family.head !== word.id) return { kind: 'family', word: word.id, related: family.head };
      return family.letter !== null ? { kind: 'listed', letter: family.letter } : ruleHint;
    }
    case 'obojetna-i': {
      // After a listed letter: not listed, shown with its gap; never the rhyme of y-words (S3's
      // Czech QA: a look-alike in it, být for bít, would confirm the slip). Else the rule line.
      const letters = word ? [...word.lemma.toLowerCase()] : [];
      const before = point && point.at > 0 ? letters[point.at - 1] : undefined;
      return word && point && before !== undefined && 'blmpsvz'.includes(before)
        ? {
            kind: 'not-listed',
            word: word.id,
            span: [point.at, point.at + [...point.correct].length],
          }
        : ruleHint;
    }
    case 'parova':
    case 'u-uprostred':
      return word && point?.test !== undefined
        ? { kind: 'test-word', word: word.id, test: point.test }
        : ruleHint;
    case 'mne-zajmeno':
      return gap?.case !== undefined ? { kind: 'case-question', case: gap.case } : ruleHint;
    case 'shoda': {
      // A plural subject's test: ti, ty, ta (ty děti → -y), never to dítě.
      const subject = gap?.subjects?.[0];
      const token = subject === undefined ? undefined : sentence?.tokens?.[subject];
      if (token?.gender === undefined) return ruleHint;
      return token.number === 'pl'
        ? { kind: 'ten-ta-to', gender: token.gender, plural: true }
        : { kind: 'ten-ta-to', gender: token.gender };
    }
    case 'vzor':
      return word?.noun?.pattern ? { kind: 'pattern', pattern: word.noun.pattern } : ruleHint;
    default:
      return ruleHint;
  }
}

// ---------------------------------------------------------------- the survey

const REQUESTS = {
  plain: {},
  single: { single: true },
  alone: { alone: true },
} as const satisfies Record<string, ProblemRequest>;
type RequestName = keyof typeof REQUESTS;
const SEEDS = ['tide', 'reef', 'kelp', 'shell', 'foam', 'wave'];
/** Grade choices: every count a grade may set (`balance.grades`), the packs' 4 included. */
const CHOICES = [2, 3, 4];

interface Case {
  pack: string;
  data: ContentData;
  skill: Skill;
  item: string;
  request: RequestName;
  seed: string;
  choices: number;
  problem: Problem;
}

function sources(data: ContentData, seed: string, choices: number): GeneratorSources {
  return {
    problems: createPrng(`${seed}:problems`),
    distractors: createPrng(`${seed}:distractors`),
    words: createPrng(`${seed}:words`),
    data,
    choices,
  };
}

/** Every servable item of the skills, asked with every request, seed and number of choices. */
function survey(
  pack: string,
  data: ContentData,
  skills: readonly Skill[],
  seeds: readonly string[] = SEEDS,
  choicesList: readonly number[] = CHOICES,
): Case[] {
  const served = servableIndex(data);
  const cases: Case[] = [];
  for (const skill of skills) {
    // A skill of the pack serves what `servableIndex` says; a test skill its servable universe.
    const items =
      served.get(skill.id) ??
      skillItems(skill, data.lexicon).filter((item) => servable(data, skill, item));
    for (const request of Object.keys(REQUESTS) as RequestName[]) {
      for (const seed of seeds) {
        for (const choices of choicesList) {
          // One set of streams per round-like run: the items share it, as a round's problems do.
          const streams = sources(data, `${seed}:${skill.id}:${request}:${choices}`, choices);
          for (const item of items) {
            const problem = problemFor(skill, item, streams, REQUESTS[request]);
            cases.push({ pack, data, skill, item, request, seed, choices, problem });
          }
        }
      }
    }
  }
  return cases;
}

/** The problem skills of a pack: the spelling generators and the choice generators. */
const problemSkills = (data: ContentData) => data.skills.filter((skill) => canGenerate(skill));
/**
 * The spelling skills this survey asks; classify, odd and relation have their own survey
 * (choice-generators.test.ts).
 */
const spellSkills = (data: ContentData) => data.skills.filter((skill) => isSpell(skill));

/** A spell.word skill across its parameter ranges (choices 2-4, maxGaps 1-3), but itself. */
function variants(skill: Skill): Skill[] {
  if (skill.generator !== 'spell.word') return [];
  const out: Skill[] = [];
  for (const choices of [2, 3, 4]) {
    for (const maxGaps of [1, 2, 3]) {
      if (choices === skill.params.choices && maxGaps === skill.params.maxGaps) continue;
      out.push({ ...skill, params: { ...skill.params, choices, maxGaps } });
    }
  }
  return out;
}

/**
 * Test skills of every rule and every sentence of a pack, so that every spelling point and gap is
 * asked and a sentence shows all its gaps at once.
 */
function wide(data: ContentData): Skill[] {
  const gapRules = [...new Set(data.lexicon.sentences.flatMap((s) => s.gaps.map((g) => g.rule)))];
  const pointRules = [
    ...new Set(data.lexicon.words.flatMap((w) => (w.spelling ?? []).map((p) => p.rule))),
  ];
  const test = { titleKey: 'skill.test', strand: 'letters-sounds' } as const;
  return [
    {
      ...test,
      id: 'sk.test.spell.word',
      generator: 'spell.word',
      params: { words: {}, rules: pointRules, maxGaps: 3, choices: 4 },
    },
    ...(['spell.sentence', 'spell.mistake'] as const).map((generator) => ({
      ...test,
      id: `sk.test.${generator}`,
      generator,
      params: { sentences: {}, rules: gapRules },
    })),
  ];
}

/**
 * Whether a test skill can serve an item of its universe: a sentence skill's items come from its
 * sentences; spell.word asks a point bare, or in a sentence with a gap on it when it is ambiguous
 * bare (design §6.6), and cannot serve it at all without such a sentence.
 */
function servable(data: ContentData, skill: Skill, item: string): boolean {
  if (skill.generator !== 'spell.word') return true;
  const spell = spellPointOf(data, item);
  if (spell === null) return false;
  const carried = data.lexicon.sentences.some((sentence) =>
    sentence.gaps.some((_, index) => sentenceItem(sentence, index) === item),
  );
  return !ambiguous(data, spell.word, spell.point) || carried;
}

let allCases: Case[] | undefined;
function cases(): Case[] {
  const choices = (data: ContentData) => [gradeBalance(data.balance, 3).input.choices];
  allCases ??= [
    ...PACKS.flatMap(([name, data]) => [
      ...survey(name, data, spellSkills(data)),
      ...survey(name, data, spellSkills(data).flatMap(variants), SEEDS.slice(0, 3), choices(data)),
      ...survey(name, data, wide(data), SEEDS.slice(0, 3)),
    ]),
    // The game's pack: its own skills with two seeds, and every point and gap of its lexicon once.
    ...survey('real', real, spellSkills(real), SEEDS.slice(0, 2), choices(real)),
    ...survey('real', real, wide(real), SEEDS.slice(0, 1), choices(real)),
  ];
  return allCases;
}

// ---------------------------------------------------------------- the checks

type Check =
  | 'schema'
  | 'answer'
  | 'options'
  | 'real'
  | 'keys'
  | 'item'
  | 'shape'
  | 'mistake'
  | 'ambiguous'
  | 'hint'
  | 'heard';
type Say = (check: Check, message: string) => void;

/** A gap of a problem found in the raw lexicon by where it stands. */
interface Located {
  gap: Gap;
  /** In a bare word (`word`) or a sentence (`sentence`, with the sentence gap's `index`). */
  kind: 'word' | 'sentence';
  sentence: Filled | null;
  index: number;
  /** The lexicon word the gap is in, and the spelling point it tests. */
  word: Word | null;
  point: SpellingPoint | null;
  correct: string;
  alternatives: readonly string[];
  rule: SpellingRule;
  item: string;
  hint: Hint;
}

/** The gaps of a bare word, by the code points the parts spell. */
function locateWord(data: ContentData, problem: GapsProblem, say: Say): Located[] {
  const word = rawOf(data).words.get(problem.gaps[0]?.word ?? '');
  if (word === undefined) {
    say('item', `no word ${problem.gaps[0]?.word}`);
    return [];
  }
  const letters = [...word.lemma];
  const located: Located[] = [];
  let at = 0;
  for (const part of problem.parts) {
    if (part.kind === 'text') {
      const length = [...part.text].length;
      if (letters.slice(at, at + length).join('') !== part.text) {
        say('item', `"${part.text}" is not in ${word.lemma} at ${at}`);
      }
      at += length;
      continue;
    }
    const point = word.spelling?.find((p) => p.at === at);
    const gap = problem.gaps[part.gap];
    if (point === undefined || gap === undefined) {
      say('item', `no spelling point of ${word.lemma} at ${at}`);
      return located;
    }
    located[part.gap] = {
      gap,
      kind: 'word',
      sentence: null,
      index: -1,
      word,
      point,
      correct: point.correct,
      alternatives: point.alt,
      rule: point.rule,
      item: `spell:${word.id}:${point.at}`,
      hint: expectedHint(data, point.rule, word, point, null, null),
    };
    at += [...point.correct].length;
  }
  if (at !== letters.length) say('item', `the parts spell ${at} of the letters of ${word.lemma}`);
  return located;
}

/** Sentence gap `index` of a sentence, shown as `gap`. */
function sentenceGap(data: ContentData, filled: Filled, index: number, gap: Gap): Located {
  const annotation = filled.sentence.gaps[index]!;
  const word = annotation.word === null ? null : (rawOf(data).words.get(annotation.word) ?? null);
  const point =
    annotation.point === undefined
      ? null
      : (word?.spelling?.find((p) => p.at === annotation.point) ?? null);
  const parsed = filled.parsed.gaps[index]!;
  return {
    gap,
    kind: 'sentence',
    sentence: filled,
    index,
    word,
    point,
    correct: parsed.correct,
    alternatives: parsed.alternatives,
    rule: annotation.rule,
    item: sentenceItem(filled.sentence, index),
    hint: expectedHint(data, annotation.rule, word, point, annotation, filled.sentence),
  };
}

/** The gaps of a sentence, by where they stand in the filled sentence. */
function locateSentence(data: ContentData, problem: GapsProblem, say: Say): Located[] {
  const filled = rawOf(data).sentences.get(problem.sentence ?? '');
  if (filled === undefined) {
    say('item', `no sentence ${problem.sentence}`);
    return [];
  }
  const located: Located[] = [];
  let at = 0;
  for (const part of problem.parts) {
    if (part.kind === 'text') {
      if (filled.plain.slice(at, at + part.text.length) !== part.text) {
        say('item', `"${part.text}" is not in "${filled.plain}" at ${at}`);
      }
      at += part.text.length;
      continue;
    }
    const index = filled.starts.indexOf(at);
    const gap = problem.gaps[part.gap];
    if (index === -1 || gap === undefined) {
      say('item', `no gap of "${filled.sentence.text}" at ${at}`);
      return located;
    }
    located[part.gap] = sentenceGap(data, filled, index, gap);
    at += filled.parsed.gaps[index]!.correct.length;
  }
  if (at !== filled.plain.length) say('item', `the parts do not spell "${filled.plain}"`);
  return located;
}

/**
 * The fix of a mistake: the shown sentence must be the sentence with exactly one authored
 * alternative swapped in, the wrong token the one holding it, and the fix must give it back.
 * Each token's punctuation is its mark (`marks`): tokens start and end with a letter or digit, and
 * marks are punctuation only; only a slip in punctuation itself keeps the marks in its tokens.
 */
function locateMistake(data: ContentData, problem: MistakeProblem, say: Say): Located[] {
  const filled = rawOf(data).sentences.get(problem.sentence);
  if (filled === undefined) {
    say('mistake', `no sentence ${problem.sentence}`);
    return [];
  }
  const marks = problem.marks;
  const join = (tokens: readonly string[]) =>
    tokens.map((token, i) => `${token}${marks?.[i] ?? ''}`).join(' ');
  const shown = join(problem.tokens);
  const swaps: { index: number; alt: string }[] = [];
  filled.parsed.gaps.forEach((gap, index) => {
    const start = filled.starts[index]!;
    for (const alt of gap.alternatives) {
      const text =
        filled.plain.slice(0, start) + alt + filled.plain.slice(start + gap.correct.length);
      if (text === shown) swaps.push({ index, alt });
    }
  });
  if (swaps.length !== 1) {
    say('mistake', `"${shown}" is not "${filled.plain}" with one authored alternative`);
    return [];
  }
  const { index, alt } = swaps[0]!;
  const correct = filled.parsed.gaps[index]!.correct;
  const token = shown.slice(0, filled.starts[index]).split(' ').length - 1;
  if (problem.wrong !== token) say('mistake', `wrong is ${problem.wrong}, the slip is in ${token}`);
  if (problem.tokens.some((t) => t.length === 0)) say('mistake', `an empty token in "${shown}"`);
  if (marks === undefined) {
    // Only a slip in punctuation (an end mark) leaves the marks in the tokens.
    if (!/[^\p{L}\p{N}\s]/u.test(`${alt}${correct}`)) say('mistake', `no marks in "${shown}"`);
  } else {
    const bare = /^[\p{L}\p{N}](?:.*[\p{L}\p{N}])?$/u;
    const strays = problem.tokens.filter((t) => !bare.test(t));
    if (strays.length > 0) say('mistake', `tokens holding marks: ${strays.join(' ')}`);
    if (marks.some((m) => !/^[^\p{L}\p{N}\s]{0,4}$/u.test(m))) say('mistake', `marks ${marks}`);
  }
  const [before, after] = problem.around;
  if (`${before}${alt}${after}` !== problem.tokens[problem.wrong]) {
    say('mistake', `around ${JSON.stringify(problem.around)} is not the wrong token's`);
  }
  const fixed = join(
    problem.tokens.map((t, i) => (i === problem.wrong ? `${before}${correct}${after}` : t)),
  );
  if (fixed !== filled.plain) say('mistake', `the fix gives "${fixed}", not "${filled.plain}"`);
  if (problem.fix.correct !== correct) say('mistake', `the fix is "${problem.fix.correct}"`);
  return [sentenceGap(data, filled, index, problem.fix)];
}

/** One expected answer per step, the oracle's; every other option, key or token is refused. */
function checkAnswers(c: Case, say: Say): void {
  const { data, problem } = c;
  const steps = problemSteps(problem);
  const want = problem.kind === 'gaps' ? problem.gaps.length : 2;
  if (steps !== want) say('answer', `${steps} steps, not ${want}`);
  for (let step = 0; step < steps; step++) {
    let right: AnswerValue;
    try {
      right = oracle(data, problem, step);
    } catch (error) {
      say('answer', `step ${step}: the oracle finds no answer (${(error as Error).message})`);
      continue;
    }
    const expected = expectedAnswer(problem, step);
    if (!isDeepStrictEqual(expected, right)) {
      say(
        'answer',
        `step ${step}: ${JSON.stringify(expected)}, the oracle ${JSON.stringify(right)}`,
      );
    }
    if (!isCorrectAnswer(problem, step, right)) say('answer', `step ${step}: the answer refused`);
    if (right.kind === 'pick') {
      const tokens = problem.kind === 'mistake' ? problem.tokens.length : 0;
      for (let index = 0; index < tokens; index++) {
        if (index !== right.index && isCorrectAnswer(problem, step, { kind: 'pick', index })) {
          say('answer', `step ${step}: token ${index} is taken too`);
        }
      }
    } else if (right.kind === 'text') {
      const gap =
        problem.kind === 'gaps'
          ? problem.gaps[step]
          : problem.kind === 'mistake'
            ? problem.fix
            : undefined;
      for (const value of [...(gap?.options ?? []), ...(gap?.keys ?? [])]) {
        if (value !== right.value && isCorrectAnswer(problem, step, { kind: 'text', value })) {
          say('answer', `step ${step}: "${value}" is taken too`);
        }
      }
    }
  }
}

/** Options, real alternatives, keys, the item and the hint of one gap. */
function checkGap(c: Case, where: Located, say: Say): void {
  const { gap } = where;
  const label = `gap "${where.correct}" of ${where.kind === 'word' ? where.word!.lemma : where.sentence!.plain}`;
  if (gap.item !== where.item) say('item', `${label} trains ${gap.item}, its place ${where.item}`);
  if (gap.word !== (where.word?.id ?? null)) say('item', `${label} names the word ${gap.word}`);
  if (gap.rule !== where.rule) say('item', `${label} names the rule ${gap.rule}`);
  if (gap.correct !== where.correct) say('item', `${label} has the answer "${gap.correct}"`);

  const options = gap.options;
  const choices =
    where.kind === 'word' && c.skill.generator === 'spell.word'
      ? c.skill.params.choices
      : c.choices;
  if (options.length < 2 || options.length > Math.min(4, choices)) {
    say('options', `${label}: ${options.length} options for ${choices} choices`);
  }
  if (new Set(options).size !== options.length) say('options', `${label}: repeats ${options}`);
  if (options.filter((o) => o === where.correct).length !== 1) {
    say('options', `${label}: the answer is not offered once in ${options}`);
  }
  if (!options.some((o) => where.alternatives.includes(o))) {
    say('options', `${label}: no authored alternative among ${options}`);
  }
  if (where.kind === 'word' && IY_RULES.includes(where.rule) && options.length !== choices) {
    say('options', `${label}: ${options.length} of i í y ý for ${choices} choices`);
  }
  if (
    where.kind === 'sentence' &&
    options.length !== Math.min(choices, 1 + where.alternatives.length)
  ) {
    say('options', `${label}: ${options.length} options for ${choices} choices`);
  }

  for (const option of options) {
    if (option === where.correct) continue;
    if (where.kind === 'sentence') {
      if (!where.alternatives.includes(option))
        say('real', `${label}: "${option}" is not authored`);
      continue;
    }
    const word = where.word!;
    const point = where.point!;
    if (point.rule === 'be-pe-ve-me') {
      if (![...point.alt, ...heardSlips(word, point)].includes(option)) {
        say('heard', `${label}: "${respell(word, point, option)}" is no slip one hears`);
      }
    } else if (![...point.alt, ...rulePad(point.rule, point.correct)].includes(option)) {
      say('real', `${label}: "${respell(word, point, option)}" is no alternative nor a pad slip`);
    }
    if (rawOf(c.data).spellings.has(respell(word, point, option))) {
      say('real', `${label}: "${respell(word, point, option)}" is another correct spelling`);
    }
  }

  const keys = gap.keys;
  if (!keys.includes(where.correct)) say('keys', `${label}: the pad ${keys} cannot write it`);
  if (new Set(keys).size !== keys.length) say('keys', `${label}: repeated keys ${keys}`);
  if (keys.length < 2 || keys.length > 12) say('keys', `${label}: ${keys.length} keys`);
  for (const alt of where.alternatives) {
    if (!keys.includes(alt)) say('keys', `${label}: the alternative "${alt}" is not on ${keys}`);
  }
  const pad = rulePad(where.rule, where.correct);
  if (pad.includes(where.correct) && pad.some((key) => !keys.includes(key))) {
    say('keys', `${label}: the ${where.rule} pad ${pad} is not all on ${keys}`);
  }
  // Design §5.2: only the keys of the gap's rule (and the gap's own options where it has none).
  const stray = keys.filter((key) => key !== where.correct && !where.alternatives.includes(key));
  if (stray.some((key) => !pad.includes(key))) {
    say('keys', `${label}: ${stray} are no keys of the ${where.rule} pad`);
  }
  // Own options (a whole word, an end mark) in a fixed order: the answer's place tells nothing.
  if (!pad.includes(where.correct) && !isDeepStrictEqual(keys, [...keys].sort(ownKeyOrder))) {
    say('keys', `${label}: the own options ${keys} are not in the fixed order`);
  }

  if (!isDeepStrictEqual(gap.hint, where.hint)) {
    say(
      'hint',
      `${label}: ${JSON.stringify(gap.hint)}, the strategy ${JSON.stringify(where.hint)}`,
    );
  }
}

type SpellSkill = Extract<Skill, { generator: 'spell.word' | 'spell.sentence' | 'spell.mistake' }>;
const isSpell = (skill: Skill): skill is SpellSkill =>
  skill.generator === 'spell.word' ||
  skill.generator === 'spell.sentence' ||
  skill.generator === 'spell.mistake';

const gapsOf = (problem: Problem): Gap[] =>
  problem.kind === 'gaps' ? problem.gaps : problem.kind === 'mistake' ? [problem.fix] : [];

/** What the skill and the request ask for: how many gaps, where, and in which sentence. */
function checkShape(c: Case, located: readonly Located[], say: Say): void {
  const { data, problem, skill, item, request } = c;
  if (!isSpell(skill) || (problem.kind !== 'gaps' && problem.kind !== 'mistake')) {
    say('shape', `a ${problem.kind} problem of ${skill.generator}`);
    return;
  }
  const rules = skill.params.rules;
  const drawn = gapsOf(problem).filter((gap) => gap.item === item).length;
  if (drawn !== 1) say('item', `the drawn item has ${drawn} gaps`);
  for (const gap of gapsOf(problem))
    if (!rules.includes(gap.rule)) say('shape', `a ${gap.rule} gap`);
  const filled =
    problem.sentence === null ? undefined : rawOf(data).sentences.get(problem.sentence);
  if (filled !== undefined) {
    const words = filled.plain.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
    if (words > 10) say('shape', `${words} words in "${filled.plain}"`);
  }
  for (const where of located) {
    if (where.kind === 'word' && ambiguous(data, where.word!, where.point!)) {
      say('ambiguous', `${where.word!.lemma} at ${where.point!.at} is asked bare`);
    }
  }
  const spell = spellPointOf(data, item);
  const bare = spell !== null && !ambiguous(data, spell.word, spell.point);
  if (problem.kind === 'mistake') {
    if (skill.generator !== 'spell.mistake') say('shape', 'a mistake of another generator');
    else if (filled && !matchesFilter(filled.sentence, skill.params.sentences)) {
      say('shape', `${problem.sentence} is not one of the skill's sentences`);
    }
    if (request === 'alone') say('shape', 'a re-ask hunts the mistake again');
    return;
  }
  if (problem.gaps.length < 1 || problem.gaps.length > 3) {
    say('shape', `${problem.gaps.length} gaps`);
  }
  if (request === 'single' && problem.gaps.length !== 1) {
    say('shape', `a single request shows ${problem.gaps.length} gaps`);
  }
  if (skill.generator === 'spell.word') {
    if (problem.sentence === null && problem.gaps.length > skill.params.maxGaps) {
      say('shape', `${problem.gaps.length} gaps, at most ${skill.params.maxGaps}`);
    }
    if (problem.sentence !== null && bare) say('shape', 'a word asked in a sentence needlessly');
    return;
  }
  // spell.sentence, and the re-ask of spell.mistake: the word alone where it can be asked bare.
  if (request === 'alone' && bare) {
    if (problem.sentence !== null || problem.gaps.length !== 1) {
      say('shape', 'a re-ask does not ask the word alone');
    }
    return;
  }
  if (filled === undefined) {
    say('shape', `${item} is asked without its sentence`);
    return;
  }
  if (!matchesFilter(filled.sentence, skill.params.sentences)) {
    say('shape', `${problem.sentence} is not one of the skill's sentences`);
  }
  // The drawn gap and up to two more of the skill's rules in text order, each item once (a word
  // written twice is asked at the drawn gap); the drawn gap alone when single, or a hunted mistake
  // re-asked.
  const drawnIndex = located.find((where) => where.item === item)?.index ?? -1;
  const single = request === 'single' || skill.generator === 'spell.mistake';
  const seen = new Set([item]);
  const others = single
    ? []
    : filled.sentence.gaps
        .map((gap, index) => ({ gap, index }))
        .filter(({ gap, index }) => {
          if (index === drawnIndex || !rules.includes(gap.rule)) return false;
          const other = sentenceItem(filled.sentence, index);
          if (seen.has(other)) return false;
          seen.add(other);
          return true;
        })
        .map(({ index }) => index)
        .slice(0, 2);
  const expected = [drawnIndex, ...others].sort((a, b) => a - b);
  const shown = located.map((where) => where.index);
  if (!isDeepStrictEqual(shown, expected)) {
    say('shape', `${problem.sentence} shows gaps ${shown}, not ${expected}`);
  }
}

function violations(c: Case): { check: Check; message: string }[] {
  const out: { check: Check; message: string }[] = [];
  const say: Say = (check, message) =>
    out.push({
      check,
      message: `${c.pack} ${c.skill.id} ${c.item} ${c.request} ${c.seed}/${c.choices}: ${message}`,
    });
  const { data, problem } = c;
  const schema = problemSchema.parse(problem);
  if (!schema.ok) say('schema', JSON.stringify(schema.error.diagnostics));
  checkAnswers(c, say);
  const located = (
    problem.kind === 'mistake'
      ? locateMistake(data, problem, say)
      : problem.kind === 'gaps'
        ? problem.sentence === null
          ? locateWord(data, problem, say)
          : locateSentence(data, problem, say)
        : []
  ).filter((where): where is Located => where !== undefined);
  for (const where of located) checkGap(c, where, say);
  checkShape(c, located, say);
  return out;
}

let allViolations: { check: Check; message: string }[] | undefined;
/** The survey's violations of one check (the first few, for a readable failure). */
function found(check: Check): string[] {
  allViolations ??= cases().flatMap(violations);
  const list = allViolations.filter((v) => v.check === check).map((v) => v.message);
  return list.length > 8 ? [...list.slice(0, 8), `… ${list.length} in all`] : list;
}

// ---------------------------------------------------------------- the tests

describe('the problem generators', () => {
  it('make problems of the spelling and choice generators; boards are minigames, never problems', () => {
    const boards = ['alphabet', 'pairs', 'sort', 'segment', 'family'];
    const choices = ['classify', 'odd', 'relation'];
    for (const [, data] of ALL_PACKS) {
      for (const skill of data.skills) {
        if (skill.generator.startsWith('spell.')) expect(canGenerate(skill), skill.id).toBe(true);
        if (choices.includes(skill.generator)) expect(canGenerate(skill), skill.id).toBe(true);
        if (boards.includes(skill.generator)) expect(canGenerate(skill), skill.id).toBe(false);
      }
    }
  });

  it('can serve every item of every problem skill of the three packs', () => {
    for (const [name, data] of ALL_PACKS) {
      expect(unservableItems(data), name).toEqual([]);
      const served = servableIndex(data);
      for (const skill of problemSkills(data)) {
        expect(served.get(skill.id), skill.id).toEqual(itemIndex(data).get(skill.id));
        expect(served.get(skill.id)?.length, skill.id).toBeGreaterThan(0);
      }
    }
    // The survey below really is exhaustive: the three packs, all their spelling skills and items.
    const surveyed = new Set(
      cases()
        .filter((c) => !c.skill.id.startsWith('sk.test.'))
        .map((c) => `${c.pack} ${c.skill.id} ${c.item}`),
    );
    const items = ALL_PACKS.flatMap(([name, data]) =>
      spellSkills(data).flatMap((skill) =>
        (itemIndex(data).get(skill.id) ?? []).map((item) => `${name} ${skill.id} ${item}`),
      ),
    );
    expect([...surveyed].sort()).toEqual([...items].sort());
    expect(items.length).toBeGreaterThan(70);
  });

  it('refuse an item the skill can never produce, by name', () => {
    const skill = (id: string) => lagoon.skills.find((s) => s.id === id)!;
    const streams = sources(lagoon, 'refuse', 4);
    // Each item's rule is outside the skill's rules.
    expect(() => problemFor(skill('sk.lagoon.hard'), 'spell:pexna:1', streams)).toThrow(
      /spell\.word cannot practise spell:pexna:1/,
    );
    expect(() => problemFor(skill('sk.lagoon.dtn.s'), 'spell:vltava:0', streams)).toThrow(
      /spell\.sentence cannot practise spell:vltava:0/,
    );
    expect(() => problemFor(skill('sk.lagoon.capitals.m'), 'spell:ryba:1', streams)).toThrow(
      /spell\.mistake cannot practise spell:ryba:1/,
    );
    expect(() => problemFor(skill('sk.lagoon.abc'), 'abc:ryba', streams)).toThrow(
      /makes no single problems/,
    );
  });
});

describe('every servable item, seed and request (exhaustive)', () => {
  it('covers every shape and every rule the packs ask', () => {
    const shapes = new Set(
      cases().map(({ problem }) =>
        problem.kind === 'gaps'
          ? `${problem.sentence === null ? 'word' : 'sentence'} of ${problem.gaps.length}`
          : problem.kind,
      ),
    );
    expect([...shapes]).toEqual(
      expect.arrayContaining([
        'mistake',
        'sentence of 1',
        'sentence of 2',
        'sentence of 3',
        'word of 1',
        'word of 2',
      ]),
    );
    const rules = new Set(cases().flatMap((c) => gapsOf(c.problem).map((gap) => gap.rule)));
    expect([...rules]).toEqual(
      expect.arrayContaining([
        'be-pe-ve-me',
        'bje-vje',
        'de-te-ne',
        'delka',
        'dtn-mekke',
        'mekka',
        'parova',
        'shoda',
        'spisovne',
        'tvrda',
        'u-predpona',
        'u-uprostred',
        'u-zacatek',
        'velke-pismeno',
        'vyjm',
        'vyjm-prefix',
      ]),
    );
  });

  it('passes the contract schema', () => {
    expect(found('schema')).toEqual([]);
  });

  it("has one expected answer per step, the oracle's; no other option, key or token is taken", () => {
    expect(found('answer')).toEqual([]);
  });

  it('offers 2-4 options as the choices allow, the answer once and an authored alternative', () => {
    expect(found('options')).toEqual([]);
  });

  it('offers only authored alternatives or slips of the rule pad, never another right spelling', () => {
    expect(found('real')).toEqual([]);
  });

  it("gives a letter pad that writes the answer: the rule's keys and every authored alternative", () => {
    expect(found('keys')).toEqual([]);
  });

  it("trains with every gap the item of its word point or sentence gap, the drawn item's once", () => {
    expect(found('item')).toEqual([]);
  });

  it("shows one gap when single, 1-3 gaps of the skill's rules in a sentence of at most 10 words, the word alone on a re-ask", () => {
    expect(found('shape')).toEqual([]);
  });

  it('hunts a mistake that is one authored alternative in one token, fixed back to the right text', () => {
    expect(found('mistake')).toEqual([]);
  });

  it('asks a point that is ambiguous bare (pas × pás) only in a sentence', () => {
    expect(found('ambiguous')).toEqual([]);
    const asked = cases().filter((c) => c.item === 'spell:pas:1' || c.item === 'spell:paas:1');
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.filter((c) => c.problem.kind === 'gaps' && c.problem.sentence === null)).toEqual(
      [],
    );
  });

  it('hints the strategy of design §5.3', () => {
    expect(found('hint')).toEqual([]);
  });

  it('offers a bě, pě, vě, mě word the slip one hears: je after b, p, v, f, ně after m, then e', () => {
    // Design §6.6: the heard je or ně (objed, mněsto), whatever the choices (a re-ask of a
    // sentence round asks the word alone with the grade's 4 choices): never obněd or mjesto.
    expect(found('heard')).toEqual([]);
  });

  it('gives the same problems for the same seeds, and varies them with other seeds', () => {
    const run = (seed: string) =>
      survey('lagoon', lagoon, spellSkills(lagoon), [seed], [4]).map((c) => c.problem);
    const first = run('tide');
    expect(isDeepStrictEqual(run('tide'), first)).toBe(true);
    const other = run('other');
    expect(other.length).toBe(first.length);
    expect(
      other.filter((problem, i) => !isDeepStrictEqual(problem, first[i])).length,
    ).toBeGreaterThan(first.length / 10);
  });

  it('offers the answer in every position: a seeded order, never a giveaway', () => {
    const positions = new Map<number, number[]>();
    for (const c of cases()) {
      for (const gap of gapsOf(c.problem)) {
        const counts = positions.get(gap.options.length) ?? gap.options.map(() => 0);
        const at = gap.options.indexOf(gap.correct);
        counts[at] = (counts[at] ?? 0) + 1;
        positions.set(gap.options.length, counts);
      }
    }
    expect([...positions.keys()].sort()).toEqual([2, 3, 4]);
    for (const [length, counts] of positions) {
      const total = counts.reduce((sum, count) => sum + count, 0);
      for (const [position, count] of counts.entries()) {
        expect(count, `${length} options, the answer at ${position}`).toBeGreaterThan(
          total / length / 2,
        );
      }
    }
  });

  it('reaches every sentence that carries an item', () => {
    for (const [name, data] of PACKS) {
      for (const skill of problemSkills(data)) {
        if (
          skill.generator !== 'spell.word' &&
          skill.generator !== 'spell.sentence' &&
          skill.generator !== 'spell.mistake'
        ) {
          continue;
        }
        for (const item of servableIndex(data).get(skill.id) ?? []) {
          const spell = spellPointOf(data, item);
          // spell.word asks a sentence only for a point ambiguous bare.
          const bare = spell === null || !ambiguous(data, spell.word, spell.point);
          if (skill.generator === 'spell.word' && bare) continue;
          const carriers = data.lexicon.sentences
            .filter((sentence) =>
              sentence.gaps.some(
                (gap, index) =>
                  sentenceItem(sentence, index) === item &&
                  (skill.generator === 'spell.word' ||
                    (skill.params.rules.includes(gap.rule) &&
                      matchesFilter(sentence, skill.params.sentences))),
              ),
            )
            .map((sentence) => sentence.id);
          const used = new Set(
            cases()
              .filter((c) => c.pack === name && c.skill === skill && c.item === item)
              .filter((c) => c.request !== 'alone')
              .map((c) =>
                c.problem.kind === 'gaps' || c.problem.kind === 'mistake'
                  ? c.problem.sentence
                  : null,
              ),
          );
          expect([...used].sort(), `${name} ${skill.id} ${item}`).toEqual(carriers.sort());
        }
      }
    }
  });
});

describe("the survey's checks", () => {
  /** The checks a broken copy of a surveyed problem fails. */
  function broken(
    find: (c: Case) => boolean,
    breakIt: (problem: Problem) => Problem | void,
    request?: RequestName,
  ): Set<Check> {
    const c = cases().find(find);
    if (c === undefined) throw new Error('no such case');
    const copy = structuredClone(c.problem);
    const problem = breakIt(copy) ?? copy;
    return new Set(
      violations({ ...c, problem, request: request ?? c.request }).map((v) => v.check),
    );
  }
  const asked =
    (skill: string, item: string, request: RequestName = 'plain') =>
    (c: Case) =>
      c.pack === 'lagoon' && c.skill.id === skill && c.item === item && c.request === request;
  const ryba = asked('sk.lagoon.hard', 'spell:ryba:1');
  const first = (problem: Problem) => gapsOf(problem)[0]!;
  const wrongOption = (gap: Gap) => gap.options.find((option) => option !== gap.correct)!;

  it('catch every kind of broken problem, so that the survey cannot pass vacuously', () => {
    expect(cases().some(ryba)).toBe(true);
    expect(broken(ryba, () => {})).toEqual(new Set());
    expect(broken(ryba, (p) => void (first(p).options = [first(p).correct]))).toContain('schema');
    expect(broken(ryba, (p) => void (first(p).correct = wrongOption(first(p))))).toContain(
      'answer',
    );
    expect(broken(ryba, (p) => void first(p).options.push(wrongOption(first(p))))).toContain(
      'options',
    );
    expect(broken(ryba, (p) => void (first(p).options = [first(p).correct, 'x']))).toContain(
      'real',
    );
    expect(broken(ryba, (p) => void (first(p).keys = ['i', 'y', 'í']))).toContain('keys');
    expect(broken(ryba, (p) => void first(p).keys.push('ů'))).toContain('keys');
    expect(broken(ryba, (p) => void (first(p).item = 'spell:chyba:2'))).toContain('item');
    expect(broken(ryba, (p) => void (first(p).hint = { kind: 'rule', rule: 'mekka' }))).toContain(
      'hint',
    );
    const dite = (c: Case) =>
      asked('sk.lagoon.dtn', 'spell:diitex:1')(c) && gapsOf(c.problem).length === 2;
    expect(broken(dite, () => {}, 'single')).toContain('shape');
    const hunt = asked('sk.lagoon.dtn.m', 'spell:texlo:1');
    expect(
      broken(hunt, (p) => {
        if (p.kind === 'mistake') p.wrong = (p.wrong + 1) % p.tokens.length;
      }),
    ).toContain('mistake');
    const pas = asked('sk.lagoon.length', 'spell:pas:1');
    expect(
      broken(pas, (p): Problem => ({
        kind: 'gaps',
        sentence: null,
        parts: [
          { kind: 'text', text: 'p' },
          { kind: 'gap', gap: 0 },
          { kind: 'text', text: 's' },
        ],
        gaps: [first(p)],
      })),
    ).toContain('ambiguous');
    const obed = asked('sk.lagoon.bepeveme', 'spell:obexd:2');
    expect(broken(obed, (p) => void (first(p).options = ['ě', 'ně']))).toContain('heard');
    const mesto = asked('sk.lagoon.bepeveme', 'spell:mexsto:1');
    expect(broken(mesto, (p) => void (first(p).options = ['ě', 'je']))).toContain('heard');
  });
});

describe('ambiguous bare points (ambiguousBare)', () => {
  it('are those an alternative or a pad key respells into another word: pas × pás, být × bít', () => {
    const points = (data: ContentData) =>
      data.lexicon.words.flatMap((word) =>
        (word.spelling ?? []).map((point) => ({
          word,
          point,
          item: `spell:${word.id}:${point.at}`,
        })),
      );
    for (const [name, data] of ALL_PACKS) {
      for (const { word, point, item } of points(data)) {
        expect(ambiguousBare(data, word, point), `${name} ${item}`).toBe(
          ambiguous(data, word, point),
        );
      }
    }
    const of = (data: ContentData) =>
      points(data)
        .filter(({ word, point }) => ambiguousBare(data, word, point))
        .map(({ item }) => item)
        .sort();
    expect(of(lagoon)).toEqual(expect.arrayContaining(['spell:paas:1', 'spell:pas:1']));
    expect(of(mini)).toEqual(['spell:biit:1', 'spell:byyt:1']);
  });

  it('are served in a sentence on the point, or never: být and bít have no sentence', () => {
    const word = wide(mini)[0]!;
    for (const [name, data] of ALL_PACKS) {
      for (const entry of data.lexicon.words) {
        for (const point of entry.spelling ?? []) {
          const item = `spell:${entry.id}:${point.at}`;
          expect(spellServable(data, item), `${name} ${item}`).toBe(servable(data, word, item));
        }
      }
    }
    expect(spellServable(lagoon, 'spell:pas:1')).toBe(true);
    expect(spellServable(mini, 'spell:byyt:1')).toBe(false);
    expect(() => problemFor(word, 'spell:byyt:1', sources(mini, 'bare', 4))).toThrow(
      /spell\.word cannot practise spell:byyt:1/,
    );
  });
});

describe('the tokens of a mistake (mistakeTokens)', () => {
  /** A sentence of the test's own (mistakeTokens reads only its parsed text). */
  const made = (text: string): ParsedSentence =>
    ({
      sentence: { id: 's.made', grade: 3, topics: [], text, gaps: [] },
      parsed: parseGappedText(text),
      words: [],
    }) as unknown as ParsedSentence;

  it('split the shown sentence at spaces and find the wrong token and the text around the slip', () => {
    const ticho = made('T{i|y}chá r{y|i}ba spí pod kamenem.');
    expect(mistakeTokens(ticho, 0, 'y')).toEqual({
      tokens: ['Tychá', 'ryba', 'spí', 'pod', 'kamenem'],
      marks: ['', '', '', '', '.'],
      index: 0,
      around: ['T', 'chá'],
    });
    expect(mistakeTokens(ticho, 1, 'i')).toEqual({
      tokens: ['Tichá', 'riba', 'spí', 'pod', 'kamenem'],
      marks: ['', '', '', '', '.'],
      index: 1,
      around: ['r', 'ba'],
    });
    expect(mistakeTokens(made('Řeka {V|v}ltava teče přes celé Čechy.'), 0, 'v')).toEqual({
      tokens: ['Řeka', 'vltava', 'teče', 'přes', 'celé', 'Čechy'],
      marks: ['', '', '', '', '', '.'],
      index: 1,
      around: ['', 'ltava'],
    });
    expect(mistakeTokens(made('Na pláži stojí písečný hra{d|t}.'), 0, 't')).toEqual({
      tokens: ['Na', 'pláži', 'stojí', 'písečný', 'hrat'],
      marks: ['', '', '', '', '.'],
      index: 4,
      around: ['hra', ''],
    });
  });

  it('give each token its punctuation as its mark: the comma of address, of clauses, the end mark', () => {
    // S3's Czech QA: ~dosita.~ and the fix dos[ ]ta. showed the end mark as part of the word.
    expect(mistakeTokens(made('Krabe, pojď sem, r{y|i}chle!'), 0, 'i')).toEqual({
      tokens: ['Krabe', 'pojď', 'sem', 'richle'],
      marks: [',', '', ',', '!'],
      index: 3,
      around: ['r', 'chle'],
    });
    expect(mistakeTokens(made('Vlk se najedl dos{y|i}ta.'), 0, 'i')).toEqual({
      tokens: ['Vlk', 'se', 'najedl', 'dosita'],
      marks: ['', '', '', '.'],
      index: 3,
      around: ['dos', 'ta'],
    });
  });

  it("keep a slip's own space inside its token, and the marks in the tokens when the slip is a mark or a token starts with one", () => {
    expect(mistakeTokens(made('Delfín {odplaval|od plaval} od lodi.'), 0, 'od plaval')).toEqual({
      tokens: ['Delfín', 'od plaval', 'od', 'lodi'],
      marks: ['', '', '', '.'],
      index: 1,
      around: ['', ''],
    });
    // A slip in the end mark itself: the wrong token is the word with its mark.
    expect(mistakeTokens(made('Kdo to tam plave{?|.}'), 0, '.')).toEqual({
      tokens: ['Kdo', 'to', 'tam', 'plave.'],
      marks: null,
      index: 3,
      around: ['plave', ''],
    });
    // An opening quote has no token before it to follow.
    expect(mistakeTokens(made('Řekl: „P{y|i}šný krab.“'), 0, 'i')).toEqual({
      tokens: ['Řekl:', '„Pišný', 'krab.“'],
      marks: null,
      index: 1,
      around: ['„P', 'šný'],
    });
    // A mark longer than the contract's 4 characters.
    expect(mistakeTokens(made('R{y|i}ba plave.....'), 0, 'i')).toEqual({
      tokens: ['Riba', 'plave.....'],
      marks: null,
      index: 0,
      around: ['R', 'ba'],
    });
  });
});

/** Sorted in Czech order, for comparing sets of letters. */
const czech = (texts: readonly string[]) => [...texts].sort(compareCzech);

describe('distractors (design §6.6)', () => {
  // rule, answer, authored alternatives, the signature slip, every slip offered (a set)
  const SLIPS: [SpellingRule, string, string[], string, string[]][] = [
    ['tvrda', 'y', ['i'], 'i', ['i', 'í', 'ý']],
    ['vyjm', 'ý', ['í'], 'í', ['í', 'y', 'i']],
    ['mekka', 'i', ['y'], 'y', ['y', 'í', 'ý']],
    ['dtn-mekke', 'í', ['ý'], 'ý', ['ý', 'i', 'y']],
    ['vzor', 'i', ['y'], 'y', ['y', 'í', 'ý']],
    ['delka', 'a', ['á'], 'á', ['á']],
    ['delka', 'á', ['a'], 'a', ['a']],
    ['u-uprostred', 'ů', ['ú'], 'ú', ['ú', 'u']],
    ['u-zacatek', 'ú', ['ů'], 'ů', ['ů', 'u']],
    ['u-zacatek', 'Ú', ['Ů'], 'Ů', ['Ů', 'U']],
    ['mne', 'mně', ['mě'], 'mě', ['mě']],
    ['mne-zajmeno', 'mě', ['mně'], 'mně', ['mně']],
    ['parova', 'd', ['t'], 't', ['t']],
    ['parova', 'z', ['s'], 's', ['s']],
    ['velke-pismeno', 'V', ['v'], 'v', ['v']],
    ['velke-pismeno', 'm', ['M'], 'M', ['M']],
    ['shoda', 'y', ['i'], 'i', ['i']],
    ['interpunkce', '?', ['.'], '.', ['.']],
    ['spojka', 'ale', ['a'], 'a', ['a']],
    ['spisovne', 'mléko', ['mlíko'], 'mlíko', ['mlíko']],
    ['predpona-predlozka', 'odplavala', ['od plavala'], 'od plavala', ['od plavala']],
  ];

  it('rank the signature slip first and never offer the answer', () => {
    for (const [rule, correct, alternatives, signature, slips] of SLIPS) {
      const ranked = rankedMistakes(rule, correct, alternatives);
      const label = `${rule} ${correct}`;
      expect(ranked[0], label).toBe(signature);
      expect(czech(ranked), label).toEqual(czech(slips));
      expect(new Set(ranked).size, label).toBe(ranked.length);
    }
    // The ě rules: e for ě, the heard je (oběd) or ně (město), ě for je; always the authored first.
    expect(rankedMistakes('de-te-ne', 'ě', ['e'])[0]).toBe('e');
    expect(rankedMistakes('be-pe-ve-me', 'ě', ['je'])[0]).toBe('je');
    expect(rankedMistakes('be-pe-ve-me', 'ě', ['ně'])[0]).toBe('ně');
    expect(rankedMistakes('bje-vje', 'je', ['ě'])[0]).toBe('ě');
    for (const [correct, alternatives] of [
      ['ě', ['e']],
      ['ě', ['je']],
      ['ě', ['ně']],
      ['je', ['ě']],
    ] as const) {
      for (const rule of E_RULES) {
        const ranked = rankedMistakes(rule, correct, alternatives);
        expect(ranked, `${rule} ${correct}`).not.toContain(correct);
      }
    }
  });

  it('give 2 to `count` options: the answer once, the signature always, in seeded order', () => {
    for (const [rule, correct, alternatives, signature] of SLIPS) {
      for (const count of [2, 3, 4]) {
        const firsts = new Set<number>();
        for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
          const options = gapOptions(rule, correct, alternatives, count, createPrng(seed));
          const label = `${rule} ${correct} ${count} ${seed}`;
          expect(options.length, label).toBeGreaterThanOrEqual(2);
          expect(options.length, label).toBeLessThanOrEqual(count);
          expect(new Set(options).size, label).toBe(options.length);
          expect(
            options.filter((o) => o === correct),
            label,
          ).toEqual([correct]);
          expect(options, label).toContain(signature);
          expect(gapOptions(rule, correct, alternatives, count, createPrng(seed)), label).toEqual(
            options,
          );
          firsts.add(options.indexOf(correct));
        }
        expect(firsts.size, `${rule} ${correct} ${count}: the answer moves`).toBeGreaterThan(1);
      }
    }
  });

  it("give the letter pad of the gap's rule (design §5.2), the answer and every alternative", () => {
    const PADS: [SpellingRule, string, string[], string[]][] = [
      ['tvrda', 'y', ['i'], ['i', 'í', 'y', 'ý']],
      ['vyjm', 'ý', ['í', 'y', 'i'], ['i', 'í', 'y', 'ý']],
      ['shoda', 'y', ['i'], ['i', 'y', 'a']],
      ['de-te-ne', 'ě', ['e'], ['e', 'é', 'ě', 'je']],
      ['be-pe-ve-me', 'ě', ['je'], ['e', 'é', 'ě', 'je']],
      ['be-pe-ve-me', 'ě', ['ně'], ['e', 'é', 'ě', 'je', 'ně']],
      ['bje-vje', 'je', ['ě'], ['e', 'é', 'ě', 'je']],
      ['mne-zajmeno', 'mně', ['mě'], ['mě', 'mně']],
      ['u-uprostred', 'ů', ['ú'], ['u', 'ú', 'ů']],
      ['u-zacatek', 'Ú', ['Ů'], ['U', 'Ú', 'Ů']],
      ['delka', 'á', ['a'], ['a', 'á']],
      ['delka', 'ó', ['o'], ['o', 'ó']],
      ['parova', 'd', ['t'], ['d', 't']],
      ['parova', 'ch', ['h'], ['h', 'ch']],
      ['parova', 's', ['z'], ['s', 'z']],
      ['velke-pismeno', 'V', ['v'], ['v', 'V']],
      ['interpunkce', '?', ['.'], ['.', '?']],
      ['interpunkce', '!', ['?'], ['?', '!']],
      ['spojka', 'ale', ['a', 'protože'], ['ale', 'a', 'protože']],
      ['predpona-predlozka', 'odplavala', ['od plavala'], ['odplavala', 'od plavala']],
      ['spisovne', 'mléko', ['mlíko'], ['mléko', 'mlíko']],
    ];
    for (const [rule, correct, alternatives, pad] of PADS) {
      const keys = padKeys(rule, correct, alternatives);
      expect(czech(keys), `${rule} ${correct}`).toEqual(czech(pad));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("lists a gap's own options in one order whichever is right, end marks . ? ! first", () => {
    // After a command a full stop is right too (Zavři dveře.), so the end mark pad is the gap's own.
    expect(padKeys('interpunkce', '?', ['.'])).toEqual(['.', '?']);
    expect(padKeys('interpunkce', '.', ['?'])).toEqual(['.', '?']);
    expect(padKeys('interpunkce', '!', ['?'])).toEqual(['?', '!']);
    expect(padKeys('interpunkce', ',', ['.'])).toEqual(['.', ',']);
    // A whole word never stands first because it is the answer.
    expect(padKeys('spojka', 'protože', ['ale'])).toEqual(['ale', 'protože']);
    expect(padKeys('spojka', 'ale', ['protože'])).toEqual(['ale', 'protože']);
    expect(padKeys('spojka', 'když', ['že'])).toEqual(['když', 'že']);
    expect(padKeys('spojka', 'že', ['když'])).toEqual(['když', 'že']);
    expect(padKeys('spisovne', 'mlíko', ['mléko'])).toEqual(
      padKeys('spisovne', 'mléko', ['mlíko']),
    );
    expect(padKeys('predpona-predlozka', 'od plavala', ['odplavala'])).toEqual(
      padKeys('predpona-predlozka', 'odplavala', ['od plavala']),
    );
    // A rule's own pad keeps its order (i í y ý), its answer anywhere on it.
    expect(padKeys('tvrda', 'y', ['i'])).toEqual(['i', 'í', 'y', 'ý']);
  });
});

describe('the slip one hears in bě, pě, vě, mě (design §6.6)', () => {
  /** The first gap of a sentence shown with its gap `0` alone. */
  const gap = (data: ContentData, id: string, choices: number) =>
    sentenceProblem(data, lexiconIndex(data).sentences.get(id)!, [0], sources(data, id, choices))
      .gaps[0]!;

  it('ranks ně after m and je after b, p, v, f, then e; without the letter before, all three', () => {
    expect(rankedMistakes('be-pe-ve-me', 'ě', [], 'm')).toEqual(['ně', 'e']);
    for (const before of ['b', 'p', 'v', 'f']) {
      expect(rankedMistakes('be-pe-ve-me', 'ě', [], before), before).toEqual(['je', 'e']);
    }
    expect(rankedMistakes('be-pe-ve-me', 'ě', [], 'M'), 'a capital before').toEqual(['ně', 'e']);
    expect(rankedMistakes('be-pe-ve-me', 'ě', ['ně'], 'm')).toEqual(['ně', 'e']);
    expect(rankedMistakes('be-pe-ve-me', 'ě', ['je'], 'b')).toEqual(['je', 'e']);
    expect(rankedMistakes('be-pe-ve-me', 'ě', [])).toEqual(['je', 'ně', 'e']);
    for (const seed of SEEDS) {
      const options = (alternative: string, before: string) =>
        czech(gapOptions('be-pe-ve-me', 'ě', [alternative], 4, createPrng(seed), before));
      expect(options('je', 'b'), seed).toEqual(czech(['ě', 'je', 'e']));
      expect(options('ně', 'm'), seed).toEqual(czech(['ě', 'ně', 'e']));
    }
  });

  it("offers a sentence gap its own slip: the fixture's ob_d (s.obed-1) and m_sto (s.mesto-1)", () => {
    for (const choices of CHOICES) {
      expect(czech(gap(lagoon, 's.obed-1', choices).options), `${choices}`).toEqual(
        czech(['ě', 'je']),
      );
      expect(czech(gap(lagoon, 's.mesto-1', choices).options), `${choices}`).toEqual(
        czech(['ě', 'ně']),
      );
    }
  });

  it('ranks a sentence gap by the letter before it in the sentence', () => {
    // The same sentences with every slip authored, in an order the ranking must undo.
    const every: ContentData = JSON.parse(JSON.stringify(lagoon));
    const text = (id: string, value: string) => {
      every.lexicon.sentences.find((sentence) => sentence.id === id)!.text = value;
    };
    text('s.obed-1', 'Rybky už mají ob{ě|ně|e|je}d.');
    text('s.mesto-1', 'Pod mořem leží potopené m{ě|je|e|ně}sto.');
    expect(czech(gap(every, 's.obed-1', 2).options)).toEqual(czech(['ě', 'je']));
    expect(czech(gap(every, 's.obed-1', 3).options)).toEqual(czech(['ě', 'je', 'e']));
    expect(czech(gap(every, 's.mesto-1', 2).options)).toEqual(czech(['ě', 'ně']));
    expect(czech(gap(every, 's.mesto-1', 3).options)).toEqual(czech(['ě', 'ně', 'e']));
  });

  it("re-asks the fixture's oběd, pěna and město alone with the heard slip, and hunts their own", () => {
    const skill = (id: string) => lagoon.skills.find((s) => s.id === id)!;
    const alone = (item: string) =>
      gapsOf(problemFor(skill('sk.lagoon.dtn.s'), item, sources(lagoon, item, 4), { alone: true }));
    expect(alone('spell:obexd:2').map((g) => czech(g.options))).toEqual([czech(['ě', 'je', 'e'])]);
    expect(alone('spell:pexna:1').map((g) => czech(g.options))).toEqual([czech(['ě', 'je', 'e'])]);
    expect(alone('spell:mexsto:1').map((g) => czech(g.options))).toEqual([czech(['ě', 'ně', 'e'])]);
    for (const [item, slip, fix] of [
      ['spell:obexd:2', 'objed', ['ě', 'je']],
      ['spell:mexsto:1', 'mněst', ['ě', 'ně']],
    ] as const) {
      for (const seed of SEEDS) {
        const hunt = problemFor(skill('sk.lagoon.dtn.m'), item, sources(lagoon, seed, 4));
        if (hunt.kind !== 'mistake') throw new Error(`${item} is not hunted`);
        expect(hunt.tokens[hunt.wrong], `${item} ${seed}`).toContain(slip);
        expect(czech(hunt.fix.options), `${item} ${seed}`).toEqual(czech(fix));
      }
    }
  });
});

describe('hints (design §5.3)', () => {
  const word = (data: ContentData, id: string) => rawOf(data).words.get(id)!;
  const pointOf = (data: ContentData, id: string) => word(data, id).spelling![0]!;
  const made = (id: string, lemma: string, patch: Partial<Word> = {}): Word => ({
    id,
    lemma,
    pos: 'noun',
    grade: 3,
    topics: [],
    tags: [],
    src: ['ujc'],
    ...patch,
  });
  const hint = (data: ContentData, id: string, rule = pointOf(data, id).rule) =>
    gapHint(data, rule, word(data, id), pointOf(data, id), null);

  it('show the family word for vyjm, the rhyme for a head word', () => {
    expect(hint(mini, 'mlynaarx')).toEqual({ kind: 'family', word: 'mlynaarx', related: 'mlyyn' });
    expect(hint(mini, 'mlyyn')).toEqual({ kind: 'listed', letter: 'l' });
    const lonely = made('byt', 'byt', {
      spelling: [{ at: 1, correct: 'y', alt: ['i'], rule: 'vyjm' }],
    });
    expect(gapHint(mini, 'vyjm', lonely, lonely.spelling![0]!, null)).toEqual({
      kind: 'rule',
      rule: 'vyjm',
    });
  });

  it('say after a listed letter that an obojetna-i word is not listed, shown with its gap, never the rhyme of y-words', () => {
    // S3's Czech QA: the rhyme lists only y-words, so for an i it points the wrong way, and a
    // look-alike in it (být for bít) confirms the slip. The shell shows b_t, never bít.
    expect(hint(mini, 'biit')).toEqual({ kind: 'not-listed', word: 'biit', span: [1, 2] });
    // After f, which lists no words: the rule line.
    const fialka = made('fialka', 'fialka');
    const point: SpellingPoint = { at: 1, correct: 'i', alt: ['y'], rule: 'obojetna-i' };
    expect(gapHint(mini, 'obojetna-i', fialka, point, null)).toEqual({
      kind: 'rule',
      rule: 'obojetna-i',
    });
    expect(gapHint(mini, 'obojetna-i', null, null, null)).toEqual({
      kind: 'rule',
      rule: 'obojetna-i',
    });
  });

  it('show a test word for parova and u-uprostred', () => {
    expect(hint(lagoon, 'hrad')).toEqual({ kind: 'test-word', word: 'hrad', test: 'hrady' });
    expect(hint(lagoon, 'zub')).toEqual({ kind: 'test-word', word: 'zub', test: 'zuby' });
    expect(hint(lagoon, 'duom')).toEqual({ kind: 'test-word', word: 'duom', test: 'domy' });
    const untested: SpellingPoint = { at: 3, correct: 'd', alt: ['t'], rule: 'parova' };
    expect(gapHint(lagoon, 'parova', word(lagoon, 'hrad'), untested, null)).toEqual({
      kind: 'rule',
      rule: 'parova',
    });
  });

  it('show the case question for mne-zajmeno, ti-ty-ta for a plural subject of shoda, the pattern for vzor', () => {
    const dej = {
      sentence: {
        id: 's.dej',
        grade: 4,
        topics: [],
        text: 'Dej to {mně|mě}.',
        gaps: [{ rule: 'mne-zajmeno', word: null, case: 3 }],
      },
      parsed: parseGappedText('Dej to {mně|mě}.'),
      words: ['Dej', 'to', 'mně'],
    } as unknown as ParsedSentence;
    const gap = dej.sentence.gaps[0]!;
    expect(gapHint(mini, 'mne-zajmeno', null, null, { parsed: dej, gap })).toEqual({
      kind: 'case-question',
      case: 3,
    });
    expect(gapHint(mini, 'mne-zajmeno', null, null, null)).toEqual({
      kind: 'rule',
      rule: 'mne-zajmeno',
    });
    const ryby = lexiconIndex(mini).sentences.get('s.ryby-1')!;
    expect(
      gapHint(mini, 'shoda', null, null, { parsed: ryby, gap: ryby.sentence.gaps[0]! }),
    ).toEqual({ kind: 'ten-ta-to', gender: 'f', plural: true });
    // A singular subject keeps ten, ta, to.
    const singular = {
      ...ryby,
      sentence: {
        ...ryby.sentence,
        tokens: ryby.sentence.tokens!.map((token, at) =>
          at === 0 ? { ...token, number: 'sg' as const } : token,
        ),
      },
    } as ParsedSentence;
    expect(
      gapHint(mini, 'shoda', null, null, { parsed: singular, gap: ryby.sentence.gaps[0]! }),
    ).toEqual({ kind: 'ten-ta-to', gender: 'f' });
    const stroj = made('stroj', 'stroj', {
      noun: { gender: 'm', animate: false, numbers: 'both', pattern: 'stroj' },
    });
    const ending: SpellingPoint = { at: 5, correct: 'i', alt: ['y'], rule: 'vzor' };
    expect(gapHint(mini, 'vzor', stroj, ending, null)).toEqual({
      kind: 'pattern',
      pattern: 'stroj',
    });
  });

  it('show the rule in one line otherwise', () => {
    const strategies: readonly SpellingRule[] = [
      'vyjm',
      'obojetna-i',
      'parova',
      'u-uprostred',
      'mne-zajmeno',
      'shoda',
      'vzor',
    ];
    let checked = 0;
    for (const data of [lagoon, mini]) {
      for (const entry of data.lexicon.words) {
        for (const point of entry.spelling ?? []) {
          if (strategies.includes(point.rule)) continue;
          expect(gapHint(data, point.rule, entry, point, null), entry.id).toEqual({
            kind: 'rule',
            rule: point.rule,
          });
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});
