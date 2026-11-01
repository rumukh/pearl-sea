/**
 * A language problem as the child sees it, structured as the rules give it (contract
 * problems.ts), never pre-rendered text: the word or sentence with its ink-blot gaps (the gap of
 * this step glows, gaps already answered show their letters), the sentence of a Lov chyb with the
 * misspelled word to find and then fix, the word to classify (alone, highlighted in its sentence,
 * or a highlighted part of it), the words of an odd-one-out, and the word of a relation.
 *
 * `stepAnswer` says what this step takes: text (choice tiles, the big letter pad or the Czech
 * keyboard, as `ProblemView.input` says), a category option, or a pick of a word. `promptKey` is the
 * step's instruction: a gap that is no letters asks for its conjunction, end mark (a comma inside
 * a sentence) or standard word, and a Lov chyb of a colloquial word asks for the colloquial word.
 * `spokenProblem` is what read-aloud says: the instruction and the text, a gap said as a pause, so
 * hearing it never gives a spelling away. Punctuation the rules give beside the tokens (`marks`:
 * _Delfíne, skoč!_) is written after each token, outside any highlight, and read aloud with it.
 */
import type { MessageKey, Translate } from '../i18n/messages';
import type { ContentText } from '../content/text';
import { h } from '../ui/dom';
import type {
  AnswerValue,
  Gap,
  GapsProblem,
  Hint,
  MistakeProblem,
  Problem,
  ProblemView,
  ResolvedInputMode,
} from '../../rules/contract';

/** What the current step of a problem takes. */
export type StepAnswer =
  | { readonly kind: 'text'; readonly gap: Gap; readonly input: ResolvedInputMode }
  | { readonly kind: 'option'; readonly options: readonly { id: string; label: string }[] }
  | {
      readonly kind: 'pick';
      readonly words: readonly string[];
      readonly inSentence: boolean;
      /** The punctuation after each word of a sentence (`marks`), shown outside the buttons. */
      readonly marks?: readonly string[];
    };

/** Tokens with the punctuation the rules give beside them (`marks`), as one reads them. */
export function withMarks(
  tokens: readonly string[],
  marks: readonly string[] | undefined,
): string[] {
  return tokens.map((token, index) => token + (marks?.[index] ?? ''));
}

/** The gap a text step fills: a gap of the word or sentence, or the fix of a mistake. */
export function stepGap(problem: Problem, step: number): Gap | null {
  if (problem.kind === 'gaps') return problem.gaps[step] ?? null;
  if (problem.kind === 'mistake' && step === 1) return problem.fix;
  return null;
}

export function stepAnswer(view: ProblemView, text: ContentText): StepAnswer {
  const { problem, step } = view;
  switch (problem.kind) {
    case 'gaps':
    case 'mistake': {
      if (problem.kind === 'mistake' && step === 0) {
        return {
          kind: 'pick',
          words: problem.tokens,
          inSentence: true,
          ...(problem.marks ? { marks: problem.marks } : {}),
        };
      }
      const gap = stepGap(problem, step)!;
      return { kind: 'text', gap, input: view.input };
    }
    case 'classify':
      return {
        kind: 'option',
        options: problem.options.map((value) => ({
          id: value,
          label: text(`grammar.${problem.dimension}.${value}`),
        })),
      };
    case 'odd':
      return { kind: 'pick', words: problem.words.map((word) => word.text), inSentence: false };
    case 'relation':
      return { kind: 'pick', words: problem.options.map((word) => word.text), inSentence: false };
  }
}

/** The instruction above a problem at a step. */
export function promptKey(problem: Problem, step: number): MessageKey {
  switch (problem.kind) {
    case 'gaps': {
      const gap = problem.gaps[step];
      const special = gap ? wholeGapPromptKey(gap, gapEndsSentence(problem, step)) : null;
      return special ?? (problem.sentence === null ? 'round.prompt.word' : 'round.prompt.sentence');
    }
    case 'mistake':
      if (step === 0) {
        return problem.fix.rule === 'spisovne'
          ? 'round.prompt.findColloquial'
          : 'round.prompt.find';
      }
      return wholeGapPromptKey(problem.fix, mistakeEndsSentence(problem)) ?? 'round.prompt.fix';
    case 'classify':
      return `round.classify.${problem.dimension}` as MessageKey;
    case 'odd':
      return 'round.prompt.odd';
    case 'relation':
      return `round.relation.${problem.relation}` as MessageKey;
  }
}

/** Sentence rules whose gap is no letters but a whole conjunction, mark or word. */
const WHOLE_GAP_RULES: readonly string[] = ['spojka', 'interpunkce', 'spisovne'];

/** Whether a gap is filled with letters (the letter pad's keys are letters). */
export function gapHoldsLetters(gap: Gap): boolean {
  return !WHOLE_GAP_RULES.includes(gap.rule);
}

