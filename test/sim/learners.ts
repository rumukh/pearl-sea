/**
 * Deterministic synthetic learners for the simulation: seeded models of a Czech 3rd grader
 * answering problems. Each knows every item to some strength (0-100) that grows with practice,
 * fades with days without it and steadies with spaced successes; it answers right with a chance
 * that rises with its recall (on top of guessing among what is offered) and answers faster the
 * better it knows the item. As Dragon Valley's learners, with Czech priors: the 2nd grade's
 * spelling (the lagoon's review rules, the consonant classes, the alphabet) is known well, the
 * 3rd grade's listed words and grammar are new, the 4th grade's barely known.
 *
 * Integer arithmetic only, and randomness only from a seeded PRNG, so a simulation replays
 * exactly (the tests follow the rules' determinism lint).
 */
import { createPrng } from '@aegis/core';
import type { Prng } from '@aegis/core';
import { parseItemId } from '../../src/rules/contract';
import type { ContentData, ProblemRoundView, SpellingRule } from '../../src/rules/contract';

export type LearnerName = 'perfect' | 'average' | 'struggling' | 'slow';

/** Thinking time (ms) by how well the item comes to mind: fluent, steady, unsure. */
export interface Pace {
  fluent: number;
  steady: number;
  unsure: number;
}

/** How well a child knows each kind of item on the first day, 0-100. */
export interface Priors {
  /** Spelling of the 2nd grade, reviewed in the lagoon (tvrdé, měkké, dě tě ně, ú/ů, …). */
  review: number;
  /** Spelling new in the 3rd grade (listed words, both-way consonants, end marks). */
  third: number;
  /** Spelling of the 4th grade (bje/vje, mě/mně, prefixes, agreement, patterns). */
  fourth: number;
  /** The consonant classes and the alphabet (2nd grade). */
  letters: number;
  /** Grammar: parts of speech, gender, cases, …, relations, families, structure. */
  grammar: number;
}

export interface LearnerProfile {
  name: LearnerName;
  priors: Priors;
  /** Share of the remaining gap one right answer closes, in percent (a miss closes half as much). */
  gain: number;
  /** Strength lost per day without practice at stability 1, in percent points. */
  forget: number;
  /** Thinking time before answering by choice (and before a pick). */
  choice: Pace;
  /** Thinking time before tapping the letter pad or typing; each letter then takes `letterMs`. */
  keys: Pace;
  letterMs: number;
  /** Reading a sentence, per word. */
  readingMsPerWord: number;
  /** Never wrong, always quick. */
  perfect: boolean;
  /** Makes one avoidable slip on every minigame board. */
  clumsy: boolean;
  /** Answers a day: about a 15-minute session. */
  answersPerDay: number;
  /** Plays on the n-th day of the simulation (0-based; day 0 is a Monday). */
  playsOn(dayIndex: number): boolean;
}

const REVIEW_RULES: readonly SpellingRule[] = [
  'tvrda',
  'mekka',
  'dtn-mekke',
  'de-te-ne',
  'be-pe-ve-me',
  'delka',
  'u-zacatek',
  'u-predpona',
  'u-uprostred',
  'parova',
  'velke-pismeno',
];
const THIRD_RULES: readonly SpellingRule[] = [
  'vyjm',
  'vyjm-prefix',
  'obojetna-i',
  'u-prejate',
  'interpunkce',
  'spojka',
];

/** The spelling rule of a `spell:` or `gap:` item, read off the lexicon. */
function ruleOf(data: ContentData, item: string): SpellingRule | null {
  const parsed = parseItemId(item);
  if (parsed?.kind === 'spell') {
    const word = data.lexicon.words.find((w) => w.id === parsed.word);
    return word?.spelling?.find((p) => p.at === parsed.at)?.rule ?? null;
  }
  if (parsed?.kind === 'gap') {
    const sentence = data.lexicon.sentences.find((s) => s.id === parsed.sentence);
    return sentence?.gaps[parsed.gap]?.rule ?? null;
  }
  return null;
}

