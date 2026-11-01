/**
 * Problems, answers and item IDs: every problem kind round-trips through its schema, incoherent
 * problems are refused, each step has one expected answer, typed answers are compared exactly
 * (case included) after Unicode normalisation, and item IDs build and parse back.
 */
import { describe, expect, it } from 'vitest';
import {
  answerValueSchema,
  classItem,
  expectedAnswer,
  gapItem,
  isCorrectAnswer,
  itemIdSchema,
  pairItem,
  parseItemId,
  problemSchema,
  problemSteps,
  relationItem,
  spellItem,
} from '../../../src/rules/contract';
import type { Gap, Problem } from '../../../src/rules/contract';

const gap = (over: Partial<Gap> = {}): Gap => ({
  correct: 'ý',
  options: ['ý', 'í'],
  keys: ['i', 'í', 'y', 'ý'],
  rule: 'vyjm',
  word: 'mlyyn',
  item: spellItem('mlyyn', 2),
  hint: { kind: 'family', word: 'mlyyn', related: 'mlynaarx' },
  ...over,
});

const problems: Problem[] = [
  {
    kind: 'gaps',
    sentence: null,
    parts: [
      { kind: 'text', text: 'ml' },
      { kind: 'gap', gap: 0 },
      { kind: 'text', text: 'n' },
    ],
    gaps: [gap()],
  },
  {
    kind: 'gaps',
    sentence: 's.ryby-1',
    parts: [
      { kind: 'text', text: 'Ryby plaval' },
      { kind: 'gap', gap: 0 },
      { kind: 'text', text: ' u útesu.' },
    ],
    gaps: [
      gap({
        correct: 'y',
        options: ['y', 'i'],
        rule: 'shoda',
        word: null,
        item: gapItem('s.ryby-1', 0),
        hint: { kind: 'rule', rule: 'shoda' },
      }),
    ],
  },
  {
    kind: 'classify',
    dimension: 'case',
    target: { word: 'ryba', text: 'rybou' },
    context: { tokens: ['Plavu', 's', 'rybou'], at: 2 },
    span: null,
    options: ['1', '3', '7'],
    correct: '7',
    hint: { kind: 'case-question', case: 7 },
  },
  {
    kind: 'odd',
    basis: 'pos',
    words: [
      { word: 'ryba', text: 'ryba' },
      { word: 'pes', text: 'pes' },
      { word: 'velkyy', text: 'velký' },
    ],
    correct: 2,
    hint: null,
  },
  {
    kind: 'relation',
    relation: 'antonym',
    target: { word: 'velkyy', text: 'velký' },
    options: [
      { word: 'malyy', text: 'malý' },
      { word: 'dobryy', text: 'dobrý' },
    ],
    correct: 0,
    hint: null,
  },
  {
    kind: 'mistake',
    sentence: 's.mlyn-1',
    tokens: ['Mlín', 'stojí', 'u', 'moře.'],
    wrong: 0,
    fix: gap(),
    around: ['Ml', 'n'],
  },
];

