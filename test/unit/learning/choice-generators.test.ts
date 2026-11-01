/**
 * The choice generators, exhaustively (src/rules/learning/generators/classify.ts, odd.ts,
 * relation.ts and companions.ts). For the game's pack (content/pearl-sea.content.json) and both
 * fixture packs, every servable item of every `classify`, `odd-one-out` and `relation` skill is
 * asked, and so is every item of test skills of every dimension in every context, every
 * odd-one-out basis (sets of 3, 4 and 6) and every relation: classifications once (they draw
 * nothing), sets and relations with several seeds, relations with the grade choices 2-4. Every
 * problem must pass the contract's schema and have one expected answer, the independent oracle's
 * (test/traces/support.ts: read off the lexicon's entries, paradigms, annotated tokens and
 * relations); targets, options, sets, words and hints must follow docs/design.md §5.3, §5.7 and
 * §6.6 as restated here from the raw lexicon, never from the generator.
 */
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import {
  CONSONANT_ITEMS,
  CONTEXT_DIMENSIONS,
  DIMENSION_VALUES,
  WORD_RELATIONS,
  WORD_VALUE_DIMENSIONS,
  expectedAnswer,
  formCells,
  isCorrectAnswer,
  lexiconId,
  matchesSentenceFilter,
  matchesWordFilter,
  parseItemId,
  problemSchema,
  problemSteps,
  skillItems,
} from '../../../src/rules/contract';
import type {
  AnswerValue,
  ClassifyProblem,
  ContentData,
  ContextKind,
  Dimension,
  Hint,
  OddBasis,
  OddProblem,
  Problem,
  RelationProblem,
  Skill,
  Word,
  WordFilter,
  WordRef,
} from '../../../src/rules/contract';
import {
  canGenerate,
  canServe,
  problemFor,
  servableIndex,
  unservableItems,
} from '../../../src/rules/learning/generate';
import type { GeneratorSources } from '../../../src/rules/learning/generate';
import { lagoonPack, miniPack, realPack } from '../../fixtures/rules/packs';
import { filledSentence, oracle } from '../../traces/support';

const PACKS = [
  ['real', realPack().data],
  ['lagoon', lagoonPack().data],
  ['mini', miniPack().data],
] as const;
const real = PACKS[0][1];

type ChoiceSkill = Extract<Skill, { generator: 'classify' | 'odd-one-out' | 'relation' }>;
const isChoice = (skill: Skill): skill is ChoiceSkill =>
  skill.generator === 'classify' ||
  skill.generator === 'odd-one-out' ||
  skill.generator === 'relation';

// ---------------------------------------------------------------- the raw lexicon

type Family = ContentData['lexicon']['families'][number];
type Sentence = ContentData['lexicon']['sentences'][number];

/** The lexicon's entries by ID, as written in the pack (no engine index). */
interface Raw {
  words: Map<string, Word>;
  families: Map<string, Family>;
  sentences: Map<string, Sentence>;
  /** Lemmas (lower-case) two lexicon words share: a set showing one would be ambiguous. */
  homographs: Set<string>;
  /** Each family's member words. */
  members: Map<string, Word[]>;
}

const raws = new WeakMap<ContentData, Raw>();
function rawOf(data: ContentData): Raw {
  let raw = raws.get(data);
  if (raw !== undefined) return raw;
  const seen = new Set<string>();
  const homographs = new Set<string>();
  const members = new Map<string, Word[]>();
  for (const word of data.lexicon.words) {
    const key = word.lemma.toLowerCase();
    if (seen.has(key)) homographs.add(key);
    seen.add(key);
    if (word.family) members.set(word.family.id, [...(members.get(word.family.id) ?? []), word]);
  }
  raw = {
    words: new Map(data.lexicon.words.map((w) => [w.id, w])),
    families: new Map(data.lexicon.families.map((f) => [f.id, f])),
    sentences: new Map(data.lexicon.sentences.map((s) => [s.id, s])),
    homographs,
    members,
  };
  raws.set(data, raw);
  return raw;
}

const homograph = (data: ContentData, word: Word) =>
  rawOf(data).homographs.has(word.lemma.toLowerCase());

/** A verb as a reflexive classification shows it: the infinitive without se or si (bát se → bát). */
function bareOf(word: Word): string {
  const inf = word.verb?.paradigm?.inf;
  const first = Array.isArray(inf) ? inf[0] : inf;
  return first ?? word.lemma.replace(/ s[ei]$/u, '');
}

/** Whether a verb shown bare is also a lexicon verb with another reflexive value (hrát, hrát si). */
function bareClash(data: ContentData, word: Word): boolean {
  const key = bareOf(word).toLowerCase();
  const values = new Set(
    data.lexicon.words
      .filter((other) => other.verb !== undefined && bareOf(other).toLowerCase() === key)
      .map((other) => other.verb!.reflexive ?? 'none'),
  );
  return values.size > 1;
}