/** An item's prior (0-100) for a child with `priors`. */
export function priorOf(data: ContentData, item: string, priors: Priors): number {
  const parsed = parseItemId(item);
  if (parsed === null) return priors.grammar;
  if (parsed.kind === 'spell' || parsed.kind === 'gap') {
    const rule = ruleOf(data, item);
    if (rule === null) return priors.third;
    if (REVIEW_RULES.includes(rule)) return priors.review;
    return THIRD_RULES.includes(rule) ? priors.third : priors.fourth;
  }
  if (parsed.kind === 'abc' || (parsed.kind === 'class' && parsed.dimension === 'consonant')) {
    return priors.letters;
  }
  return priors.grammar;
}

const weekdays = (day: number) => day % 7 !== 5 && day % 7 !== 6;

/**
 * The four children of docs/testing.md §4, fixed before the balance is measured and never tuned
 * to pass a check (docs/balance-report.md explains the choices).
 */
export const LEARNERS: Readonly<Record<LearnerName, LearnerProfile>> = {
  /** The upper bound: always right, always quick, every day. */
  perfect: {
    name: 'perfect',
    priors: { review: 100, third: 100, fourth: 100, letters: 100, grammar: 100 },
    gain: 100,
    forget: 0,
    choice: { fluent: 1500, steady: 1500, unsure: 1500 },
    keys: { fluent: 1500, steady: 1500, unsure: 1500 },
    letterMs: 300,
    readingMsPerWord: 250,
    perfect: true,
    clumsy: false,
    answersPerDay: 45,
    playsOn: () => true,
  },
  /** Knows the 2nd grade's spelling well, learns an item in a few exposures, forgets slowly. */
  average: {
    name: 'average',
    priors: { review: 75, third: 20, fourth: 5, letters: 75, grammar: 25 },
    gain: 35,
    forget: 4,
    choice: { fluent: 1800, steady: 4200, unsure: 7500 },
    keys: { fluent: 2000, steady: 4800, unsure: 9000 },
    letterMs: 600,
    readingMsPerWord: 600,
    perfect: false,
    clumsy: false,
    answersPerDay: 45,
    playsOn: weekdays,
  },
  /**
   * Shaky on the 2nd grade's spelling, needs many exposures, forgets quickly, is slow and clumsy,
   * and plays four days a week.
   */
  struggling: {
    name: 'struggling',
    priors: { review: 55, third: 10, fourth: 0, letters: 55, grammar: 10 },
    gain: 20,
    forget: 6,
    choice: { fluent: 4300, steady: 6700, unsure: 10000 },
    keys: { fluent: 4500, steady: 7500, unsure: 11500 },
    letterMs: 900,
    readingMsPerWord: 900,
    perfect: false,
    clumsy: true,
    answersPerDay: 35,
    playsOn: (day) => day % 7 !== 2 && weekdays(day),
  },
  /**
   * Knows and learns like the average child but is never quick: what it knows well takes 4-5 s
   * (inside "ok"), the rest longer, and it types slowly. Tests the fluency rules (gold needs
   * quick answers) and the letter pad's time per letter.
   */
  slow: {
    name: 'slow',
    priors: { review: 75, third: 20, fourth: 5, letters: 75, grammar: 25 },
    gain: 35,
    forget: 4,
    choice: { fluent: 4500, steady: 7000, unsure: 9000 },
    keys: { fluent: 4700, steady: 7500, unsure: 10000 },
    letterMs: 1000,
    readingMsPerWord: 900,
    perfect: false,
    clumsy: false,
    answersPerDay: 35,
    playsOn: weekdays,
  },
};

interface Memory {
  strength: number;
  /** Divides the daily forgetting: grows with every spaced success, halves with a miss. */
  stability: number;
  last: number;
}

/** The words of a gapped problem's text (a gap counts as part of its word). */
function partsWords(parts: readonly { kind: string; text?: string }[]): number {
  const text = parts.map((part) => (part.kind === 'text' ? (part.text ?? '') : 'x')).join('');
  return text.split(/\s+/u).filter((word) => word.length > 0).length;
}

