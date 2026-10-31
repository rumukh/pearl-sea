/**
 * Closed linguistic vocabularies: the grammar the game teaches, as data the rules, the lexicon,
 * the generators and the shell share. Each list is implemented in code (generators, distractors,
 * checks), so adding a value is a code change and a contract change (docs/contract.md §4).
 *
 * IDs are ASCII and stable; Czech names and school questions live in the catalogs under the keys
 * `grammar.<vocabulary>.<id>` (docs/contract.md §7.4). The school terms are those of Czech primary
 * school textbooks for the 3rd and 4th grade (docs/curriculum.md).
 *
 * Everything here is deterministic: no locale functions. `compareCzech` implements Czech
 * alphabetical order (ch after h; č ř š ž separate letters; other diacritics only break ties).
 */

// ---------------------------------------------------------------------------------------------
// Letters and sounds

/** The Czech alphabet in school order: 42 letters, the digraph ch after h. */
export const ALPHABET = [
  'a',
  'á',
  'b',
  'c',
  'č',
  'd',
  'ď',
  'e',
  'é',
  'ě',
  'f',
  'g',
  'h',
  'ch',
  'i',
  'í',
  'j',
  'k',
  'l',
  'm',
  'n',
  'ň',
  'o',
  'ó',
  'p',
  'q',
  'r',
  'ř',
  's',
  'š',
  't',
  'ť',
  'u',
  'ú',
  'ů',
  'v',
  'w',
  'x',
  'y',
  'ý',
  'z',
  'ž',
] as const;
export type Letter = (typeof ALPHABET)[number];

/**
 * Letters that sort as their own letter (primary order). Every other diacritic letter sorts with
 * its base letter and only breaks ties: á with a, ď with d, é and ě with e, í with i, ň with n,
 * ó with o, ť with t, ú and ů with u, ý with y.
 */
const PRIMARY: Readonly<Record<string, string>> = {
  á: 'a',
  ď: 'd',
  é: 'e',
  ě: 'e',
  í: 'i',
  ň: 'n',
  ó: 'o',
  ť: 't',
  ú: 'u',
  ů: 'u',
  ý: 'y',
};

/** Primary letters in order: the 42 letters without those folded into their base letter. */
const PRIMARY_ORDER: readonly string[] = ALPHABET.filter((letter) => !(letter in PRIMARY));

/** Split a word into Czech letters (ch is one letter; c followed by h). Lower-cases first. */
export function czechLetters(word: string): string[] {
  const lower = word.toLowerCase();
  const letters: string[] = [];
  for (let index = 0; index < lower.length; index++) {
    const char = lower[index]!;
    if (char === 'c' && lower[index + 1] === 'h') {
      letters.push('ch');
      index++;
    } else letters.push(char);
  }
  return letters;
}

function rank(list: readonly string[], letter: string): number {
  const at = list.indexOf(letter);
  // Characters outside the alphabet (spaces, hyphens, digits) sort before letters, by code unit.
  return at === -1 ? -1000 + (letter.codePointAt(0) ?? 0) / 1_000_000 : at;
}

/**
 * Czech alphabetical order (as in a school dictionary): compare by primary letters (ch after h;
 * č ř š ž after c r s z), then by the full letters (a before á, e before é before ě, u before ú
 * before ů), then lower case before upper case. Returns negative, zero or positive.
 */
export function compareCzech(left: string, right: string): number {
  const a = czechLetters(left);
  const b = czechLetters(right);
  const levels: ((letter: string) => number)[] = [
    (letter) => rank(PRIMARY_ORDER, PRIMARY[letter] ?? letter),
    (letter) => rank(ALPHABET, letter),
  ];
  for (const key of levels) {
    for (let index = 0; index < a.length && index < b.length; index++) {
      const difference = key(a[index]!) - key(b[index]!);
      if (difference !== 0) return difference;
    }
    if (a.length !== b.length) return a.length - b.length;
  }
  for (let index = 0; index < left.length && index < right.length; index++) {
    const l = left[index]!;
    const r = right[index]!;
    if (l !== r) {
      const lUpper = l !== l.toLowerCase();
      const rUpper = r !== r.toLowerCase();
      if (lUpper !== rUpper) return lUpper ? 1 : -1;
      return l < r ? -1 : 1;
    }
  }
  return left.length - right.length;
}

