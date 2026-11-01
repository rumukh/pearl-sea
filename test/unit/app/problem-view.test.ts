// @vitest-environment happy-dom
/**
 * A problem as the child sees it: what each step takes (choice tiles, the letter pad, the Czech
 * keyboard, a category, a word to pick), the instruction, the word or sentence with its ink-blot
 * gaps (the current one glowing, answered ones filled in, the right letters shown after a miss),
 * what read-aloud says (a gap is a pause, so hearing never gives a spelling away), answers in
 * words and the hint of each step.
 */
import { describe, expect, it } from 'vitest';
import { createContentText } from '../../../src/app/content/text';
import { createTranslator } from '../../../src/app/i18n/messages';
import {
  answerText,
  gapHoldsLetters,
  hintText,
  missText,
  problemDisplay,
  promptKey,
  spokenProblem,
  stepAnswer,
  stepGap,
  stepHint,
} from '../../../src/app/screens/problem-view';
import type { Gap, GapsProblem, MistakeProblem, TextPart } from '../../../src/rules/contract';
import { gap, MLIN, MLYN, ODD, PLAVE, problemView, RYBA, VELKY } from './game-views';

const t = createTranslator();
const text = createContentText({
  cs: {
    'grammar.pos.1': 'podstatné jméno',
    'grammar.pos.2': 'přídavné jméno',
    'grammar.pos.5': 'sloveso',
    'grammar.listed.m': 'Po m píšeme y ve vyjmenovaných slovech: my, mýt, myš…',
    'grammar.listed.p': 'Po p píšeme y ve vyjmenovaných slovech: pýcha, pytel…',
    'grammar.rule.vyjm': 'Vyjmenovaná slova a slova příbuzná píšeme s y.',
    'grammar.case-question.2': 'koho? čeho?',
    'grammar.pattern.hrad': 'hrad',
  },
  en: {},
});

function blots(element: HTMLElement): { state: string; text: string }[] {
  return [...element.querySelectorAll<HTMLElement>('.ps-blot')].map((blot) => ({
    state: blot.dataset['state'] ?? '',
    text: blot.textContent ?? '',
  }));
}

describe('what a step takes', () => {
  it('fills a gap with tiles, the letter pad or the keyboard, as the view resolves', () => {
    for (const input of ['choice', 'letters', 'typed'] as const) {
      expect(stepAnswer(problemView(MLYN, { input }), text)).toEqual({
        kind: 'text',
        gap: MLYN.kind === 'gaps' ? MLYN.gaps[0] : null,
        input,
      });
    }
  });

  it('finds a mistake by picking a word of the sentence, then fixes it in a gap', () => {
    expect(stepAnswer(problemView(MLIN, { step: 0 }), text)).toEqual({
      kind: 'pick',
      words: ['Mlín', 'stojí', 'u', 'moře.'],
      inSentence: true,
    });
    const fix = stepAnswer(problemView(MLIN, { step: 1, input: 'letters' }), text);
    expect(fix).toMatchObject({ kind: 'text', input: 'letters', gap: { correct: 'ý' } });
    expect(stepGap(MLIN, 0)).toBeNull();
    expect(stepGap(MLIN, 1)?.correct).toBe('ý');
  });

  it('classifies with the grammar terms of the content catalog, in the given order', () => {
    expect(stepAnswer(problemView(PLAVE), text)).toEqual({
      kind: 'option',
      options: [
        { id: '1', label: 'podstatné jméno' },
        { id: '2', label: 'přídavné jméno' },
        { id: '5', label: 'sloveso' },
      ],
    });
  });

  it('picks the odd word or the related word from a list', () => {
    expect(stepAnswer(problemView(ODD), text)).toEqual({
      kind: 'pick',
      words: ['byt', 'myš', 'pivo', 'syn'],
      inSentence: false,
    });
    expect(stepAnswer(problemView(VELKY), text)).toEqual({
      kind: 'pick',
      words: ['malý', 'obří', 'široký'],
      inSentence: false,
    });
  });

  it('asks for each kind and step with its own instruction', () => {
    expect(promptKey(MLYN, 0)).toBe('round.prompt.word');
    expect(promptKey(RYBA, 1)).toBe('round.prompt.sentence');
    expect(promptKey(MLIN, 0)).toBe('round.prompt.find');
    expect(promptKey(MLIN, 1)).toBe('round.prompt.fix');
    expect(promptKey(PLAVE, 0)).toBe('round.classify.pos');
    expect(promptKey(ODD, 0)).toBe('round.prompt.odd');
    expect(promptKey(VELKY, 0)).toBe('round.relation.antonym');
    for (const problem of [MLYN, RYBA, MLIN, PLAVE, ODD, VELKY]) {
      expect(t(promptKey(problem, 0))).not.toBe(promptKey(problem, 0));
    }
  });
});