/** What a problem step offers to guess among, and how much there is to write and to read. */
export function stepShape(view: ProblemRoundView): {
  options: number;
  letters: number;
  words: number;
} {
  const current = view.problem!;
  const problem = current.problem;
  const keyed = current.input === 'letters' || current.input === 'typed';
  const offered = (gap: { keys: string[]; options: string[] }) =>
    !keyed ? gap.options.length : current.input === 'typed' ? 50 : gap.keys.length;
  switch (problem.kind) {
    case 'gaps': {
      const gap = problem.gaps[current.step]!;
      return {
        options: offered(gap),
        letters: keyed ? [...gap.correct].length : 0,
        words: current.step === 0 && problem.sentence !== null ? partsWords(problem.parts) : 0,
      };
    }
    case 'mistake':
      return current.step === 0
        ? { options: problem.tokens.length, letters: 0, words: problem.tokens.length }
        : {
            options: offered(problem.fix),
            letters: keyed ? [...problem.fix.correct].length : 0,
            words: 0,
          };
    case 'classify':
      return {
        options: problem.options.length,
        letters: 0,
        words: problem.context?.tokens.length ?? problem.target.text.split(' ').length,
      };
    case 'odd':
      return { options: problem.words.length, letters: 0, words: problem.words.length };
    case 'relation':
      return { options: problem.options.length, letters: 0, words: problem.options.length + 1 };
  }
}

/** One simulated child. `day` is the simulation's day number (days since 1970-01-01). */
export class Learner {
  private readonly memory = new Map<string, Memory>();
  private readonly random: Prng;
  day = 0;
  /** Total answering time so far, in milliseconds. */
  elapsedMs = 0;

  constructor(
    readonly profile: LearnerProfile,
    readonly data: ContentData,
    seed: string,
  ) {
    this.random = createPrng(`learner:${profile.name}:${seed}`);
  }

  private remember(item: string): Memory {
    let memory = this.memory.get(item);
    if (!memory) {
      // Knowledge from earlier grades is consolidated: the better known, the slower it fades.
      const strength = priorOf(this.data, item, this.profile.priors);
      memory = { strength, stability: 1 + (strength - (strength % 10)) / 10, last: this.day };
      this.memory.set(item, memory);
    }
    return memory;
  }

  /** How well the item comes to mind today, 0-100. */
  recall(item: string): number {
    const memory = this.remember(item);
    const days = Math.max(0, this.day - memory.last);
    return Math.max(
      0,
      memory.strength - Math.floor((this.profile.forget * days) / memory.stability),
    );
  }

  /** Answer the step on screen: right or wrong, how long it takes, and the recall behind it. */
  respond(view: ProblemRoundView): { right: boolean; elapsedMs: number; recall: number } {
    const current = view.problem!;
    const shape = stepShape(view);
    if (this.profile.perfect) {
      const elapsedMs = 1500 + shape.letters * this.profile.letterMs;
      this.elapsedMs += elapsedMs;
      return { right: true, elapsedMs, recall: 100 };
    }
    const item = current.item;
    const recall = this.recall(item);
    const guess = shape.options > 0 ? Math.floor(100 / shape.options) : 2;
    const chance = guess + Math.floor(((100 - guess) * recall) / 100);
    const right = this.random.int(0, 100) < chance;
    this.practise(item, right);
    const keyed = current.input === 'letters' || current.input === 'typed';
    const pace = keyed ? this.profile.keys : this.profile.choice;
    const think = recall >= 85 ? pace.fluent : recall >= 55 ? pace.steady : pace.unsure;
    const elapsedMs =
      think + shape.letters * this.profile.letterMs + shape.words * this.profile.readingMsPerWord;
    this.elapsedMs += elapsedMs;
    return { right, elapsedMs, recall };
  }

  /** One practice of an item, right or wrong (a wrong answer still shows the right one). */
  practise(item: string, right: boolean): void {
    const memory = this.remember(item);
    const current = this.recall(item);
    const spaced = this.day > memory.last;
    const gain = right ? this.profile.gain : Math.floor(this.profile.gain / 2);
    memory.strength = Math.min(100, current + Math.floor((gain * (100 - current)) / 100));
    if (right && spaced) memory.stability += 1;
    else if (!right) {
      memory.stability = Math.max(1, (memory.stability - (memory.stability % 2)) / 2);
    }
    memory.last = this.day;
  }
}