/** Short and long vowels (samohlásky krátké a dlouhé), pairwise: a/á, e/é, i/í, o/ó, u/ú+ů, y/ý. */
export const SHORT_VOWELS = ['a', 'e', 'i', 'o', 'u', 'y'] as const;
export const LONG_VOWELS = ['á', 'é', 'í', 'ó', 'ú', 'ů', 'ý'] as const;
export type Vowel = (typeof SHORT_VOWELS)[number] | (typeof LONG_VOWELS)[number];

/** The school consonant classes that decide i or y (tvrdé, měkké, obojetné souhlásky). */
export const CONSONANT_CLASSES = ['hard', 'soft', 'both-way'] as const;
export type ConsonantClass = (typeof CONSONANT_CLASSES)[number];

/** Hard consonants (tvrdé): y/ý after them in native words. */
export const HARD_CONSONANTS = ['h', 'ch', 'k', 'r', 'd', 't', 'n'] as const;
/** Soft consonants (měkké): i/í after them. */
export const SOFT_CONSONANTS = ['ž', 'š', 'č', 'ř', 'c', 'j', 'ď', 'ť', 'ň'] as const;
/** Both-way consonants (obojetné): i or y, decided by the listed words (vyjmenovaná slova). */
export const BOTH_WAY_CONSONANTS = ['b', 'f', 'l', 'm', 'p', 's', 'v', 'z'] as const;

/** The letters after which the listed words (vyjmenovaná slova) are taught, in school order. */
export const LISTED_LETTERS = ['b', 'l', 'm', 'p', 's', 'v', 'z'] as const;
export type ListedLetter = (typeof LISTED_LETTERS)[number];

/** Paired consonants (párové souhlásky): voiced/voiceless pairs, checked by a test word. */
export const PAIRED_CONSONANTS = [
  ['b', 'p'],
  ['d', 't'],
  ['ď', 'ť'],
  ['z', 's'],
  ['ž', 'š'],
  ['v', 'f'],
  ['h', 'ch'],
  ['g', 'k'],
] as const;

// ---------------------------------------------------------------------------------------------
// Words

/** The ten parts of speech (slovní druhy) in school order; the first five inflect (ohebné). */
export const PARTS_OF_SPEECH = [
  'noun',
  'adj',
  'pron',
  'num',
  'verb',
  'adv',
  'prep',
  'conj',
  'part',
  'interj',
] as const;
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];
/** The school number of a part of speech (1 = podstatná jména … 10 = citoslovce). */
export function partOfSpeechNumber(pos: PartOfSpeech): number {
  return PARTS_OF_SPEECH.indexOf(pos) + 1;
}
export const INFLECTED_PARTS_OF_SPEECH = ['noun', 'adj', 'pron', 'num', 'verb'] as const;
export function isInflected(pos: PartOfSpeech): boolean {
  return (INFLECTED_PARTS_OF_SPEECH as readonly string[]).includes(pos);
}
/** Inflected (ohebné) or uninflected (neohebné). */
export const INFLECTION = ['inflected', 'uninflected'] as const;
export type Inflection = (typeof INFLECTION)[number];

/** Words sorted by generalised meaning (ČJL-3-2-03): děj, věc, okolnost, vlastnost. */
export const MEANING_CLASSES = ['action', 'thing', 'circumstance', 'property'] as const;
export type MeaningClass = (typeof MEANING_CLASSES)[number];

/** Grammatical gender of a noun (rod). Masculine nouns also carry animacy (životnost). */
export const GENDERS = ['m', 'f', 'n'] as const;
export type Gender = (typeof GENDERS)[number];
/** Gender with animacy, as asked in school: mužský životný, mužský neživotný, ženský, střední. */
export const GENDER_CLASSES = ['ma', 'mi', 'f', 'n'] as const;
export type GenderClass = (typeof GENDER_CLASSES)[number];
export function genderClass(gender: Gender, animate: boolean | null): GenderClass {
  return gender === 'm' ? (animate ? 'ma' : 'mi') : gender;
}

/** Grammatical number (číslo). */
export const NUMBERS = ['sg', 'pl'] as const;
export type GrammaticalNumber = (typeof NUMBERS)[number];
/** Which numbers a noun has: both, singular only, plural only (pomnožná). */
export const NOUN_NUMBERS = ['both', 'sg', 'pl'] as const;
export type NounNumbers = (typeof NOUN_NUMBERS)[number];

