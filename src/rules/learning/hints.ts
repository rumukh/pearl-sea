/**
 * Hints show the strategy, not just the answer (design §5.3, contract §5.3):
 *
 * - `vyjm`: the family word (mlynář → mlýn), or for a rhyme word its letter's school rhyme;
 * - `obojetna-i`: the rule line (not listed, so i), never the rhyme of y-words, which may hold a
 *   look-alike (být for bít);
 * - `parova`, `u-uprostred`: the test word (hrad → hrady, dům → domy), when the point has one;
 * - `mne-zajmeno`: the case question; `shoda`: the subject with ten, ta, to; `vzor`: the pattern;
 * - every other rule: the rule in one line;
 * - classifications: the school question (ten, ta, to; the case question; the pattern).
 */
import type { DeepReadonly } from '@aegis/runtime';
import { genderClass } from '../contract';
import type {
  Case,
  Dimension,
  Hint,
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
    case 'obojetna-i':
      // Not the listed rhyme: it lists only y-words, so for an i it points the wrong way, and a
      // look-alike in it (být for bít, mlýn for mlít) confirms the slip. The rule line states the
      // step: not listed (nor related to a listed word), so i.
      return ruleHint(rule);
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
      const subject = sentence?.gap.subjects?.[0];
      const gender =
        subject === undefined ? undefined : sentence?.parsed.sentence.tokens?.[subject]?.gender;
      return gender !== undefined ? { kind: 'ten-ta-to', gender } : ruleHint(rule);
    }
    case 'vzor': {
      const pattern = word?.noun?.pattern;
      return pattern ? { kind: 'pattern', pattern } : ruleHint(rule);
    }
    default:
      return ruleHint(rule);
  }
}

/** The hint of a classification: the school question of its dimension, or `null`. */
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
  if (dimension === 'case' && 'value' in target) {
    return { kind: 'case-question', case: Number(target.value) as Case };
  }
  if (dimension === 'pattern' && target.kind === 'word' && target.word.noun?.pattern) {
    return { kind: 'pattern', pattern: target.word.noun.pattern };
  }
  return null;
}