/**
 * What a gap that is not letters asks for: the conjunction, the end mark (or, inside a sentence,
 * a comma between clauses) or the standard word in place of its colloquial twin. "Doplň" fits
 * every input, the tiles, the pad and the keyboard alike.
 */
function wholeGapPromptKey(gap: Gap, endsSentence: boolean): MessageKey | null {
  switch (gap.rule) {
    case 'spojka':
      return 'round.prompt.conjunction';
    case 'interpunkce':
      return endsSentence ? 'round.prompt.endMark' : 'round.prompt.mark';
    case 'spisovne':
      return 'round.prompt.standard';
    default:
      return null;
  }
}

/** Whether nothing but spaces follows gap `gap` (its end mark ends the sentence). */
function gapEndsSentence(problem: GapsProblem, gap: number): boolean {
  const at = problem.parts.findIndex((part) => part.kind === 'gap' && part.gap === gap);
  return (
    at >= 0 &&
    problem.parts.slice(at + 1).every((part) => part.kind === 'text' && part.text.trim() === '')
  );
}

function mistakeEndsSentence(problem: MistakeProblem): boolean {
  return (
    problem.wrong === problem.tokens.length - 1 &&
    problem.around[1].trim() === '' &&
    (problem.marks?.[problem.wrong] ?? '') === ''
  );
}

function blot(
  gap: Gap,
  index: number,
  step: number,
  answered: boolean,
  reveal: string | undefined,
): HTMLElement {
  const current = index === step;
  const state =
    index < step
      ? 'done'
      : current && reveal !== undefined
        ? 'revealed'
        : current && !answered
          ? 'current'
          : 'later';
  return h('span', {
    className: 'ps-blot',
    dataset: { state, gap: String(index) },
    text: state === 'done' ? gap.correct : state === 'revealed' ? reveal! : '\u00a0',
  });
}

/**
 * The problem's text with its gaps. `answered` marks the current step as answered (its feedback
 * is showing), so its blot no longer glows; `reveal` writes the right letters into it after a
 * miss, so the child sees the word spelled right.
 */
export function problemDisplay(
  view: ProblemView,
  t: Translate,
  answered = false,
  reveal?: string,
): HTMLElement {
  const { problem, step } = view;
  switch (problem.kind) {
    case 'gaps': {
      const single = problem.sentence === null;
      return h(
        'p',
        {
          className: `ps-problem__text${single ? ' ps-problem__text--word' : ''}`,
          testId: 'problem-text',
          attributes: { lang: 'cs' },
        },
        ...problem.parts.map((part) =>
          part.kind === 'text'
            ? document.createTextNode(part.text)
            : blot(problem.gaps[part.gap]!, part.gap, step, answered, reveal),
        ),
      );
    }
    case 'mistake': {
      if (step === 0) {
        // The sentence itself is the answer: its words are buttons (stepAnswer is a pick).
        return h('p', {
          className: 'ps-visually-hidden',
          text: withMarks(problem.tokens, problem.marks).join(' '),
        });
      }
      return h(
        'p',
        { className: 'ps-problem__text', testId: 'problem-text', attributes: { lang: 'cs' } },
        ...problem.tokens.flatMap((token, index) => {
          const words: Node[] = index > 0 ? [document.createTextNode(' ')] : [];
          const mark = problem.marks?.[index] ?? '';
          if (index !== problem.wrong) {
            words.push(document.createTextNode(token + mark));
            return words;
          }
          words.push(
            h(
              'mark',
              { className: 'ps-problem__fix' },
              problem.around[0],
              blot(problem.fix, 1, step, answered, reveal),
              problem.around[1],
            ),
          );
          if (mark) words.push(document.createTextNode(mark));
          return words;
        }),
      );
    }
    case 'classify': {
      const { target, context, span } = problem;
      if (context) {
        return h(
          'p',
          { className: 'ps-problem__text', testId: 'problem-text', attributes: { lang: 'cs' } },
          ...context.tokens.flatMap((token, index) => [
            ...(index > 0 ? [document.createTextNode(' ')] : []),
            index === context.at
              ? h('mark', { className: 'ps-problem__mark', text: token })
              : document.createTextNode(token),
            ...(context.marks?.[index] ? [document.createTextNode(context.marks[index])] : []),
          ]),
        );
      }
      if (span) {
        const letters = [...target.text];
        return h(
          'p',
          {
            className: 'ps-problem__text ps-problem__text--word',
            testId: 'problem-text',
            attributes: { lang: 'cs' },
          },
          letters.slice(0, span[0]).join(''),
          h('mark', {
            className: 'ps-problem__mark',
            text: letters.slice(span[0], span[1]).join(''),
          }),
          letters.slice(span[1]).join(''),
        );
      }
      return h('p', {
        className: 'ps-problem__text ps-problem__text--word',
        testId: 'problem-text',
        text: target.text,
        attributes: { lang: 'cs' },
      });
    }
    case 'odd':
      return h('p', { className: 'ps-visually-hidden', text: t('round.prompt.odd') });
    case 'relation':
      return h('p', {
        className: 'ps-problem__text ps-problem__text--word',
        testId: 'problem-text',
        text: problem.target.text,
        attributes: { lang: 'cs' },
      });
  }
}