/** The seven cases (pády), 1..7. Their school questions are in the catalogs. */
export const CASES = [1, 2, 3, 4, 5, 6, 7] as const;
export type Case = (typeof CASES)[number];
/**
 * The school case questions (pádové otázky), for the catalogs and the verbalizer. The 5th case
 * is not asked with a question: one addresses or calls (oslovujeme, voláme).
 */
export const CASE_QUESTIONS: Readonly<Record<Case, string>> = {
  1: 'kdo? co?',
  2: 'koho? čeho?',
  3: 'komu? čemu?',
  4: 'koho? co?',
  5: 'oslovujeme, voláme',
  6: 'o kom? o čem?',
  7: 's kým? s čím?',
};

/**
 * The 14 noun patterns (vzory) with their gender. IDs are ASCII; the Czech pattern words are
 * `pán, hrad, muž, stroj, předseda, soudce, žena, růže, píseň, kost, město, moře, kuře, stavení`.
 */
export const NOUN_PATTERNS = [
  'pan',
  'hrad',
  'muz',
  'stroj',
  'predseda',
  'soudce',
  'zena',
  'ruze',
  'pisen',
  'kost',
  'mesto',
  'more',
  'kure',
  'staveni',
] as const;
export type NounPattern = (typeof NOUN_PATTERNS)[number];
export const PATTERN_GENDER: Readonly<Record<NounPattern, GenderClass>> = {
  pan: 'ma',
  hrad: 'mi',
  muz: 'ma',
  stroj: 'mi',
  predseda: 'ma',
  soudce: 'ma',
  zena: 'f',
  ruze: 'f',
  pisen: 'f',
  kost: 'f',
  mesto: 'n',
  more: 'n',
  kure: 'n',
  staveni: 'n',
};
/** The Czech pattern word of each pattern (as printed in textbooks). */
export const PATTERN_WORD: Readonly<Record<NounPattern, string>> = {
  pan: 'pán',
  hrad: 'hrad',
  muz: 'muž',
  stroj: 'stroj',
  predseda: 'předseda',
  soudce: 'soudce',
  zena: 'žena',
  ruze: 'růže',
  pisen: 'píseň',
  kost: 'kost',
  mesto: 'město',
  more: 'moře',
  kure: 'kuře',
  staveni: 'stavení',
};
/** Hard patterns take y in the endings that teach it (s pány × s muži, hrady × stroje). */
export const HARD_PATTERNS = ['pan', 'hrad', 'zena', 'mesto'] as const;

/** Person (osoba) of a verb form. */
export const PERSONS = [1, 2, 3] as const;
export type Person = (typeof PERSONS)[number];

/** Tense (čas): minulý, přítomný, budoucí. */
export const TENSES = ['past', 'present', 'future'] as const;
export type Tense = (typeof TENSES)[number];

/** Mood (způsob): oznamovací, rozkazovací, podmiňovací. */
export const MOODS = ['indicative', 'imperative', 'conditional'] as const;
export type Mood = (typeof MOODS)[number];

/** Aspect (vid): nedokonavý, dokonavý. A perfective verb's present forms express the future. */
export const ASPECTS = ['impf', 'pf'] as const;
export type Aspect = (typeof ASPECTS)[number];

/** Simple or compound verb form (tvar jednoduchý, složený): píše × psal jsem, bude psát. */
export const VERB_FORMS = ['simple', 'compound'] as const;
export type VerbForm = (typeof VERB_FORMS)[number];

/** The reflexive pronoun of a reflexive verb (zvratné sloveso), or none. */
export const REFLEXIVES = ['se', 'si'] as const;
export type Reflexive = (typeof REFLEXIVES)[number];

/** Finite verb form or infinitive (určitý tvar, neurčitý tvar). */
export const VERB_FINITENESS = ['finite', 'infinitive'] as const;
export type VerbFiniteness = (typeof VERB_FINITENESS)[number];

/** Keys of the l-participle in a verb paradigm: sg m, f, n; pl masculine animate and inanimate,
 * feminine, neuter. It carries the subject-predicate agreement (shoda). */
export const PAST_KEYS = ['m', 'f', 'n', 'ma', 'mi', 'fpl', 'npl'] as const;
export type PastKey = (typeof PAST_KEYS)[number];