/** How a word stands alone when `dimension` is asked of it: its lemma, a reflexive verb bare. */
const shownAlone = (word: Word, dimension: string) =>
  dimension === 'reflexive' && word.verb !== undefined ? bareOf(word) : word.lemma;

/** Whether two families share a root (`kin`, listed on either side). */
function kin(data: ContentData, a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  const families = rawOf(data).families;
  return a === b || !!families.get(a)?.kin.includes(b) || !!families.get(b)?.kin.includes(a);
}

/** A filter's audience: standard words unless it names registers, and its grades (contract §8). */
function suitsAudience(word: Word, filter: WordFilter): boolean {
  return (
    (filter.registers ?? ['standard']).includes(word.register ?? 'standard') &&
    (filter.grades === undefined || filter.grades.includes(word.grade))
  );
}

const selects = (data: ContentData, word: Word, filter: WordFilter) =>
  matchesWordFilter(word, filter, rawOf(data).families);

const forms = new WeakMap<Word, ReturnType<typeof formCells>>();
/** A word's forms (the contract's `formCells`, read off its paradigm), once per word. */
function formsOf(word: Word): ReturnType<typeof formCells> {
  let cells = forms.get(word);
  if (cells === undefined) {
    cells = formCells(word);
    forms.set(word, cells);
  }
  return cells;
}

// ---------------------------------------------------------------- the test skills

const TEST = { titleKey: 'skill.test', strand: 'letters-sounds' } as const;
const BOTH_REGISTERS: WordFilter = { registers: ['standard', 'colloquial'] };

/** Test skills of every dimension in every context, every basis and every relation. */
function wide(): ChoiceSkill[] {
  const skills: ChoiceSkill[] = [];
  const classify = (
    id: string,
    dimension: Dimension,
    context: ContextKind,
    more: Partial<Extract<ChoiceSkill, { generator: 'classify' }>['params']> = {},
  ) =>
    skills.push({
      ...TEST,
      id: `sk.test.classify.${id}`,
      generator: 'classify',
      params: {
        dimension,
        context,
        words: dimension === 'register' ? BOTH_REGISTERS : {},
        sentences: {},
        values: null,
        cells: null,
        ...more,
      },
    });
  for (const [context, dimensions] of Object.entries(CONTEXT_DIMENSIONS)) {
    for (const dimension of dimensions) {
      classify(`${context}.${dimension}`, dimension, context as ContextKind);
    }
  }
  // Some values (cases 1-4 first, design §5.7), some forms (the present tense), some letters.
  classify('form.case.1-4', 'case', 'form', { values: ['1', '2', '3', '4'] });
  classify('form.person.pres', 'person', 'form', { cells: ['pres'] });
  classify('word.consonant.hard-soft', 'consonant', 'word', { values: ['hard', 'soft'] });
  const bases: OddBasis[] = [...WORD_VALUE_DIMENSIONS, 'family', 'listed'];
  for (const basis of bases) {
    for (const size of basis === 'family' || basis === 'pos' ? [3, 4, 6] : [4]) {
      skills.push({
        ...TEST,
        id: `sk.test.odd.${basis}.${size}`,
        generator: 'odd-one-out',
        params: { basis, words: basis === 'register' ? BOTH_REGISTERS : {}, size },
      });
    }
  }
  for (const relation of WORD_RELATIONS) {
    skills.push({
      ...TEST,
      id: `sk.test.relation.${relation}`,
      generator: 'relation',
      params: { relations: [relation], words: {} },
    });
  }
  // A 3rd-grade filter: what such a skill shows stays in the 3rd grade.
  skills.push(
    {
      ...TEST,
      id: 'sk.test.odd.family.grade-3',
      generator: 'odd-one-out',
      params: { basis: 'family', words: { grades: [3] }, size: 4 },
    },
    {
      ...TEST,
      id: 'sk.test.relation.all.grade-3',
      generator: 'relation',
      params: { relations: [...WORD_RELATIONS], words: { grades: [3] } },
    },
  );
  return skills;
}

// ---------------------------------------------------------------- the survey

const SEEDS = ['tide', 'reef', 'kelp'];