/** What read-aloud says for a problem: the instruction and its text, a gap as a pause. */
export function spokenProblem(view: ProblemView, t: Translate): string {
  const { problem, step } = view;
  const prompt = t(promptKey(problem, step));
  switch (problem.kind) {
    case 'gaps':
      return `${prompt} ${problem.parts
        .map((part) => (part.kind === 'text' ? part.text : '…'))
        .join('')}`;
    case 'mistake':
      return `${prompt} ${withMarks(problem.tokens, problem.marks).join(' ')}`;
    case 'classify':
      return `${prompt} ${
        problem.context
          ? withMarks(problem.context.tokens, problem.context.marks).join(' ')
          : problem.target.text
      }`;
    case 'odd':
      return `${prompt} ${problem.words.map((word) => word.text).join(', ')}`;
    case 'relation':
      return `${prompt} ${problem.target.text}`;
  }
}

/** An answer in words, as the feedback shows it ("ý", "podstatné jméno", "mlýn"). */
export function answerText(problem: Problem, value: AnswerValue, text: ContentText): string {
  switch (value.kind) {
    case 'text':
      return value.value;
    case 'option':
      return problem.kind === 'classify'
        ? text(`grammar.${problem.dimension}.${value.value}`)
        : value.value;
    case 'pick': {
      const words =
        problem.kind === 'odd'
          ? problem.words.map((word) => word.text)
          : problem.kind === 'relation'
            ? problem.options.map((word) => word.text)
            : problem.kind === 'mistake'
              ? problem.tokens
              : [];
      return words[value.index] ?? '';
    }
  }
}

/**
 * What the feedback says after a miss: _Skoro! Správně je: ý_. A right word tapped while hunting a
 * Lov chyb's mistake is _Tohle slovo je v pořádku._ (docs/design.md §5.6), never "správně je" and
 * the misspelled word, and the fix step that follows marks where the mistake was.
 */
export function missText(
  problem: Problem,
  step: number,
  expected: AnswerValue,
  t: Translate,
  text: ContentText,
): { readonly lead: string | null; readonly line: string } {
  if (problem.kind === 'mistake' && step === 0) return { lead: null, line: t('miss.wordIsFine') };
  return {
    lead: t('miss.almost'),
    line: t('miss.answer', { answer: answerText(problem, expected, text) }),
  };
}

/** The hint of the current step: the strategy, never just the answer. */
export function stepHint(problem: Problem, step: number): Hint | null {
  const gap = stepGap(problem, step);
  if (gap) return gap.hint;
  if (problem.kind === 'mistake') return null;
  if (problem.kind === 'gaps') return null;
  return problem.hint;
}

/**
 * A hint in words (docs/design.md §5.3): a related word, a test form, a rhyme, a question, the way
 * to find an answer step by step, or a word that is not listed, with its gap blanked (_b_lý_:
 * spelled out it would be the answer). Hints are optional help, so one whose content string or
 * word the pack lacks is `null` and simply not shown, never an error in the middle of a round.
 * `lemmaOf` gives a lexicon word's lemma.
 */
export function hintText(
  hint: Hint,
  t: Translate,
  text: ContentText,
  lemmaOf: (word: string) => string | null,
): string | null {
  const content = (key: string): string | null => (text.has(key) ? text(key) : null);
  switch (hint.kind) {
    case 'family':
      return t('hint.family', { related: hint.related });
    case 'test-word':
      return t('hint.testWord', { test: hint.test });
    case 'listed':
      return content(`grammar.listed.${hint.letter}`);
    case 'ten-ta-to':
      return t(hint.plural ? 'hint.tenTaToPlural' : 'hint.tenTaTo');
    case 'case-question':
      return content(`grammar.case-question.${hint.case}`);
    case 'pattern': {
      const pattern = content(`grammar.pattern.${hint.pattern}`);
      return pattern === null ? null : t('hint.pattern', { pattern });
    }
    case 'rule':
      return content(`grammar.rule.${hint.rule}`);
    case 'method':
      return content(`grammar.method.${hint.method}`);
    case 'not-listed': {
      const lemma = lemmaOf(hint.word);
      if (lemma === null) return null;
      const letters = [...lemma];
      const [start, end] = hint.span;
      const blanked = [...letters.slice(0, start), '_'.repeat(end - start), ...letters.slice(end)];
      return t('hint.notListed', { word: blanked.join('') });
    }
  }
}
