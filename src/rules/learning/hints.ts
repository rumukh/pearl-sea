/**
 * Hints show the strategy, not just the answer (design §5.3, contract §5.3), and never the asked
 * word, a revealing form of it or a member of its family: a hint that teaches by example takes the
 * example from another family of the same rule (`hint-examples.ts`), else it is the rule line alone.
 *
 * - `vyjm`: for a related word, finding its listed word on another family (mlynář → mlýn); for a
 *   listed word itself the rule line alone (its rhyme would list the word);
 * - `obojetna-i`: after a listed letter, that the word is not listed, shown with its gap (b_lý),
 *   unless the other letter makes another word (b_t: být; nab_t: nabýt; v_sela: vysela); never
 *   the rhyme of y-words, which may hold a look-alike (být for bít); else the rule line with a
 *   sound-alike pair of other families;
 * - `parova`, `u-uprostred`: saying another form, on another word of the rule (hrad → hrady,
 *   dům → domy);
 * - `mne-zajmeno`: the case question; `shoda`: the subject's test, ti, ty, ta for a plural one,
 *   the rule line for several subjects; `vzor`: the pattern;
 * - every other rule: the rule in one line, with up to two examples of other families;
 * - classifications: ten, ta, to for the gender; the method of the case, the pattern, the tense,
 *   the mood and the verb form (never the case question or the pattern, which are the answer);
 * - an odd-one-out set on the listed basis: finding the related listed word, on a family none of
 *   the set's words belongs to (never the rhyme, which names the set's listed words).
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
import { familyExample, hintContext, ruleExamples, testWordExample } from './hint-examples';
import { lexiconIndex, writtenForms } from './index-cache';
import { gapToken } from './item-info';
import type { ClassTarget } from './item-info';
import type { ParsedSentence } from './index-cache';
import type { Data } from '../types';

type Read<T> = DeepReadonly<T>;

const ruleHint = (rule: SpellingRule): Hint => ({ kind: 'rule', rule });

/** The word's lemma with the point's letters replaced by `text`. */
function respelled(word: Read<Word>, point: Read<SpellingPoint>, text: string): string {
  const letters = codePoints(word.lemma);
  const end = point.at + codePoints(point.correct).length;
  return [...letters.slice(0, point.at), text, ...letters.slice(end)].join('');
}

/**
 * Whether the word, with one of its point's alternatives in the gap, is another word or form of
 * the lexicon (bít → být, vír → výr): shown with its gap, b_t would be a listed word too.
 */
function spellsAnother(data: Data, word: Read<Word>, point: Read<SpellingPoint>): boolean {
  const spellings = lexiconIndex(data).spellings;
  return point.alt.some((alt) => {
    const other = respelled(word, point, alt);
    return other !== word.lemma && spellings.has(other);
  });
}

/**
 * Whether the word, with one of its point's alternatives in the gap, ends like the head of its
 * family's sound-alike family (nabít → nabýt, from být), a word the lexicon may lack: prefixed
 * verbs from být and bít are told apart by their meaning (IJP), not by the list.
 */
function soundsLikeAlike(data: Data, word: Read<Word>, point: Read<SpellingPoint>): boolean {
  const lexicon = lexiconIndex(data);
  const family = word.family ? lexicon.families.get(word.family.id) : undefined;
  const alike = family?.soundAlike ? lexicon.families.get(family.soundAlike) : undefined;
  const head = alike ? lexicon.words.get(alike.head)?.lemma.toLowerCase() : undefined;
  return (
    head !== undefined &&
    point.alt.some((alt) => respelled(word, point, alt).toLowerCase().endsWith(head))
  );
}

/**
 * Whether the sentence's word at the gap, with one of the gap's alternatives, is another word's
 * spelling (v_sela: visela of viset, vysela of vysít): naming the lemma would give the answer.
 */
function tokenSpellsAnother(
  data: Data,
  sentence: { parsed: ParsedSentence; gap: Read<SentenceGap> },
  word: Read<Word>,
): boolean {
  const index = sentence.parsed.sentence.gaps.indexOf(sentence.gap);
  const gap = index === -1 ? undefined : sentence.parsed.parsed.gaps[index];
  if (gap === undefined) return false;
  const spellings = lexiconIndex(data).spellings;
  const own = new Set(writtenForms(word).map((form) => form.toLowerCase()));
  return gap.alternatives.some((alt) => {
    const token = gapToken(sentence.parsed, index, alt);
    const lower = token.toLowerCase();
    return !own.has(lower) && (spellings.has(token) || spellings.has(lower));
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
  const index = sentence ? sentence.parsed.sentence.gaps.indexOf(sentence.gap) : -1;
  const context = hintContext(
    word,
    point,
    sentence && index !== -1 ? { parsed: sentence.parsed, gap: index } : null,
  );
  /** The rule line, with examples of the rule from other families where any is safe. */
  const ruleLine = (): Hint => {
    const examples = ruleExamples(data, context, rule);
    return examples.length > 0 ? { kind: 'rule', rule, examples } : ruleHint(rule);
  };
  switch (rule) {
    case 'vyjm': {
      // A related word: how to find its listed word, on another family (mlynář → mlýn). A listed
      // word itself (or one of no family): the rule line alone, since its rhyme lists the word.
      const family = word?.family ? lexicon.families.get(word.family.id) : undefined;
      if (word && family && family.letter !== null && family.head !== word.id) {
        const example = familyExample(data, context);
        if (example) return { kind: 'family', ...example };
      }
      return ruleHint(rule);
    }
    case 'obojetna-i': {
      // Not the listed rhyme: it lists only y-words, so for an i it points the wrong way, and a
      // look-alike in it (být for bít, mlýn for mlít) confirms the slip. After a listed letter the
      // hint says the word is not listed, shown with its gap; elsewhere the rule line, which tells
      // sound-alikes apart by their meaning, and so wherever the other letter makes another word:
      // the gap's word (b_t: být), a word of its sound-alike family (nab_t: nabýt, from být), or
      // in a sentence the word as written there (v_sela: vysela, from vysít).
      const letters = word ? codePoints(word.lemma.toLowerCase()) : [];
      const before = point && point.at > 0 ? letters[point.at - 1] : undefined;
      if (
        word &&
        point &&
        before !== undefined &&
        (LISTED_LETTERS as readonly string[]).includes(before) &&
        !spellsAnother(data, word, point) &&
        !soundsLikeAlike(data, word, point) &&
        !(sentence && tokenSpellsAnother(data, sentence, word))
      ) {
        return {
          kind: 'not-listed',
          word: word.id,
          span: [point.at, point.at + codePoints(point.correct).length],
        };
      }
      return ruleLine();
    }
    case 'parova':
    case 'u-uprostred': {
      // Say another form, shown on another word of the rule (hrad → hrady), never the asked one.
      const example = testWordExample(data, context, rule);
      return example ? { kind: 'test-word', ...example } : ruleHint(rule);
    }
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
      return ruleLine();
  }
}

/**
 * The hint of an odd-one-out set on the listed basis, drawn for `word` among `shown`: how to find
 * a word's listed word, on a related word of a family none of the set's words is close to
 * (mlynář → mlýn), another letter's first; else the rule line. Never the rhyme of the set's
 * letter: it names the set's listed words, so the odd one would be found by elimination.
 */
export function oddListedHint(data: Data, word: Read<Word>, shown: readonly Read<Word>[]): Hint {
  const example = familyExample(data, hintContext(word, null, null, shown));
  return example ? { kind: 'family', ...example } : ruleHint('vyjm');
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
