/**
 * A language problem as the child sees it, structured as the rules give it (contract
 * problems.ts), never pre-rendered text: the word or sentence with its ink-blot gaps (the gap of
 * this step glows, gaps already answered show their letters), the sentence of a Lov chyb with the
 * misspelled word to find and then fix, the word to classify (alone, highlighted in its sentence,
 * or a highlighted part of it), the words of an odd-one-out, and the word of a relation.
 *
 * `stepAnswer` says what this step takes: text (choice tiles, the big letter pad or the Czech
 * keyboard, as `ProblemView.input` says), a category option, or a pick of a word. `spokenProblem`
 * is what read-aloud says: the instruction and the text, a gap said as a pause, so hearing it
 * never gives a spelling away.
 */
import type { MessageKey, Translate } from '../i18n/messages';
import type { ContentText } from '../content/text';
import { h } from '../ui/dom';
import type {
  AnswerValue,
  Gap,
  Hint,
  Problem,
  ProblemView,
  ResolvedInputMode,
} from '../../rules/contract';

/** What the current step of a problem takes. */
export type StepAnswer =
  | { readonly kind: 'text'; readonly gap: Gap; readonly input: ResolvedInputMode }
  | { readonly kind: 'option'; readonly options: readonly { id: string; label: string }[] }
  | { readonly kind: 'pick'; readonly words: readonly string[]; readonly inSentence: boolean };

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
        return { kind: 'pick', words: problem.tokens, inSentence: true };
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
    case 'gaps':
      return problem.sentence === null ? 'round.prompt.word' : 'round.prompt.sentence';
    case 'mistake':
      return step === 0 ? 'round.prompt.find' : 'round.prompt.fix';
    case 'classify':
      return `round.classify.${problem.dimension}` as MessageKey;
    case 'odd':
      return 'round.prompt.odd';
    case 'relation':
      return `round.relation.${problem.relation}` as MessageKey;
  }
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
        return h('p', { className: 'ps-visually-hidden', text: problem.tokens.join(' ') });
      }
      return h(
        'p',
        { className: 'ps-problem__text', testId: 'problem-text', attributes: { lang: 'cs' } },
        ...problem.tokens.flatMap((token, index) => {
          const words: Node[] = index > 0 ? [document.createTextNode(' ')] : [];
          if (index !== problem.wrong) {
            words.push(document.createTextNode(token));
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
      return `${prompt} ${problem.tokens.join(' ')}`;
    case 'classify':
      return `${prompt} ${problem.context ? problem.context.tokens.join(' ') : problem.target.text}`;
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

/** The hint of the current step: the strategy, never just the answer. */
export function stepHint(problem: Problem, step: number): Hint | null {
  const gap = stepGap(problem, step);
  if (gap) return gap.hint;
  if (problem.kind === 'mistake') return null;
  if (problem.kind === 'gaps') return null;
  return problem.hint;
}

/** A hint in words (docs/design.md §5.3): a related word, a test form, a rhyme, a question. */
export function hintText(hint: Hint, t: Translate, text: ContentText): string {
  switch (hint.kind) {
    case 'family':
      return t('hint.family', { related: hint.related });
    case 'test-word':
      return t('hint.testWord', { test: hint.test });
    case 'listed':
      return text(`grammar.listed.${hint.letter}`);
    case 'ten-ta-to':
      return t('hint.tenTaTo');
    case 'case-question':
      return text(`grammar.case-question.${hint.case}`);
    case 'pattern':
      return t('hint.pattern', { pattern: text(`grammar.pattern.${hint.pattern}`) });
    case 'rule':
      return text(`grammar.rule.${hint.rule}`);
  }
}