describe('problems', () => {
  it('accept every kind through the schema, unchanged', () => {
    for (const problem of problems) {
      const parsed = problemSchema.parse(problem);
      expect(parsed.ok, problem.kind).toBe(true);
      if (parsed.ok) expect(parsed.value).toEqual(problem);
    }
  });

  it('refuse a problem whose answer is not offered or whose gaps are out of order', () => {
    expect(problemSchema.parse({ ...problems[0]!, gaps: [gap({ options: ['í', 'i'] })] }).ok).toBe(
      false,
    );
    expect(problemSchema.parse({ ...problems[2]!, correct: '5' }).ok).toBe(false);
    expect(problemSchema.parse({ ...problems[3]!, correct: 3 }).ok).toBe(false);
    const twice = {
      ...problems[0]!,
      parts: [
        { kind: 'gap', gap: 0 },
        { kind: 'gap', gap: 0 },
      ],
    };
    expect(problemSchema.parse(twice).ok).toBe(false);
  });

  it('take a whole sentence of up to 240 characters as a classification target, a token elsewhere', () => {
    const sentence = (length: number) => 'Krab'.padEnd(length, ' a ryba');
    const whole = (text: string): Problem => ({
      kind: 'classify',
      dimension: 'sentence-kind',
      target: { word: null, text },
      context: null,
      span: null,
      options: ['statement', 'question', 'command', 'wish'],
      correct: 'question',
      hint: null,
    });
    expect(problemSchema.parse(whole(sentence(240))).ok).toBe(true);
    expect(problemSchema.parse(whole(sentence(241))).ok).toBe(false);
    const long = { word: null, text: sentence(65) };
    expect(problemSchema.parse({ ...problems[3]!, words: [long, long, long] }).ok).toBe(false);
    expect(problemSchema.parse({ ...problems[4]!, target: long }).ok).toBe(false);
  });

  it('have one expected answer per step: one per gap, find then fix for a mistake', () => {
    expect(problems.map(problemSteps)).toEqual([1, 1, 1, 1, 1, 2]);
    expect(expectedAnswer(problems[0]!, 0)).toEqual({ kind: 'text', value: 'ý' });
    expect(expectedAnswer(problems[2]!, 0)).toEqual({ kind: 'option', value: '7' });
    expect(expectedAnswer(problems[5]!, 0)).toEqual({ kind: 'pick', index: 0 });
    expect(expectedAnswer(problems[5]!, 1)).toEqual({ kind: 'text', value: 'ý' });
    expect(() => expectedAnswer(problems[0]!, 1)).toThrow(RangeError);
  });

  it('compare typed answers after NFC and spacing, keeping case', () => {
    const decomposed = 'y\u0301';
    expect(isCorrectAnswer(problems[0]!, 0, { kind: 'text', value: ` ${decomposed} ` })).toBe(true);
    expect(isCorrectAnswer(problems[0]!, 0, { kind: 'text', value: 'í' })).toBe(false);
    const capital: Problem = {
      kind: 'gaps',
      sentence: null,
      parts: [
        { kind: 'gap', gap: 0 },
        { kind: 'text', text: 'ltava' },
      ],
      gaps: [
        gap({
          correct: 'V',
          options: ['V', 'v'],
          keys: ['V', 'v'],
          rule: 'velke-pismeno',
          word: 'vltava',
          item: spellItem('vltava', 0),
          hint: null,
        }),
      ],
    };
    expect(isCorrectAnswer(capital, 0, { kind: 'text', value: 'v' })).toBe(false);
    expect(isCorrectAnswer(capital, 0, { kind: 'text', value: 'V' })).toBe(true);
    expect(isCorrectAnswer(problems[2]!, 0, { kind: 'pick', index: 0 })).toBe(false);
  });

  it('accept the three answer kinds', () => {
    for (const value of [
      { kind: 'text', value: 'mně' },
      { kind: 'option', value: 'noun' },
      { kind: 'pick', index: 3 },
    ]) {
      expect(answerValueSchema.parse(value).ok, JSON.stringify(value)).toBe(true);
    }
    expect(answerValueSchema.parse({ kind: 'text', value: '' }).ok).toBe(false);
  });
});

describe('item IDs', () => {
  it('build and parse back', () => {
    const cases: [string, unknown][] = [
      [spellItem('mlyyn', 2), { kind: 'spell', word: 'mlyyn', at: 2 }],
      [gapItem('s.ryby-1', 0), { kind: 'gap', sentence: 's.ryby-1', gap: 0 }],
      [classItem('pos', 'ryba'), { kind: 'class', dimension: 'pos', target: 'ryba', detail: null }],
      [
        classItem('person', 'plavat', 'past1'),
        { kind: 'class', dimension: 'person', target: 'plavat', detail: 'past1' },
      ],
      [
        classItem('case', 's.ryby-1', '0'),
        { kind: 'class', dimension: 'case', target: 's.ryby-1', detail: '0' },
      ],
      [relationItem('antonym', 'velkyy'), { kind: 'rel', relation: 'antonym', word: 'velkyy' }],
      [pairItem('family', 'mlyyn'), { kind: 'pair', pair: 'family', word: 'mlyyn' }],
      ['seg:vyletext', { kind: 'seg', word: 'vyletext' }],
    ];
    for (const [id, parsed] of cases) {
      expect(itemIdSchema.parse(id).ok, id).toBe(true);
      expect(parseItemId(id), id).toEqual(parsed);
    }
  });

  it('refuse what is not an item', () => {
    for (const bad of [
      'mlyyn',
      'spell:mlyyn',
      'class:colour:ryba',
      'rel:cousin:ryba',
      'SPELL:x:1',
      'spell::1',
    ]) {
      expect(parseItemId(bad), bad).toBeNull();
    }
  });
});
