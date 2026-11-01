/**
 * The simulated children (learners.ts): Czech priors by item kind, deterministic answers from a
 * seed, practice and forgetting, spaced successes and misses, the time a step takes (thinking,
 * typing, reading a sentence) and the perfect and slow children's paces against the pack's limits.
 */
import { describe, expect, it } from 'vitest';
import type { ProblemRoundView } from '../../src/rules/contract';
import { lagoonPack } from '../fixtures/rules/packs';
import { LEARNERS, Learner, priorOf, stepShape } from './learners';

const data = lagoonPack().data;
const balance = data.balance;

/** A single-gap problem on `item` shown as a word (or a `words`-word sentence), by `input`. */
function showing(
  item: string,
  input: 'choice' | 'letters' | 'typed' = 'choice',
  words = 0,
): ProblemRoundView {
  const text = Array.from({ length: Math.max(0, words - 1) }, () => 'slovo').join(' ');
  return {
    problem: {
      index: 1,
      item,
      problem: {
        kind: 'gaps',
        sentence: words > 0 ? 's.test' : null,
        parts: [
          ...(words > 1 ? [{ kind: 'text', text: `${text} r` }] : [{ kind: 'text', text: 'r' }]),
          { kind: 'gap', gap: 0 },
          { kind: 'text', text: 'ba' },
        ],
        gaps: [
          {
            correct: 'y',
            options: ['i', 'y'],
            keys: ['i', 'í', 'y', 'ý'],
            rule: 'tvrda',
            word: 'ryba',
            item,
            hint: null,
          },
        ],
      },
      input,
      step: 0,
      reask: false,
      hinted: false,
    },
  } as unknown as ProblemRoundView;
}

describe('priors (what a Czech 3rd grader knows on the first day)', () => {
  const priors = LEARNERS.average.priors;
  it('knows the 2nd grade’s spelling, the consonants and the alphabet better than the rest', () => {
    expect(priorOf(data, 'spell:ryba:1', priors)).toBe(priors.review);
    expect(priorOf(data, 'class:consonant:cx', priors)).toBe(priors.letters);
    expect(priorOf(data, 'abc:ryba', priors)).toBe(priors.letters);
    expect(priorOf(data, 'rel:general:zviirxe', priors)).toBe(priors.grammar);
    expect(priors.review).toBeGreaterThan(priors.third);
    expect(priors.third).toBeGreaterThan(priors.fourth);
  });
});

describe('learners', () => {
  it('answers the same way from the same seed', () => {
    const run = (seed: string) => {
      const child = new Learner(LEARNERS.average, data, seed);
      return Array.from({ length: 40 }, (_, i) =>
        child.respond(showing(i % 2 ? 'spell:ryba:1' : 'spell:mlyyn:2', 'letters')),
      );
    };
    expect(run('same')).toEqual(run('same'));
    expect(run('same')).not.toEqual(run('other'));
  });

  it('recalls an item better after practice and worse after days without it', () => {
    const child = new Learner(LEARNERS.average, data, 'practice');
    child.day = 100;
    const before = child.recall('spell:mlyyn:2');
    for (let i = 0; i < 6; i++) child.practise('spell:mlyyn:2', true);
    const practised = child.recall('spell:mlyyn:2');
    expect(practised, `recall ${before} -> ${practised} after practice`).toBeGreaterThan(before);
    child.day = 110;
    expect(child.recall('spell:mlyyn:2'), 'ten days later').toBeLessThan(practised);
  });

  it('forgets more slowly after spaced successes, and faster again after a miss', () => {
    const fresh = { ...LEARNERS.average, priors: { ...LEARNERS.average.priors, third: 0 } };
    const spaced = new Learner(fresh, data, 'spaced');
    const once = new Learner(fresh, data, 'once');
    for (let day = 100; day <= 104; day++) {
      spaced.day = day;
      spaced.practise('spell:mlyyn:2', true);
    }
    once.day = 104;
    for (let i = 0; i < 5; i++) once.practise('spell:mlyyn:2', true);
    spaced.day = 130;
    once.day = 130;
    expect(spaced.recall('spell:mlyyn:2'), 'five spaced days').toBeGreaterThan(
      once.recall('spell:mlyyn:2'),
    );
    const missed = new Learner(fresh, data, 'missed');
    for (let day = 100; day <= 104; day++) {
      missed.day = day;
      missed.practise('spell:mlyyn:2', true);
    }
    missed.day = 104;
    missed.practise('spell:mlyyn:2', false);
    missed.day = 130;
    expect(missed.recall('spell:mlyyn:2'), 'a miss halves how long it lasts').toBeLessThan(
      spaced.recall('spell:mlyyn:2'),
    );
  });

  it('is quick when perfect and never quick when slow, even on what it knows well', () => {
    const perfect = new Learner(LEARNERS.perfect, data, 'quick');
    const slow = new Learner(LEARNERS.slow, data, 'slow');
    const known = new Learner(
      {
        ...LEARNERS.slow,
        priors: { review: 100, third: 100, fourth: 100, letters: 100, grammar: 100 },
      },
      data,
      'known',
    );
    for (let i = 0; i < 20; i++) {
      expect(perfect.respond(showing('spell:ryba:1'))).toMatchObject({ right: true });
      expect(perfect.respond(showing('spell:ryba:1')).elapsedMs).toBeLessThan(
        balance.response.choice.fastMs,
      );
      expect(slow.respond(showing('spell:ryba:1')).elapsedMs).toBeGreaterThan(
        balance.response.choice.fastMs,
      );
      expect(slow.respond(showing('spell:ryba:1', 'letters')).elapsedMs).toBeGreaterThan(
        balance.response.letters.fastMs,
      );
      // What it knows well comes to mind: within the "ok" limits.
      expect(known.respond(showing('spell:ryba:1')).elapsedMs).toBeLessThanOrEqual(
        balance.response.choice.okMs,
      );
    }
  });

  it('types each letter of a typed answer and reads a sentence before its first step', () => {
    // Two children of the same seed, at the same recall: the difference is reading six words.
    const word = new Learner(LEARNERS.average, data, 'typing').respond(
      showing('spell:ryba:1', 'typed'),
    ).elapsedMs;
    const sentence = new Learner(LEARNERS.average, data, 'typing').respond(
      showing('spell:ryba:1', 'typed', 6),
    ).elapsedMs;
    expect(stepShape(showing('spell:ryba:1', 'typed', 6))).toMatchObject({ letters: 1, words: 6 });
    expect(sentence - word).toBe(6 * LEARNERS.average.readingMsPerWord);
    const two = new Learner(LEARNERS.average, data, 'typing');
    expect(two.respond(showing('spell:ryba:1', 'typed')).elapsedMs).toBe(word);
    expect(two.elapsedMs).toBe(word);
  });
});