/** Standard or colloquial Czech (spisovná, nespisovná čeština). */
export const REGISTERS = ['standard', 'colloquial'] as const;
export type Register = (typeof REGISTERS)[number];

/** Kinds of proper names (velká písmena). */
export const PROPER_KINDS = [
  'person',
  'animal',
  'town',
  'river',
  'mountain',
  'country',
  'sea',
  'character',
] as const;
export type ProperKind = (typeof PROPER_KINDS)[number];

/** Parts of a word (stavba slova): předpona, kořen, přípona, koncovka. */
export const SEGMENT_ROLES = ['prefix', 'root', 'suffix', 'ending'] as const;
export type SegmentRole = (typeof SEGMENT_ROLES)[number];

/** Word relations taught in the 3rd grade (význam slov). */
export const WORD_RELATIONS = [
  'synonym',
  'antonym',
  'general',
  'specific',
  'coordinate',
  'sound-alike',
  'related',
] as const;
export type WordRelation = (typeof WORD_RELATIONS)[number];

// ---------------------------------------------------------------------------------------------
// Spelling

/**
 * Spelling rules: why a letter is written as it is. Every spelling point of the lexicon names
 * one; hints show the rule's strategy (docs/design.md §5.3), distractors and item IDs build on it.
 */
export const SPELLING_RULES = [
  // i/y
  'vyjm', // in a listed word or a word related to it (by → být, bydlet)
  'vyjm-prefix', // the prefix vy-/vý- (vyletět, výlet)
  'obojetna-i', // i after a both-way consonant in a word that is not listed (bílý, pivo)
  'tvrda', // y after a hard consonant (hýl, kytka)
  'mekka', // i after a soft consonant (čížek, šipka)
  'dtn-mekke', // di, ti, ni pronounced soft (dítě, ticho, nikdo)
  // ě
  'de-te-ne', // dě, tě, ně (děti, tělo, něco)
  'be-pe-ve-me', // bě, pě, vě, mě inside a word (oběd, pěna, věda, město)
  'bje-vje', // bje, vje at a prefix seam (objet, vjezd)
  'mne', // mně inside a word (zapomněl) against mě
  'mne-zajmeno', // the pronoun mně (3rd and 6th case) or mě (2nd and 4th case)
  // ú/ů
  'u-zacatek', // ú at the start of a word (úkol)
  'u-predpona', // ú after a prefix (neúplný, bezúčelný)
  'u-uprostred', // ů inside or at the end of a word (dům, domů)
  'u-prejate', // ú in borrowed words and interjections (múza, vrkú)
  // other
  'delka', // short or long vowel (pila × píla)
  'parova', // a paired consonant checked by a test word (hrad → hrady)
  'velke-pismeno', // a capital letter: start of a sentence or a proper name
  'predpona-predlozka', // prefix written together, preposition apart (odplavala × od mola)
  'predpona-souhlaska', // the consonant at a prefix seam (odtáhnout, rozzlobit)
  'shoda', // subject-predicate agreement in the past tense (psi štěkali, kočky mňoukaly)
  'vzor', // an ending decided by the noun pattern (o hradech, se stroji)
  // sentences
  'interpunkce', // the end mark by the kind of sentence (. ? !), a comma between clauses
  'spojka', // the conjunction that joins clauses (a, ale, protože, když)
  // register
  'spisovne', // the standard word in a sentence, not its colloquial twin (mléko, not mlíko)
] as const;
export type SpellingRule = (typeof SPELLING_RULES)[number];

// ---------------------------------------------------------------------------------------------
// Sentences

/** Kinds of sentence by the speaker's attitude (druhy vět, ČJL-3-2-07). */
export const SENTENCE_KINDS = ['statement', 'question', 'command', 'wish'] as const;
export type SentenceKind = (typeof SENTENCE_KINDS)[number];

/** Simple sentence or compound sentence (věta jednoduchá, souvětí). */
export const CLAUSE_STRUCTURES = ['simple', 'compound'] as const;
export type ClauseStructure = (typeof CLAUSE_STRUCTURES)[number];

/** The basic sentence members taught (základní skladební dvojice). */
export const SENTENCE_MEMBERS = ['subject', 'predicate', 'other'] as const;
export type SentenceMember = (typeof SENTENCE_MEMBERS)[number];