interface Case {
  pack: string;
  data: ContentData;
  skill: ChoiceSkill;
  item: string;
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

/** The items a skill serves: the pack's index for its own skills, `canServe` for test skills. */
function servedItems(data: ContentData, skill: ChoiceSkill): readonly string[] {
  return (
    servableIndex(data).get(skill.id) ??
    skillItems(skill, data.lexicon).filter((item) => canServe(data, skill, item))
  );
}

/** Every served item of the skills, with the seeds and choices that can change its problem. */
function survey(
  pack: string,
  data: ContentData,
  skills: readonly ChoiceSkill[],
  seeds: readonly string[],
): Case[] {
  const cases: Case[] = [];
  for (const skill of skills) {
    const items = servedItems(data, skill);
    const runs = skill.generator === 'classify' ? seeds.slice(0, 1) : seeds;
    const choicesList = skill.generator === 'relation' ? [2, 3, 4] : [4];
    for (const seed of runs) {
      for (const choices of choicesList) {
        // One set of streams per round-like run: the items share it, as a round's problems do.
        const streams = sources(data, `${seed}:${skill.id}:${choices}`, choices);
        for (const item of items) {
          const problem = problemFor(skill, item, streams);
          cases.push({ pack, data, skill, item, seed, choices, problem });
        }
      }
    }
  }
  return cases;
}

const packSkills = (data: ContentData) => data.skills.filter(isChoice);

let allCases: Case[] | undefined;
function cases(): Case[] {
  allCases ??= PACKS.flatMap(([name, data]) => [
    ...survey(name, data, packSkills(data), SEEDS),
    ...survey(name, data, wide(), name === 'real' ? SEEDS.slice(0, 2) : SEEDS),
  ]);
  return allCases;
}

// ---------------------------------------------------------------- the checks

type Check = 'schema' | 'answer' | 'options' | 'target' | 'set' | 'words' | 'hint' | 'tempting';
type Say = (check: Check, message: string) => void;

/** One step, one expected answer, the oracle's; every other option or word is refused. */
function checkAnswer(c: Case, say: Say): void {
  const { data, problem } = c;
  if (problemSteps(problem) !== 1) say('answer', `${problemSteps(problem)} steps, not 1`);
  let right: AnswerValue;
  try {
    right = oracle(data, problem, 0);
  } catch (error) {
    say('answer', `the oracle finds no answer (${(error as Error).message})`);
    return;
  }
  const expected = expectedAnswer(problem, 0);
  if (!isDeepStrictEqual(expected, right)) {
    say('answer', `${JSON.stringify(expected)}, the oracle ${JSON.stringify(right)}`);
  }
  if (!isCorrectAnswer(problem, 0, right)) say('answer', 'the answer is refused');
  const others: AnswerValue[] =
    problem.kind === 'classify'
      ? problem.options.map((value) => ({ kind: 'option', value }))
      : (problem.kind === 'odd'
          ? problem.words
          : problem.kind === 'relation'
            ? problem.options
            : []
        ).map((_, index): AnswerValue => ({ kind: 'pick', index }));
  for (const other of others) {
    if (!isDeepStrictEqual(other, right) && isCorrectAnswer(problem, 0, other)) {
      say('answer', `${JSON.stringify(other)} is taken too`);
    }
  }
}

/** A word reference: a real lexicon word shown as its lemma (or `forms`), never a homograph. */
function checkRef(
  data: ContentData,
  ref: WordRef,
  say: Say,
  forms: readonly string[] = [],
): Word | undefined {
  const word = ref.word === null ? undefined : rawOf(data).words.get(ref.word);
  if (word === undefined) {
    say('words', `"${ref.text}" names no lexicon word (${ref.word})`);
    return undefined;
  }
  if (ref.text !== word.lemma && !forms.includes(ref.text)) {
    say('words', `"${ref.text}" is not how ${word.lemma} is shown`);
  }
  if (homograph(data, word)) say('words', `${word.lemma} is written like another lexicon word`);
  return word;
}

/** What a classification shows for its item, from the raw lexicon (contract §5.1, design §5.7). */
function classTargetOf(
  c: Case,
  params: Extract<ChoiceSkill, { generator: 'classify' }>['params'],
  say: Say,
): { target: WordRef; context: ClassifyProblem['context']; span: [number, number] | null } | null {
  const parsed = parseItemId(c.item);
  if (parsed?.kind !== 'class' || parsed.dimension !== params.dimension) {
    say('target', `${c.item} is no ${params.dimension} item`);
    return null;
  }
  const raw = rawOf(c.data);
  const { dimension, context } = params;
  if (dimension === 'consonant') {
    const entry = CONSONANT_ITEMS.find((e) => e.id === parsed.target);
    if (entry === undefined) return null;
    return { target: { word: null, text: entry.letter }, context: null, span: null };
  }
  if (context === 'sentence') {
    const sentence = raw.sentences.get(parsed.target);
    if (sentence === undefined) return null;
    if (dimension === 'sentence-kind' || dimension === 'clauses') {
      const plain = filledSentence(c.data, sentence.id).plain.trim();
      const text = dimension === 'sentence-kind' ? plain.replace(/[\s.?!…]+$/u, '') : plain;
      return { target: { word: null, text }, context: null, span: null };
    }
    const tokens = sentence.tokens ?? [];
    const at = Number(parsed.detail);
    const token = tokens[at];
    if (token === undefined) return null;
    return {
      target: { word: token.word ?? null, text: token.t },
      context: { tokens: tokens.map((t) => t.t), at },
      span: null,
    };
  }
  const word = raw.words.get(parsed.target);
  if (word === undefined) return null;
  if (context === 'form') {
    const texts = formsOf(word)
      .filter((form) => form.cell === parsed.detail)
      .map((form) => form.text);
    const shown = c.problem.kind === 'classify' ? c.problem.target.text : '';
    if (!texts.includes(shown))
      say('target', `"${shown}" is no ${parsed.detail} form of ${word.lemma}`);
    return { target: { word: word.id, text: shown }, context: null, span: null };
  }
  if (dimension === 'segment') {
    const segments = word.segments ?? [];
    const index = Number(parsed.detail);
    const start = segments.slice(0, index).reduce((sum, [, piece]) => sum + [...piece].length, 0);
    const piece = segments[index]?.[1] ?? '';
    return {
      target: { word: word.id, text: word.lemma },
      context: null,
      span: [start, start + [...piece].length],
    };
  }
  return {
    target: { word: word.id, text: shownAlone(word, dimension) },
    context: null,
    span: null,
  };
}

/** The strategy hint of a classification (design §5.3): ten/ta/to, the case question, the pattern. */
function classHintOf(c: Case, problem: ClassifyProblem): Hint | null {
  const raw = rawOf(c.data);
  const word = problem.target.word === null ? undefined : raw.words.get(problem.target.word);
  switch (problem.dimension) {
    case 'gender':
    case 'gender-class': {
      if (problem.context !== null) {
        const parsed = parseItemId(c.item);
        const sentence = parsed?.kind === 'class' ? raw.sentences.get(parsed.target) : undefined;
        const gender = sentence?.tokens?.[problem.context.at]?.gender;
        return gender === undefined ? null : { kind: 'ten-ta-to', gender };
      }
      if (word?.noun === undefined) return null;
      const { gender, animate } = word.noun;
      return { kind: 'ten-ta-to', gender: gender === 'm' ? (animate ? 'ma' : 'mi') : gender };
    }
    case 'case':
      return { kind: 'case-question', case: Number(problem.correct) } as Hint;
    case 'pattern':
      return problem.context === null && problem.span === null && word?.noun?.pattern
        ? { kind: 'pattern', pattern: word.noun.pattern }
        : null;
    default:
      return null;
  }
}

function checkClassify(c: Case, problem: ClassifyProblem, say: Say): void {
  if (c.skill.generator !== 'classify') return;
  const params = c.skill.params;
  if (problem.dimension !== params.dimension) say('target', `asks ${problem.dimension}`);
  // The skill's values, in the dimension's school order, never shuffled (design §5.7).
  const values = params.values;
  const wanted = DIMENSION_VALUES[params.dimension].filter(
    (value) => values === null || values.includes(value),
  );
  if (!isDeepStrictEqual(problem.options, wanted)) {
    say('options', `${problem.options} for the values ${wanted}`);
  }
  if (problem.options.length < 2 || problem.options.length > 14) {
    say('options', `${problem.options.length} options`);
  }
  const expected = classTargetOf(c, params, say);
  if (expected === null) {
    say('target', `${c.item} is not in the lexicon`);
    return;
  }
  const shown = { target: problem.target, context: problem.context, span: problem.span };
  if (!isDeepStrictEqual(shown, expected)) {
    say('target', `${JSON.stringify(shown)}, the lexicon ${JSON.stringify(expected)}`);
  }
  if (problem.dimension === 'sentence-kind' && /[.?!…]\s*$/u.test(problem.target.text)) {
    say('target', `"${problem.target.text}" shows its end mark`);
  }
  if (params.context === 'word' && problem.target.word !== null) {
    // A word on its own or a part of it: never one written like another word (design §6.6).
    const alone = rawOf(c.data).words.get(problem.target.word);
    const reflexive = problem.dimension === 'reflexive' && alone?.verb !== undefined;
    const word = checkRef(c.data, problem.target, say, reflexive ? [bareOf(alone)] : []);
    if (word && !selects(c.data, word, params.words)) {
      say('words', `${word.lemma} is not of the skill's words`);
    }
    if (reflexive && /\ss[ei]$/u.test(problem.target.text)) {
      say('target', `"${problem.target.text}" shows the reflexive pronoun it asks`);
    }
    if (reflexive && bareClash(c.data, alone)) {
      say('words', `"${problem.target.text}" is also a verb with another reflexive pronoun`);
    }
  }
  if (params.context === 'form') {
    const word = rawOf(c.data).words.get(problem.target.word ?? '');
    if (word === undefined) say('words', `"${problem.target.text}" names no lexicon word`);
    else if (!selects(c.data, word, params.words)) {
      say('words', `${word.lemma} is not of the skill's words`);
    }
  }
  if (problem.context !== null) {
    const parsed = parseItemId(c.item);
    const sentence = parsed?.kind === 'class' ? rawOf(c.data).sentences.get(parsed.target) : null;
    if (sentence && !matchesSentenceFilter(sentence, params.sentences)) {
      say('target', `${sentence.id} is not of the skill's sentences`);
    }
  }
  const hint = classHintOf(c, problem);
  if (!isDeepStrictEqual(problem.hint, hint)) {
    say('hint', `${JSON.stringify(problem.hint)}, the strategy ${JSON.stringify(hint)}`);
  }
}

/** Whether a word is alone in its family: no other member a set could show beside it. */
function aloneInFamily(data: ContentData, word: Word, filter: WordFilter): boolean {
  const family = word.family?.id;
  if (family === undefined) return false;
  return !(rawOf(data).members.get(family) ?? []).some(
    (other) =>
      other.id !== word.id &&
      other.lemma.toLowerCase() !== word.lemma.toLowerCase() &&
      !homograph(data, other) &&
      suitsAudience(other, filter),
  );
}

function checkOdd(c: Case, problem: OddProblem, say: Say): void {
  if (c.skill.generator !== 'odd-one-out') return;
  const { basis, words: filter, size } = c.skill.params;
  const data = c.data;
  if (problem.basis !== basis) say('set', `differs in ${problem.basis}`);
  if (problem.words.length < 3 || problem.words.length > size) {
    say('set', `${problem.words.length} words in a set of ${size}`);
  }
  const shown = problem.words.map((ref) => {
    const word = rawOf(data).words.get(ref.word ?? '');
    return checkRef(data, ref, say, word ? [shownAlone(word, basis)] : []);
  });
  const texts = problem.words.map((ref) => ref.text.toLowerCase());
  if (new Set(texts).size !== texts.length) say('words', `repeats in ${texts}`);
  const parsed = parseItemId(c.item);
  const id =
    parsed?.kind === 'fam' ? parsed.word : parsed?.kind === 'class' ? parsed.target : undefined;
  const item = id === undefined ? undefined : rawOf(data).words.get(id);
  const at = problem.words.findIndex((ref) => ref.word === id);
  if (item === undefined || at < 0) {
    say('set', `the item's word ${id} is not shown`);
    return;
  }
  const alone = at === problem.correct;
  if (alone && !(basis === 'family' && aloneInFamily(data, item, filter))) {
    say('set', `the item's word ${item.lemma} is the odd one`);
  }
  // Real words of the skill; a family set may add members of the item's family of its audience.
  shown.forEach((word, index) => {
    if (word === undefined) return;
    const member =
      basis === 'family' &&
      !alone &&
      index !== problem.correct &&
      word.family?.id === item.family?.id;
    if (!selects(data, word, filter) && !(member && suitsAudience(word, filter))) {
      say('words', `${word.lemma} is not of the skill's words`);
    }
  });
  // Kin families never distract each other (design §6.6).
  if (basis === 'family') {
    const odd = shown[problem.correct];
    const rest = shown.filter((_, index) => index !== problem.correct);
    if (odd && rest.some((word) => word && kin(data, odd.family?.id, word.family?.id))) {
      say('set', `${odd.lemma} is of a kin family`);
    }
  }
  const letter = item.family ? (rawOf(data).families.get(item.family.id)?.letter ?? null) : null;
  const hint: Hint | null =
    basis === 'listed' && letter !== null ? { kind: 'listed', letter } : null;
  if (!isDeepStrictEqual(problem.hint, hint)) {
    say('hint', `${JSON.stringify(problem.hint)}, the strategy ${JSON.stringify(hint)}`);
  }
}

/** The texts a word can be shown as in a relation: its lemma and its sound-alike forms. */
function soundForms(data: ContentData, word: string): string[] {
  return data.lexicon.relations.soundAlikes
    .flat()
    .flatMap((ref) => (typeof ref !== 'string' && ref.word === word ? [ref.form] : []));
}

/** The word IDs in a symmetric relation with `id`. */
function partnersOf(pairs: readonly (readonly [string, string])[], id: string): string[] {
  return pairs.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
}

function checkRelation(c: Case, problem: RelationProblem, say: Say): void {
  if (c.skill.generator !== 'relation') return;
  const { relations, words: filter } = c.skill.params;
  const data = c.data;
  const parsed = parseItemId(c.item);
  if (parsed?.kind !== 'rel') {
    say('target', `${c.item} is no relation item`);
    return;
  }
  if (problem.relation !== parsed.relation || !relations.includes(problem.relation)) {
    say('target', `asks ${problem.relation} for ${c.item}`);
  }
  const want = Math.min(c.choices, 4);
  if (problem.options.length < 2 || problem.options.length > want) {
    say('options', `${problem.options.length} options for ${c.choices} choices`);
  }
  const texts = problem.options.map((o) => o.text);
  if (new Set(texts).size !== texts.length) say('options', `repeats in ${texts}`);
  if (texts.includes(problem.target.text))
    say('options', `offers the shown "${problem.target.text}"`);
  const refs = [problem.target, ...problem.options];
  const words = refs.map((ref) => checkRef(data, ref, say, soundForms(data, ref.word ?? '')));
  // What a skill shows keeps to its audience: its registers and grades (contract §8).
  for (const word of words) {
    if (word && !suitsAudience(word, filter)) say('words', `${word.lemma} is not for the skill`);
  }
  // The answer is the item's word (or its form, `piit:pil`).
  const [answerId, formId] = parsed.word.split(':') as [string, string | undefined];
  const answer = problem.options[problem.correct];
  const answerWord = rawOf(data).words.get(answerId);
  const answerText =
    formId === undefined
      ? answerWord?.lemma
      : soundForms(data, answerId).find((form) => lexiconId(form) === formId);
  if (answer?.word !== answerId || answer.text !== answerText) {
    say('target', `the answer ${JSON.stringify(answer)} is not ${parsed.word}`);
  }
  if (answerWord && !selects(data, answerWord, filter)) {
    say('words', `the answer ${answerWord.lemma} is not of the skill's words`);
  }
  // Kin families never distract each other (design §6.6): no other option shares the root.
  if (problem.relation === 'related') {
    const shown = words[0];
    words.slice(1).forEach((word, index) => {
      if (
        index !== problem.correct &&
        shown &&
        word &&
        kin(data, shown.family?.id, word.family?.id)
      ) {
        say('set', `${word.lemma} shares the root of ${shown.lemma}`);
      }
    });
  }
  // The opposite relation tempts first (design §6.6): an antonym offered for a synonym.
  const shown = words[0];
  const opposite =
    problem.relation === 'synonym'
      ? data.lexicon.relations.antonyms
      : problem.relation === 'antonym'
        ? data.lexicon.relations.synonyms
        : null;
  if (opposite !== null && shown) {
    const tempting = partnersOf(opposite, shown.id)
      .map((id) => rawOf(data).words.get(id)!)
      .filter(
        (word) =>
          word.id !== answerId &&
          word.lemma !== problem.target.text &&
          word.lemma !== answerText &&
          !homograph(data, word) &&
          suitsAudience(word, filter),
      );
    const offered = problem.options.some((o) => tempting.some((word) => word.id === o.word));
    if (tempting.length > 0 && !offered) {
      say('tempting', `${shown.lemma}: none of ${tempting.map((w) => w.lemma)} is offered`);
    }
  }
  if (problem.hint !== null) say('hint', `a relation hints ${JSON.stringify(problem.hint)}`);
}

function violations(c: Case): { check: Check; message: string }[] {
  const out: { check: Check; message: string }[] = [];
  const say: Say = (check, message) =>
    out.push({
      check,
      message: `${c.pack} ${c.skill.id} ${c.item} ${c.seed}/${c.choices}: ${message}`,
    });
  const { problem } = c;
  const schema = problemSchema.parse(problem);
  if (!schema.ok) say('schema', JSON.stringify(schema.error.diagnostics));
  const kind = { classify: 'classify', 'odd-one-out': 'odd', relation: 'relation' }[
    c.skill.generator
  ];
  if (problem.kind !== kind) {
    say('target', `a ${problem.kind} problem of ${c.skill.generator}`);
    return out;
  }
  checkAnswer(c, say);
  if (problem.kind === 'classify') checkClassify(c, problem, say);
  if (problem.kind === 'odd') checkOdd(c, problem, say);
  if (problem.kind === 'relation') checkRelation(c, problem, say);
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

describe('the choice generators', () => {
  it('serve every item of every choice skill of the three packs', () => {
    for (const [name, data] of PACKS) {
      expect(unservableItems(data), name).toEqual([]);
      for (const skill of packSkills(data)) expect(canGenerate(skill), skill.id).toBe(true);
    }
    // The survey below really is exhaustive: all the packs' choice skills and items.
    const surveyed = new Set(
      cases()
        .filter((c) => !c.skill.id.startsWith('sk.test.'))
        .map((c) => `${c.pack} ${c.skill.id} ${c.item}`),
    );
    const items = PACKS.flatMap(([name, data]) =>
      packSkills(data).flatMap((skill) =>
        skillItems(skill, data.lexicon).map((item) => `${name} ${skill.id} ${item}`),
      ),
    );
    expect([...surveyed].sort()).toEqual([...items].sort());
    expect(items.length).toBeGreaterThan(20);
  });

  it("serve the game's whole lexicon: every item of every dimension, basis and relation", () => {
    // Test skills over content/pearl-sea.content.json: what a skill could ever ask is servable,
    // but for words written like another word (a homograph cannot stand in a set or an option)
    // and verbs that, shown without se or si, are another verb with another one (hrát, hrát si).
    // The 3rd-grade skills leave out on purpose what only 4th-grade words could show.
    const unserved: string[] = [];
    const clashes: string[] = [];
    for (const skill of wide().filter((s) => !('words' in s.params) || !s.params.words.grades)) {
      const served = new Set(servedItems(real, skill));
      for (const item of skillItems(skill, real.lexicon)) {
        if (served.has(item)) continue;
        const parsed = parseItemId(item);
        const id =
          parsed?.kind === 'class'
            ? parsed.target
            : parsed?.kind === 'fam' || parsed?.kind === 'rel'
              ? parsed.word.split(':')[0]!
              : '';
        const word = rawOf(real).words.get(id);
        if (word !== undefined && parsed?.kind === 'class' && parsed.dimension === 'reflexive') {
          if (bareClash(real, word)) {
            clashes.push(word.id);
            continue;
          }
        }
        if (word === undefined || !homograph(real, word)) unserved.push(`${skill.id} ${item}`);
      }
    }
    expect(unserved).toEqual([]);
    expect(clashes.sort()).toEqual(['hraat', 'hraat-si']);
  });

  it('cover every dimension in every context, every basis and every relation', () => {
    const asked = new Set(
      cases().map(({ skill, problem }) =>
        skill.generator === 'classify'
          ? `classify ${skill.params.context} ${problem.kind === 'classify' ? problem.dimension : '-'}`
          : problem.kind === 'odd'
            ? `odd ${problem.basis}`
            : problem.kind === 'relation'
              ? `relation ${problem.relation}`
              : problem.kind,
      ),
    );
    const wanted = [
      ...Object.entries(CONTEXT_DIMENSIONS).flatMap(([context, dimensions]) =>
        dimensions.map((dimension) => `classify ${context} ${dimension}`),
      ),
      ...[...WORD_VALUE_DIMENSIONS, 'family', 'listed'].map((basis) => `odd ${basis}`),
      ...WORD_RELATIONS.map((relation) => `relation ${relation}`),
    ];
    expect(wanted.filter((key) => !asked.has(key))).toEqual([]);
  });

  it('passes the contract schema', () => {
    expect(found('schema')).toEqual([]);
  });

  it("has one expected answer, the oracle's; no other option or word is taken", () => {
    expect(found('answer')).toEqual([]);
  });

  it("offers a classification's values in school order, a relation 2-4 distinct options", () => {
    expect(found('options')).toEqual([]);
  });

  it('shows the item: the letter, word, part, form, token or sentence, without the end mark', () => {
    expect(found('target')).toEqual([]);
  });

  it("shows real words of the skill and its audience, never a homograph, the drawn item's word", () => {
    expect(found('words')).toEqual([]);
  });

  it('makes sets of 3-6 words with the item in the majority, kin families never distracting', () => {
    expect(found('set')).toEqual([]);
  });

  it('hints the strategy of design §5.3: ten/ta/to, the case question, the pattern, the letter', () => {
    expect(found('hint')).toEqual([]);
  });

  it('tempts with the opposite relation first: an antonym for a synonym, a synonym for an antonym', () => {
    expect(found('tempting')).toEqual([]);
  });

  it('gives the same problems for the same seeds, and varies sets and relations with others', () => {
    // Classifications draw nothing: the same item is always the same problem.
    const drawn = wide().filter((skill) => skill.generator !== 'classify');
    const run = (seed: string) => survey('real', real, drawn, [seed]).map((c) => c.problem);
    const first = cases()
      .filter(
        (c) => c.pack === 'real' && c.seed === 'tide' && drawn.some((s) => s.id === c.skill.id),
      )
      .map((c) => c.problem);
    expect(isDeepStrictEqual(run('tide'), first)).toBe(true);
    const other = run('other');
    expect(other.length).toBe(first.length);
    expect(
      other.filter((problem, i) => !isDeepStrictEqual(problem, first[i])).length,
    ).toBeGreaterThan(first.length / 2);
  });

  it('puts the odd word and the related word in every position: a seeded order', () => {
    const positions = new Map<string, number[]>();
    for (const { problem } of cases()) {
      if (problem.kind !== 'odd' && problem.kind !== 'relation') continue;
      const length = problem.kind === 'odd' ? problem.words.length : problem.options.length;
      const key = `${problem.kind} of ${length}`;
      const counts = positions.get(key) ?? Array.from({ length }, () => 0);
      counts[problem.correct] = (counts[problem.correct] ?? 0) + 1;
      positions.set(key, counts);
    }
    expect([...positions.keys()].sort()).toEqual(
      expect.arrayContaining([
        'odd of 3',
        'odd of 4',
        'odd of 6',
        'relation of 2',
        'relation of 4',
      ]),
    );
    for (const [key, counts] of positions) {
      const total = counts.reduce((sum, count) => sum + count, 0);
      if (total < 40) continue;
      for (const [position, count] of counts.entries()) {
        expect(count, `${key}, the answer at ${position}`).toBeGreaterThan(
          total / counts.length / 2,
        );
      }
    }
  });
});

describe('odd-one-out on the listed basis', () => {
  const mini = miniPack().data;
  const skill: ChoiceSkill = {
    ...TEST,
    id: 'sk.test.odd.listed.mini',
    generator: 'odd-one-out',
    params: {
      basis: 'listed',
      words: { words: ['mlyyn', 'mlynaarx', 'byyt', 'pes', 'ryba'] },
      size: 4,
    },
  };
  const odd = (data: ContentData, seed: string) =>
    problemFor(skill, 'fam:byyt', sources(data, seed, 4)) as OddProblem;

  it('sets a word of no family, which is never a listed word, beside listed ones', () => {
    // pes and ryba have no family: neither is listed, so either can be the odd one out.
    const shown = new Set<string>();
    for (const seed of SEEDS) {
      const problem = odd(mini, seed);
      expect(problem.words.map((w) => w.word)).toEqual(
        expect.arrayContaining(['byyt', 'mlyyn', 'mlynaarx']),
      );
      const out = problem.words[problem.correct]!.word!;
      expect(['pes', 'ryba']).toContain(out);
      expect(oracle(mini, problem, 0)).toEqual({ kind: 'pick', index: problem.correct });
      shown.add(out);
    }
    expect(shown.size).toBe(2);
  });

  it('leaves out a word of no family whose spelling says it is listed (its family is missing)', () => {
    const data = structuredClone(mini);
    const ryba = data.lexicon.words.find((w) => w.id === 'ryba')!;
    ryba.spelling = (ryba.spelling ?? []).map((point) => ({ ...point, rule: 'vyjm' as const }));
    expect(ryba.spelling.length).toBeGreaterThan(0);
    for (const seed of SEEDS) {
      const problem = odd(data, seed);
      expect(problem.words.map((w) => w.word)).not.toContain('ryba');
      expect(problem.words[problem.correct]!.word).toBe('pes');
    }
  });
});

describe("the survey's checks", () => {
  /** A case of the survey changed by `change`, and the checks it now fails. */
  function broken(kind: Problem['kind'], change: (problem: Problem, c: Case) => void): Check[] {
    const c = cases().find((x) => x.pack === 'real' && x.problem.kind === kind && filter(x));
    if (c === undefined) throw new Error(`no ${kind} case`);
    const problem = structuredClone(c.problem);
    change(problem, c);
    return [...new Set(violations({ ...c, problem }).map((v) => v.check))];
  }
  let filter: (c: Case) => boolean = () => true;

  it('catch every kind of broken problem, so that the survey cannot pass vacuously', () => {
    const colloquial = real.lexicon.words.find((w) => w.register === 'colloquial')!;
    filter = (c) => c.skill.id === 'sk.test.classify.word.pos';
    expect(broken('classify', (p) => void (p as ClassifyProblem).options.reverse())).toContain(
      'options',
    );
    expect(broken('classify', (p) => void ((p as ClassifyProblem).target.text += 'x'))).toContain(
      'target',
    );
    expect(
      broken('classify', (p) => {
        const q = p as ClassifyProblem;
        q.correct = q.options.find((o) => o !== q.correct)!;
      }),
    ).toContain('answer');
    filter = (c) => c.skill.id === 'sk.test.classify.form.case';
    expect(broken('classify', (p) => void ((p as ClassifyProblem).hint = null))).toContain('hint');
    filter = (c) => c.skill.id === 'sk.test.classify.sentence.sentence-kind';
    expect(broken('classify', (p) => void ((p as ClassifyProblem).target.text += '.'))).toContain(
      'target',
    );

    filter = (c) => c.skill.id === 'sk.test.odd.pos.4';
    expect(
      broken('odd', (p) => {
        const q = p as OddProblem;
        q.correct = (q.correct + 1) % q.words.length;
      }),
    ).toContain('answer');
    expect(
      broken('odd', (p) => {
        const q = p as OddProblem;
        const at = (q.correct + 1) % q.words.length;
        q.words[at] = { word: colloquial.id, text: colloquial.lemma };
      }),
    ).toContain('words');
    expect(
      broken('odd', (p) => {
        const q = p as OddProblem;
        q.words.push(q.words[q.correct]!);
      }),
    ).toContain('words');
    filter = (c) => c.skill.id === 'sk.test.odd.listed.4';
    expect(broken('odd', (p) => void ((p as OddProblem).hint = null))).toEqual(
      expect.arrayContaining(['hint']),
    );

    filter = (c) => c.skill.id === 'sk.test.relation.synonym' && c.choices === 4;
    expect(
      broken('relation', (p) => {
        const q = p as RelationProblem;
        q.options.splice(q.correct, 1);
        q.correct = 0;
      }),
    ).toContain('answer');
    expect(
      broken('relation', (p) => {
        const q = p as RelationProblem;
        q.options.push({ ...q.target });
      }),
    ).toContain('options');
    expect(
      broken('relation', (p) => {
        const q = p as RelationProblem;
        const at = (q.correct + 1) % q.options.length;
        q.options[at] = { word: colloquial.id, text: colloquial.lemma };
      }),
    ).toContain('words');
    filter = () => true;
  });
});