describe('instructions for gaps that are no letters', () => {
  const sentence = (parts: TextPart[], gaps: Gap[]): GapsProblem => ({
    kind: 'gaps',
    sentence: 's.test',
    parts,
    gaps,
  });
  const text = (value: string): TextPart => ({ kind: 'text', text: value });
  const at = (index: number): TextPart => ({ kind: 'gap', gap: index });

  it('asks for the conjunction, the end mark, a comma inside a sentence, the standard word', () => {
    const conjunction = sentence(
      [text('Foukal silný vítr, '), at(0), text(' delfíni skákali dál.')],
      [gap('ale', { rule: 'spojka', options: ['ale', 'protože'] })],
    );
    const endMark = sentence(
      [text('Kde bydlí malá chobotnice'), at(0)],
      [gap('?', { rule: 'interpunkce', options: ['?', '.'] })],
    );
    const comma = sentence(
      [text('Krab spí'), at(0), text(' protože je unavený.')],
      [gap(',', { rule: 'interpunkce', options: [',', '.'] })],
    );
    const standard = sentence(
      [text('Ke snídani mám '), at(0), text('.')],
      [gap('mléko', { rule: 'spisovne', options: ['mléko', 'mlíko'] })],
    );
    expect(promptKey(conjunction, 0)).toBe('round.prompt.conjunction');
    expect(promptKey(endMark, 0)).toBe('round.prompt.endMark');
    expect(promptKey(comma, 0)).toBe('round.prompt.mark');
    expect(promptKey(standard, 0)).toBe('round.prompt.standard');
    expect(t('round.prompt.endMark')).toBe('Doplň znaménko na konec věty.');
  });

  it('gives each step of a sentence its own instruction', () => {
    const mixed = sentence(
      [text('Kde b'), at(0), text('dlí ml'), at(1), text('nář'), at(2), text(' ')],
      [gap('y'), gap('y'), gap('?', { rule: 'interpunkce', options: ['?', '.'] })],
    );
    expect([0, 1, 2].map((step) => promptKey(mixed, step))).toEqual([
      'round.prompt.sentence',
      'round.prompt.sentence',
      'round.prompt.endMark',
    ]);
  });

  it('hunts a colloquial word as such, and fixes it with the standard word', () => {
    const colloquial: MistakeProblem = {
      kind: 'mistake',
      sentence: 'register.01',
      tokens: ['Delfín', 'má', 'velkej', 'hlad.'],
      wrong: 2,
      fix: gap('velký', { rule: 'spisovne', options: ['velký', 'velkej'] }),
      around: ['', ''],
    };
    expect(promptKey(colloquial, 0)).toBe('round.prompt.findColloquial');
    expect(promptKey(colloquial, 1)).toBe('round.prompt.standard');
    expect(spokenProblem(problemView(colloquial), t)).toBe(
      `${t('round.prompt.findColloquial')} Delfín má velkej hlad.`,
    );
    const endMark: MistakeProblem = {
      kind: 'mistake',
      sentence: 'kind.06',
      tokens: ['Kde', 'bydlí', 'malá', 'chobotnice.'],
      wrong: 3,
      fix: gap('?', { rule: 'interpunkce', options: ['?', '.'] }),
      around: ['chobotnice', ''],
    };
    expect(promptKey(endMark, 0)).toBe('round.prompt.find');
    expect(promptKey(endMark, 1)).toBe('round.prompt.endMark');
  });

  it('calls a pad of letters letters, and one of words or marks choices', () => {
    expect(gapHoldsLetters(gap('ý'))).toBe(true);
    for (const rule of ['spojka', 'interpunkce', 'spisovne'] as const) {
      expect(gapHoldsLetters(gap('x', { rule }))).toBe(false);
    }
  });
});

describe('the problem on screen', () => {
  it('shows a word with its gap as an ink blot that glows until it is answered', () => {
    const word = problemDisplay(problemView(MLYN), t);
    expect(word.classList.contains('ps-problem__text--word')).toBe(true);
    expect(word.getAttribute('lang')).toBe('cs');
    expect(word.textContent).toBe('ml\u00a0n');
    expect(blots(word)).toEqual([{ state: 'current', text: '\u00a0' }]);
    expect(blots(problemDisplay(problemView(MLYN), t, true))).toEqual([
      { state: 'later', text: '\u00a0' },
    ]);
  });

  it('writes the right letters into the gap after a miss', () => {
    const shown = problemDisplay(problemView(MLYN), t, true, 'ý');
    expect(blots(shown)).toEqual([{ state: 'revealed', text: 'ý' }]);
    expect(shown.textContent).toBe('mlýn');
  });

  it('fills the gaps already answered in a sentence and glows at the current one', () => {
    const sentence = problemDisplay(problemView(RYBA, { step: 1 }), t);
    expect(sentence.classList.contains('ps-problem__text--word')).toBe(false);
    expect(blots(sentence)).toEqual([
      { state: 'done', text: 'y' },
      { state: 'current', text: '\u00a0' },
    ]);
    expect(sentence.textContent).toBe('Ryba plave u ml\u00a0na.');
    expect(blots(problemDisplay(problemView(RYBA, { step: 2 }), t))).toEqual([
      { state: 'done', text: 'y' },
      { state: 'done', text: 'ý' },
    ]);
  });

  it('keeps the sentence of a mistake hunt in its word buttons, then marks the word to fix', () => {
    const find = problemDisplay(problemView(MLIN, { step: 0 }), t);
    expect(find.classList.contains('ps-visually-hidden')).toBe(true);
    const fix = problemDisplay(problemView(MLIN, { step: 1 }), t);
    const mark = fix.querySelector('.ps-problem__fix');
    expect(mark?.textContent).toBe('Ml\u00a0n');
    expect(fix.textContent).toBe('Ml\u00a0n stojí u moře.');
    expect(blots(fix)).toEqual([{ state: 'current', text: '\u00a0' }]);
  });

  it('highlights the word to classify in its sentence, or a part of a word', () => {
    const inSentence = problemDisplay(problemView(PLAVE), t);
    expect(inSentence.querySelector('.ps-problem__mark')?.textContent).toBe('plave');
    expect(inSentence.textContent).toBe('Ryba plave u mlýna.');
    const part = problemDisplay(
      problemView({
        ...PLAVE,
        context: null,
        target: { word: null, text: 'mlynář' },
        span: [3, 6],
      }),
      t,
    );
    expect(part.querySelector('.ps-problem__mark')?.textContent).toBe('nář');
    expect(part.textContent).toBe('mlynář');
    const alone = problemDisplay(problemView({ ...PLAVE, context: null }), t);
    expect(alone.textContent).toBe('plave');
    expect(problemDisplay(problemView(VELKY), t).textContent).toBe('velký');
  });
});

