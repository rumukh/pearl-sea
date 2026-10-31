/**
 * Options and letter-pad keys of a gap (design §5.2, §6.6).
 *
 * **Options** (choice input) are the right text and plausible mistakes, the signature mistake of
 * the rule first, in seeded order (the `distractors` stream). The candidates are the point's or
 * the sentence gap's own alternatives, ranked by the rule, then further mistakes the rule makes
 * plausible (a spell.word skill with `choices: 4` asks quality and length together, i/í/y/ý):
 *
 * - i/y rules and `vzor`: i↔y at the same length, then the other length (ý: í, y, i);
 * - `delka`: the other length; ú/ů rules: ú↔ů, then u;
 * - `de-te-ne`: e for ě, then je; `be-pe-ve-me`: the heard je after b, p, v or ně after m
 *   (objed, mněsto), then e;
 *   `bje-vje`: ě for je; `mne`, `mne-zajmeno`: mě↔mně;
 * - `parova`: the letter heard (its pair); `velke-pismeno`: the other case;
 * - the rest (`predpona-predlozka`, `predpona-souhlaska`, `shoda`, `interpunkce`, `spojka`): the
 *   alternatives as written in the lexicon.
 *
 * **Keys** are the big letter pad of the gap's rule (i í y ý, e é ě je, mě mně, u ú ů, a vowel's
 * short and long form, a consonant pair, lower and upper case, i y a for agreement, . ? ! , for
 * end marks); a gap whose answer is not one of its rule's keys (a whole token, a conjunction)
 * shows its own options as keys. Keys always include the answer and every alternative.
 */
import type { RandomStream } from '@aegis/runtime';
import { PAIRED_CONSONANTS } from '../contract';
import type { SpellingRule } from '../contract';
import { shuffle } from './random';

export const IY_RULES: readonly SpellingRule[] = [
  'vyjm',
  'vyjm-prefix',
  'obojetna-i',
  'tvrda',
  'mekka',
  'dtn-mekke',
  'vzor',
];
export const E_RULES: readonly SpellingRule[] = ['de-te-ne', 'be-pe-ve-me', 'bje-vje'];
export const MNE_RULES: readonly SpellingRule[] = ['mne', 'mne-zajmeno'];
export const U_RULES: readonly SpellingRule[] = [
  'u-zacatek',
  'u-predpona',
  'u-uprostred',
  'u-prejate',
];

const VOWEL_PAIRS: readonly (readonly string[])[] = [
  ['a', 'á'],
  ['e', 'é'],
  ['i', 'í'],
  ['o', 'ó'],
  ['u', 'ú', 'ů'],
  ['y', 'ý'],
];

const lower = (text: string) => text.toLowerCase();
const isUpper = (text: string) => text.length > 0 && text !== text.toLowerCase();
/** `text` with its first letter in upper case. */
export function capitalize(text: string): string {
  const [first = '', ...rest] = [...text];
  return first.toUpperCase() + rest.join('');
}

/** The rule's letter pad, in lower case, for an answer `correct` (lower case), or `null`. */
function basePad(rule: SpellingRule, correct: string): string[] | null {
  if (IY_RULES.includes(rule)) return ['i', 'í', 'y', 'ý'];
  if (E_RULES.includes(rule)) return ['e', 'é', 'ě', 'je'];
  if (MNE_RULES.includes(rule)) return ['mě', 'mně'];
  if (U_RULES.includes(rule)) return ['u', 'ú', 'ů'];
  if (rule === 'delka') {
    const pair = VOWEL_PAIRS.find((pair) => pair.includes(correct));
    return pair ? [...pair] : null;
  }
  if (rule === 'parova') {
    const pair = PAIRED_CONSONANTS.find((pair) => (pair as readonly string[]).includes(correct));
    return pair ? [...pair] : null;
  }
  if (rule === 'shoda') return ['i', 'y', 'a'];
  if (rule === 'interpunkce') return ['.', '?', '!', ','];
  return null;
}

