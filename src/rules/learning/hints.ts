/**
 * Hints show the strategy, not just the answer (design §5.3, contract §5.3):
 *
 * - `vyjm`: the family word (mlynář → mlýn), or for a rhyme word its letter's school rhyme;
 * - `obojetna-i`: after a listed letter, that the word is not listed, shown with its gap (b_lý),
 *   unless the gap with its other letter is another word (b_t: být); never the rhyme of y-words,
 *   which may hold a look-alike (být for bít); else the rule line;
 * - `parova`, `u-uprostred`: the test word (hrad → hrady, dům → domy), when the point has one;
 * - `mne-zajmeno`: the case question; `shoda`: the subject's test, ti, ty, ta for a plural one,
 *   the rule line for several subjects; `vzor`: the pattern;
 * - every other rule: the rule in one line;
 * - classifications: ten, ta, to for the gender; the method of the case, the pattern, the tense,
 *   the mood and the verb form (never the case question or the pattern, which are the answer).
 */
import type { DeepReadonly } from '@aegis/runtime';
import { HINT_METHODS, LISTED_LETTERS, codePoints, genderClass } from '../contract';
import type {
  Case,
  Dimension,
  Hint,
  HintMethod,
  SentenceGap,
  SpellingPoint,
  SpellingRule,
  Word,
} from '../contract';
import { lexiconIndex } from './index-cache';
import type { ClassTarget } from './item-info';
import type { ParsedSentence } from './index-cache';
import type { Data } from '../types';

type Read<T> = DeepReadonly<T>;

const ruleHint = (rule: SpellingRule): Hint => ({ kind: 'rule', rule });

/**
 * Whether the word, with one of its point's alternatives in the gap, is another word or form of
 * the lexicon (bít → být, vír → výr): shown with its gap, b_t would be a listed word too.
 */
function spellsAnother(data: Data, word: Read<Word>, point: Read<SpellingPoint>): boolean {
  const letters = codePoints(word.lemma);
  const end = point.at + codePoints(point.correct).length;
  const spellings = lexiconIndex(data).spellings;
  return point.alt.some((alt) => {
    const other = [...letters.slice(0, point.at), alt, ...letters.slice(end)].join('');
    return other !== word.lemma && spellings.has(other);
  });
}

/** The hint of a gap in a word (`point`) or a sentence (`gap`). */
export function gapHint(
  data: Data,
  rule: SpellingRule,
  word: Read<Word> | null,
  point: Read<SpellingPoint> | null,
  sentence: { parsed: ParsedSentence; gap: Read<SentenceGap> } | null,
): Hint {
  const lexicon = lexiconIndex(data);
  switch (rule) {
    case 'vyjm': {
      const family = word?.family ? lexicon.families.get(word.family.id) : undefined;
      if (word && family) {
        if (family.head === word.id && family.letter !== null) {
          return { kind: 'listed', letter: family.letter };
        }
        if (family.head !== word.id) return { kind: 'family', word: word.id, related: family.head };
      }
      return ruleHint(rule);
    }
    case 'obojetna-i': {
      // Not the listed rhyme: it lists only y-words, so for an i it points the wrong way, and a
      // look-alike in it (být for bít, mlýn for mlít) confirms the slip. After a listed letter the
      // hint says the word is not listed, shown with its gap; elsewhere, and where the gap with
      // its other letter is another word (b_t: být, a listed word), the rule line, which tells
      // such words apart by their meaning.
      const letters = word ? codePoints(word.lemma.toLowerCase()) : [];
      const before = point && point.at > 0 ? letters[point.at - 1] : undefined;
      if (
        word &&
        point &&
        before !== undefined &&
        (LISTED_LETTERS as readonly string[]).includes(before) &&
        !spellsAnother(data, word, point)
      ) {
        return {
          kind: 'not-listed',
          word: word.id,
          span: [point.at, point.at + codePoints(point.correct).length],
        };
      }
      return ruleHint(rule);
    }
    case 'parova':
    case 'u-uprostred':
      return word && point?.test !== undefined
        ? { kind: 'test-word', word: word.id, test: point.test }
        : ruleHint(rule);
    case 'mne-zajmeno':
      return sentence?.gap.case !== undefined
        ? { kind: 'case-question', case: sentence.gap.case as Case }
        : ruleHint(rule);
    case 'shoda': {
      // A plural subject's test is ti, ty, ta (ty děti → -y); ten, ta, to would give to dítě.
      // Several subjects (delfíni a želvy) are not decided word by word: the rule line says how.
      const subjects = sentence?.gap.subjects ?? [];
      const token =
        subjects.length === 1 ? sentence?.parsed.sentence.tokens?.[subjects[0]!] : undefined;
      if (token?.gender === undefined) return ruleHint(rule);
      return token.number === 'pl'
        ? { kind: 'ten-ta-to', gender: token.gender, plural: true }
        : { kind: 'ten-ta-to', gender: token.gender };
    }
    case 'vzor': {
      const pattern = word?.noun?.pattern;
      return pattern ? { kind: 'pattern', pattern } : ruleHint(rule);
    }
    default:
      return ruleHint(rule);
  }
}

/**
 * The hint of a classification: ten, ta, to for the gender; for the case, the pattern, the tense,
 * the mood and the verb form the method (`HINT_METHODS`), since their school question or the
 * pattern would name the answer; else `null`.
 */
export function classHint(dimension: Dimension, target: ClassTarget): Hint | null {
  if (dimension === 'gender' || dimension === 'gender-class') {
    if (target.kind === 'word' && target.word.noun) {
      return {
        kind: 'ten-ta-to',
        gender: genderClass(target.word.noun.gender, target.word.noun.animate ?? null),
      };
    }
    if (target.kind === 'token' && target.token.gender !== undefined) {
      return { kind: 'ten-ta-to', gender: target.token.gender };
    }
    return null;
  }
  if ((HINT_METHODS as readonly string[]).includes(dimension)) {
    return { kind: 'method', method: dimension as HintMethod };
  }
  return null;
}