describe('read-aloud', () => {
  it('says the instruction and the text, with a gap as a pause, never the spelling', () => {
    expect(spokenProblem(problemView(MLYN), t)).toBe(`${t('round.prompt.word')} ml…n`);
    expect(spokenProblem(problemView(RYBA, { step: 1 }), t)).toBe(
      `${t('round.prompt.sentence')} R…ba plave u ml…na.`,
    );
    expect(spokenProblem(problemView(ODD), t)).toBe(`${t('round.prompt.odd')} byt, myš, pivo, syn`);
    expect(spokenProblem(problemView(PLAVE), t)).toBe(
      `${t('round.classify.pos')} Ryba plave u mlýna.`,
    );
  });
});

describe('answers and hints in words', () => {
  it('names an answer as the feedback shows it', () => {
    expect(answerText(MLYN, { kind: 'text', value: 'ý' }, text)).toBe('ý');
    expect(answerText(PLAVE, { kind: 'option', value: '5' }, text)).toBe('sloveso');
    expect(answerText(ODD, { kind: 'pick', index: 2 }, text)).toBe('pivo');
    expect(answerText(VELKY, { kind: 'pick', index: 0 }, text)).toBe('malý');
    expect(answerText(MLIN, { kind: 'pick', index: 0 }, text)).toBe('Mlín');
  });

  it('never calls the misspelled word right when a right word was tapped in a Lov chyb', () => {
    expect(missText(MLIN, 0, { kind: 'pick', index: 0 }, t, text)).toEqual({
      lead: null,
      line: 'Tohle slovo je v\u00a0pořádku.',
    });
    expect(missText(MLIN, 1, { kind: 'text', value: 'ý' }, t, text)).toEqual({
      lead: t('miss.almost'),
      line: t('miss.answer', { answer: 'ý' }),
    });
    expect(missText(PLAVE, 0, { kind: 'option', value: '5' }, t, text).line).toContain('sloveso');
    expect(missText(ODD, 0, { kind: 'pick', index: 2 }, t, text).line).toContain('pivo');
  });

  it('gives each step its own hint: the gap’s, the fix’s, the problem’s, none to find', () => {
    expect(stepHint(MLYN, 0)).toEqual({ kind: 'family', word: 'mlyn', related: 'mlynář' });
    expect(stepHint(MLIN, 0)).toBeNull();
    expect(stepHint(MLIN, 1)).toEqual({ kind: 'listed', letter: 'm' });
    expect(stepHint(PLAVE, 0)).toEqual({ kind: 'rule', rule: 'vyjm' });
    expect(stepHint(VELKY, 0)).toBeNull();
  });

  it('turns every kind of hint into a strategy line', () => {
    expect(hintText({ kind: 'family', word: 'mlyn', related: 'mlynář' }, t, text)).toContain(
      'mlynář',
    );
    expect(hintText({ kind: 'test-word', word: 'hrad', test: 'hrady' }, t, text)).toContain(
      'hrady',
    );
    expect(hintText({ kind: 'listed', letter: 'm' }, t, text)).toBe(
      'Po m píšeme y ve vyjmenovaných slovech: my, mýt, myš…',
    );
    expect(hintText({ kind: 'ten-ta-to', gender: 'f' }, t, text)).toBe(t('hint.tenTaTo'));
    expect(hintText({ kind: 'case-question', case: 2 }, t, text)).toBe('koho? čeho?');
    expect(hintText({ kind: 'pattern', pattern: 'hrad' }, t, text)).toContain('hrad');
    // Czech typesetting keeps one-letter words with the next word (a slova, s y).
    expect(hintText({ kind: 'rule', rule: 'vyjm' }, t, text)).toBe(
      'Vyjmenovaná slova a\u00a0slova příbuzná píšeme s\u00a0y.',
    );
  });
});