/** The letter-pad keys of a gap: the rule's pad (in the answer's case) plus every option. */
export function padKeys(
  rule: SpellingRule,
  correct: string,
  alternatives: readonly string[],
): string[] {
  const upper = isUpper(correct) && rule !== 'velke-pismeno';
  let pad: string[] | null;
  if (rule === 'velke-pismeno') {
    pad = [lower(correct), capitalize(lower(correct))];
  } else {
    pad = basePad(rule, lower(correct));
    if (pad !== null && upper) pad = pad.map(capitalize);
  }
  const keys = pad !== null && pad.includes(correct) ? [...pad] : [correct];
  for (const text of [correct, ...alternatives]) if (!keys.includes(text)) keys.push(text);
  return keys.slice(0, 12);
}

/**
 * Mistakes the rule makes plausible for `correct` (lower case), most plausible first; `before` is
 * the letter before the gap, where the rule's slip depends on it.
 */
function ruleMistakes(rule: SpellingRule, correct: string, before: string | null): string[] {
  if (IY_RULES.includes(rule)) {
    const swaps: Readonly<Record<string, readonly string[]>> = {
      i: ['y', 'í', 'ý'],
      í: ['ý', 'i', 'y'],
      y: ['i', 'ý', 'í'],
      ý: ['í', 'y', 'i'],
    };
    return [...(swaps[correct] ?? [])];
  }
  if (rule === 'delka' || U_RULES.includes(rule)) {
    const pair = VOWEL_PAIRS.find((p) => p.includes(correct));
    if (correct === 'ú') return ['ů', 'u'];
    if (correct === 'ů') return ['ú', 'u'];
    if (correct === 'u') return ['ú', 'ů'];
    return pair ? pair.filter((v) => v !== correct) : [];
  }
  if (rule === 'de-te-ne') return correct === 'ě' ? ['e', 'je'] : ['ě'];
  if (rule === 'be-pe-ve-me') {
    if (correct !== 'ě') return ['ě'];
    // The slip one hears: je after b, p, v (objed), ně after m (mněsto).
    if (before === 'm') return ['ně', 'e'];
    if (before === 'b' || before === 'p' || before === 'v' || before === 'f') return ['je', 'e'];
    return ['je', 'ně', 'e'];
  }
  if (rule === 'bje-vje') return correct === 'je' ? ['ě', 'e'] : ['je'];
  if (MNE_RULES.includes(rule)) {
    if (correct === 'mně') return ['mě'];
    if (correct === 'mě') return ['mně'];
    return [];
  }
  if (rule === 'parova') {
    const pair = PAIRED_CONSONANTS.find((p) => (p as readonly string[]).includes(correct));
    return pair ? pair.filter((letter) => letter !== correct) : [];
  }
  return [];
}

/**
 * The distractors of a gap, signature first: its own alternatives ranked by the rule, then the
 * rule's further mistakes. Never the answer; unique.
 */
export function rankedMistakes(
  rule: SpellingRule,
  correct: string,
  alternatives: readonly string[],
  before: string | null = null,
): string[] {
  if (rule === 'velke-pismeno') {
    const other = isUpper(correct) ? lower(correct) : capitalize(correct);
    return [...new Set([...alternatives, other])].filter((text) => text !== correct);
  }
  const upper = isUpper(correct);
  const ranking = ruleMistakes(rule, lower(correct), before === null ? null : lower(before)).map(
    (text) => (upper ? capitalize(text) : text),
  );
  const rank = (text: string) => {
    const at = ranking.indexOf(text);
    return at === -1 ? ranking.length : at;
  };
  const own = alternatives
    .map((text, order) => ({ text, order }))
    .sort((a, b) => rank(a.text) - rank(b.text) || a.order - b.order)
    .map((entry) => entry.text);
  return [...new Set([...own, ...ranking])].filter((text) => text !== correct);
}

/**
 * Choice options of a gap: the answer and `count - 1` mistakes (the signature always, the rest
 * the next ranked ones), in seeded order. Fewer when fewer mistakes exist (at least 2 options).
 */
export function gapOptions(
  rule: SpellingRule,
  correct: string,
  alternatives: readonly string[],
  count: number,
  random: RandomStream,
  before: string | null = null,
): string[] {
  const mistakes = rankedMistakes(rule, correct, alternatives, before);
  return shuffle([correct, ...mistakes.slice(0, Math.max(1, count - 1))], random);
}
