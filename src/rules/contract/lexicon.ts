/**
 * The lexicon: the curated, annotated Czech word data the game teaches from (S3 owns the data).
 * It is part of the content pack (`data.lexicon`, content.ts) and holds:
 *
 * - **words**: lemmas with part of speech, grade, topics, sources, noun or verb grammar with full
 *   paradigms, register, word family, segmentation (stavba slova) and spelling points;
 * - **families**: word families, the listed-word families (vyjmenovaná slova) among them, with
 *   the school rhyme order and the families that share a root (`kin`, never each other's
 *   distractors);
 * - **sentences**: short original sentences (at most 10 words) with inline gaps
 *   `{correct|alt|alt2}`, each gap annotated with its spelling rule and word, and optional
 *   per-token grammar and sentence structure;
 * - **relations**: synonyms, antonyms, general and specific words, sound-alike pairs;
 * - **sources**: the reference works the data was checked against.
 *
 * Word IDs are deterministic ASCII transliterations of the lemma (`lexiconId`): long vowels
 * doubled, ů as `uo`, háček letters with `x` (být → `byyt`, byt → `byt`, bít → `biit`, mlýn →
 * `mlyyn`), plus `.<sense>` for homographs. The minimal pairs the game teaches stay distinct.
 *
 * `validateLexicon` checks the data's linguistic consistency (docs/contract.md §8.7): segments
 * rebuild the word, a noun's pattern fits its gender, every listed-word family word has y or ý
 * after its letter, spelling points point at the letters they name, sentence gaps parse and
 * match their annotations, and no word appears twice under different spellings unless the two
 * are declared sound-alikes. `formCells` derives a noun's or verb's forms (cases, persons,
 * tenses, moods, composed forms) from its paradigm for analysis problems.
 */
import { schema } from '@aegis/runtime';
import type { DeepReadonly, Schema } from '@aegis/runtime';
import { CONTENT_ID_MAX_LENGTH, CONTENT_ID_PATTERN } from './ids';
import {
  ASPECTS,
  GENDER_CLASSES,
  GENDERS,
  LISTED_LETTERS,
  MOODS,
  NOUN_NUMBERS,
  NOUN_PATTERNS,
  NUMBERS,
  PARTS_OF_SPEECH,
  PAST_KEYS,
  PATTERN_GENDER,
  PROPER_KINDS,
  REFLEXIVES,
  REGISTERS,
  SEGMENT_ROLES,
  SENTENCE_KINDS,
  SENTENCE_MEMBERS,
  SPELLING_RULES,
  TENSES,
  genderClass,
} from './language';
import type {
  Aspect,
  Case,
  Gender,
  GenderClass,
  GrammaticalNumber,
  ListedLetter,
  Mood,
  NounNumbers,
  NounPattern,
  PartOfSpeech,
  PastKey,
  Person,
  ProperKind,
  Reflexive,
  Register,
  SegmentRole,
  SentenceKind,
  SentenceMember,
  SpellingRule,
  Tense,
} from './language';
import type { Grade } from './kinds';
import {
  contentId,
  gradeSchema,
  int,
  nullable,
  objectWithOptional,
  oneOf,
  refine,
  uniqueArray,
} from './schema';

type Read<T> = DeepReadonly<T>;

/** Longest sentence the game shows a child, in words. */
export const MAX_SENTENCE_WORDS = 10;
/** Most gaps in one sentence (Inkoustová věta: 1-3 ink blots). */
export const MAX_SENTENCE_GAPS = 3;

// ---------------------------------------------------------------------------------------------
// Records

/** One paradigm cell: a form, or variants with the preferred form first. */
export type Cell = string | string[];

/** A noun's forms: seven cases per number it has (index 0 = 1st case). */
export interface NounParadigm {
  sg?: Cell[];
  pl?: Cell[];
}

export interface NounData {
  gender: Gender;
  /** Masculine nouns only: životný (true) or neživotný (false). */
  animate?: boolean;
  numbers: NounNumbers;
  /** The pattern (vzor), or `null` for an irregular noun (dítě, člověk, oko). */
  pattern: NounPattern | null;
  paradigm: NounParadigm;
  /** A proper name (velké písmeno) and what it names. */
  proper?: ProperKind;
}

/**
 * A verb's forms, without the reflexive pronoun (the lemma has it: `bát se`, infinitive `bát`):
 * infinitive; present (perfective verbs: future) 1sg 2sg 3sg 1pl 2pl 3pl; imperative 2sg, 1pl,
 * 2pl; the l-participle by gender and number (`PAST_KEYS`). The compound past, the future of an
 * imperfective verb (budu + infinitive) and the conditional are composed by rule (`formCells`).
 * An imperfective verb whose future is not composed (jít → půjdu, být → budu) lists it in `fut`.
 */
export interface VerbParadigm {
  inf: Cell;
  pres: Cell[];
  imp: Cell[];
  past: Record<PastKey, Cell>;
  fut?: Cell[];
}

export interface VerbData {
  aspect: Aspect;
  reflexive: Reflexive | null;
  paradigm: VerbParadigm;
}

/** A word's place in a family: the family's head word or a related word. */
export interface FamilyMembership {
  id: string;
  role: 'head' | 'related';
}

/** One part of a word's structure: `['prefix', 'vy']`, `['root', 'byd']`, `['ending', '']`. */
export type Segment = [SegmentRole, string];

/**
 * A spelling point: the letters at `at` (index in the lemma, counting code points of the NFC
 * text) are written `correct`, not one of `alt`, because of `rule`; `test` is the word that
 * proves it (hrad → hrady, mlýn → mlynář).
 */
export interface SpellingPoint {
  at: number;
  correct: string;
  alt: string[];
  rule: SpellingRule;
  test?: string;
}

export interface Word {
  id: string;
  /** NFC; proper names capitalised. */
  lemma: string;
  pos: PartOfSpeech;
  grade: Grade;
  topics: string[];
  tags: string[];
  /** Source IDs (`lexicon.sources`). */
  src: string[];
  noun?: NounData;
  verb?: VerbData;
  register?: Register;
  /** A colloquial word's standard twin. */
  standard?: string;
  family?: FamilyMembership;
  segments?: Segment[];
  spelling?: SpellingPoint[];
  /** Short Czech glosses of the senses of a word with several meanings. */
  senses?: string[];
}

export interface WordFamily {
  id: string;
  /** The listed-word letter (b l m p s v z), or `null` for an ordinary family. */
  letter: ListedLetter | null;
  /** The head word's ID. */
  head: string;
  /** Position in the school rhyme of its letter (1-based), or `null`. */
  order: number | null;
  /** On the school list (true) or only on the extended list of the rules of spelling. */
  core: boolean;
  /** The shared root, as written (byd, myl, pyt). */
  root: string;
  /** Families that share the root: never each other's distractors. */
  kin: string[];
  /** A sound-alike family taught beside this one (bít ↔ být). */
  soundAlike?: string;
  src: string[];
}

/** The grammar of one word of a sentence, for analysis problems. */
export interface Token {
  /** The token as it appears in the sentence (gaps filled correctly). */
  t: string;
  word?: string;
  pos?: PartOfSpeech;
  case?: Case;
  number?: GrammaticalNumber;
  gender?: GenderClass;
  person?: Person;
  tense?: Tense;
  mood?: Mood;
  member?: SentenceMember;
}

/** The annotation of one inline gap, in text order. */
export interface SentenceGap {
  rule: SpellingRule;
  /** The lexicon word the gap is in, if any. */
  word: string | null;
  /** The `at` of the word's spelling point this gap tests, when the gap tests one. */
  point?: number;
  case?: Case;
  number?: GrammaticalNumber;
  /** Token indices of the subject the gap agrees with (rule `shoda`). */
  subjects?: number[];
}

export interface Sentence {
  id: string;
  grade: Grade;
  topics: string[];
  /** Text with inline gaps `{correct|alt|alt2}` (a gap may cover a whole token). */
  text: string;
  gaps: SentenceGap[];
  tokens?: Token[];
  kind?: SentenceKind;
  /** Token indices of the subject(s) and predicate(s) (základní skladební dvojice). */
  subjects?: number[];
  predicates?: number[];
  /** Number of clauses: 1 = věta jednoduchá, 2 or more = souvětí. */
  clauses?: number;
  /** Token indices of the conjunctions joining the clauses. */
  conjunctions?: number[];
}

/** A general word and its specific words (nadřazené a podřazené; the specific are souřadná). */
export interface Hierarchy {
  general: string;
  specific: string[];
}

/**
 * One side of a sound-alike pair: a word by its lemma (`"byyt"`), or one form of it, written out
 * (`{ "word": "piit", "form": "pil" }` for pyl × pil, `{ "word": "jaa", "form": "mi" }` for
 * my × mi). A form of a noun or verb must be one of its paradigm's forms.
 */
export type SoundRef = string | { word: string; form: string };

export interface Relations {
  synonyms: [string, string][];
  antonyms: [string, string][];
  hierarchies: Hierarchy[];
  soundAlikes: [SoundRef, SoundRef][];
}

export interface LexiconSource {
  id: string;
  title: string;
  url?: string;
}

export interface Lexicon {
  sources: LexiconSource[];
  words: Word[];
  families: WordFamily[];
  sentences: Sentence[];
  relations: Relations;
}

// ---------------------------------------------------------------------------------------------
// IDs

const TRANSLITERATION: Readonly<Record<string, string>> = {
  á: 'aa',
  é: 'ee',
  í: 'ii',
  ó: 'oo',
  ú: 'uu',
  ý: 'yy',
  ů: 'uo',
  č: 'cx',
  ř: 'rx',
  š: 'sx',
  ž: 'zx',
  ě: 'ex',
  ď: 'dx',
  ť: 'tx',
  ň: 'nx',
};

/**
 * The deterministic ASCII ID of a lemma: lower-case; long vowels doubled; ů → `uo`; háček
 * letters + `x`; spaces → `-`. Returns `null` if the lemma has a character outside Czech letters,
 * spaces and hyphens. A homograph adds `.<sense>` (`zámek.1`, `zámek.2`).
 */
export function lexiconId(lemma: string): string | null {
  let id = '';
  for (const char of lemma.normalize('NFC').toLowerCase()) {
    if (char in TRANSLITERATION) id += TRANSLITERATION[char];
    else if (/^[a-z]$/.test(char)) id += char;
    else if (char === ' ' || char === '-') id += '-';
    else return null;
  }
  return id.length > 0 && id.length <= CONTENT_ID_MAX_LENGTH && CONTENT_ID_PATTERN.test(id)
    ? id
    : null;
}

/** Code points of a string (Czech letters in NFC are one code point each; `ch` is two). */
export function codePoints(text: string): string[] {
  return [...text];
}

/** The word a sound-alike reference names. */
export function soundRefWord(ref: Read<SoundRef>): string {
  return typeof ref === 'string' ? ref : ref.word;
}

/** The item target of a sound-alike reference: the word ID, or `<word>:<form ID>` for a form. */
export function soundRefTarget(ref: Read<SoundRef>): string {
  return typeof ref === 'string' ? ref : `${ref.word}:${lexiconId(ref.form) ?? ''}`;
}

// ---------------------------------------------------------------------------------------------
// Gapped text

export interface ParsedGap {
  correct: string;
  alternatives: string[];
}

export type TextPart = { kind: 'text'; text: string } | { kind: 'gap'; gap: number };

export interface GappedText {
  parts: TextPart[];
  gaps: ParsedGap[];
  /** The text with every gap filled correctly. */
  plain: string;
}

/**
 * Parse `{correct|alt|alt2}` gaps. Throws a RangeError for an empty option, a duplicate option,
 * a gap with fewer than two options, nested or unbalanced braces.
 */
export function parseGappedText(text: string): GappedText {
  const parts: TextPart[] = [];
  const gaps: ParsedGap[] = [];
  let plain = '';
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('{', index);
    const close = text.indexOf('}', index);
    if (close !== -1 && (open === -1 || close < open)) throw new RangeError('Unbalanced "}".');
    if (open === -1) {
      parts.push({ kind: 'text', text: text.slice(index) });
      plain += text.slice(index);
      break;
    }
    if (open > index) {
      parts.push({ kind: 'text', text: text.slice(index, open) });
      plain += text.slice(index, open);
    }
    const end = text.indexOf('}', open);
    if (end === -1) throw new RangeError('Unbalanced "{".');
    const body = text.slice(open + 1, end);
    if (body.includes('{')) throw new RangeError('Nested "{".');
    const options = body.split('|');
    if (options.length < 2 || options.some((option) => option.length === 0)) {
      throw new RangeError(`A gap needs a correct option and alternatives: {${body}}.`);
    }
    if (new Set(options).size !== options.length)
      throw new RangeError(`Duplicate option: {${body}}.`);
    parts.push({ kind: 'gap', gap: gaps.length });
    gaps.push({ correct: options[0]!, alternatives: options.slice(1) });
    plain += options[0]!;
    index = end + 1;
  }
  return { parts, gaps, plain };
}

/** The words of a text: runs of letters (with inner hyphens), punctuation and spaces dropped. */
export function textWords(text: string): string[] {
  return text.match(/[\p{L}]+(?:-[\p{L}]+)*/gu) ?? [];
}

// ---------------------------------------------------------------------------------------------
// Forms

/**
 * Imperfective verbs whose future is not budu + infinitive (verbs of motion with po-, být,
 * růst, kvést): such a verb lists its future in `paradigm.fut`, which the lexicon check demands.
 */
export const IRREGULAR_FUTURE_INFINITIVES = [
  'být',
  'jít',
  'jet',
  'letět',
  'běžet',
  'nést',
  'vést',
  'vézt',
  'lézt',
  'téct',
  'růst',
  'kvést',
  'hnát',
  'plout',
] as const;

const FUTURE_AUXILIARY = ['budu', 'budeš', 'bude', 'budeme', 'budete', 'budou'] as const;
const PAST_AUXILIARY = ['jsem', 'jsi', '', 'jsme', 'jste', ''] as const;
const CONDITIONAL_AUXILIARY = ['bych', 'bys', 'by', 'bychom', 'byste', 'by'] as const;
const IMPERATIVE_CELLS = [
  ['imp2', '2', 'sg'],
  ['imp4', '1', 'pl'],
  ['imp5', '2', 'pl'],
] as const;

/**
 * Groups of form cells a skill can choose (`cells` in classify and sort parameters): noun forms
 * by number, and verb forms by kind. A 3rd-grade person question keeps to `pres`, `past`, `fut`.
 */
export const FORM_GROUPS = ['sg', 'pl', 'inf', 'pres', 'fut', 'past', 'imp', 'cond'] as const;
export type FormGroup = (typeof FORM_GROUPS)[number];

/** The group of a form cell (`past1` → `past`, `sg7` → `sg`, `inf` → `inf`). */
export function formGroup(cell: string): FormGroup {
  return cell.replace(/[0-9]+$/, '') as FormGroup;
}

/** The grammar of a form that a `form` classification asks (skills.ts `CONTEXT_DIMENSIONS`). */
export type FormDimension =
  'number' | 'case' | 'person' | 'tense' | 'mood' | 'verb-form' | 'finiteness';
export type FormValues = Partial<Record<FormDimension, string>>;

/**
 * One form of a word, derived from its paradigm:
 *
 * | Cells                 | Form                                                              |
 * | --------------------- | ----------------------------------------------------------------- |
 * | `sg1`…`sg7`, `pl1`…`pl7` | a noun's case forms                                            |
 * | `inf`                 | the infinitive (`plavat`, `bát se`)                               |
 * | `pres1`…`pres6`       | present, 1sg … 3pl (a perfective verb's future)                   |
 * | `fut1`…`fut6`         | an imperfective verb's future: `budu plavat`, or `paradigm.fut`   |
 * | `past1`…`past6`       | past: `plaval jsem`, `plaval jsi`, `plaval`, `plavali jsme`, …    |
 * | `imp2`, `imp4`, `imp5` | imperative 2sg, 1pl, 2pl                                         |
 * | `cond1`…`cond6`       | conditional: `plaval bych`, …, `plavali by`                       |
 *
 * Composed forms use the masculine participle (`m`, `ma`); a generator may show the feminine or
 * neuter participle instead without changing the cell. The reflexive pronoun follows the
 * auxiliary (`myl jsem se`, `budu se mýt`, `myl by se`). `values` holds only what the form shows
 * unambiguously: a form shared by several cells (ryby: sg2, pl1, pl4, pl5; vyletí: 3sg and 3pl)
 * keeps only the values those cells agree on.
 */
export interface FormCell {
  cell: string;
  text: string;
  values: FormValues;
}

/** The forms of a noun or verb (`[]` for other words), in paradigm order. */
export function formCells(word: Read<Word>): FormCell[] {
  const raw: { cell: string; texts: string[]; values: FormValues }[] = [];
  const variants = (value: Read<Cell>): string[] =>
    typeof value === 'string' ? [value] : [...value];
  if (word.noun) {
    for (const number of NUMBERS) {
      (word.noun.paradigm[number] ?? []).forEach((value, index) => {
        raw.push({
          cell: `${number}${index + 1}`,
          texts: variants(value),
          values: { number, case: String(index + 1) },
        });
      });
    }
  }
  if (word.verb) {
    const { aspect, reflexive, paradigm } = word.verb;
    const compose = (...parts: string[]) => parts.filter((part) => part !== '').join(' ');
    const se = reflexive ?? '';
    const infinitive = preferred(paradigm.inf);
    const finite = (index: number): FormValues => ({
      person: String((index % 3) + 1),
      number: index < 3 ? 'sg' : 'pl',
      finiteness: 'finite',
    });
    raw.push({
      cell: 'inf',
      texts: [compose(infinitive, se)],
      values: { finiteness: 'infinitive' },
    });
    paradigm.pres.forEach((value, index) => {
      raw.push({
        cell: `pres${index + 1}`,
        texts: variants(value).map((text) => compose(text, se)),
        values: {
          ...finite(index),
          tense: aspect === 'pf' ? 'future' : 'present',
          mood: 'indicative',
          'verb-form': 'simple',
        },
      });
    });
    if (aspect === 'impf') {
      FUTURE_AUXILIARY.forEach((auxiliary, index) => {
        const listed = paradigm.fut?.[index];
        const text =
          listed === undefined
            ? compose(auxiliary, se, infinitive)
            : compose(preferred(listed), se);
        raw.push({
          cell: `fut${index + 1}`,
          texts: [text],
          values: {
            ...finite(index),
            tense: 'future',
            mood: 'indicative',
            'verb-form':
              listed === undefined || preferred(listed).includes(' ') ? 'compound' : 'simple',
          },
        });
      });
    }
    const participle = (index: number) => preferred(index < 3 ? paradigm.past.m : paradigm.past.ma);
    PAST_AUXILIARY.forEach((auxiliary, index) => {
      raw.push({
        cell: `past${index + 1}`,
        texts: [compose(participle(index), auxiliary, se)],
        values: {
          ...finite(index),
          tense: 'past',
          mood: 'indicative',
          'verb-form': auxiliary === '' ? 'simple' : 'compound',
        },
      });
    });
    IMPERATIVE_CELLS.forEach(([cell, person, number], index) => {
      raw.push({
        cell,
        texts: variants(paradigm.imp[index]!).map((text) => compose(text, se)),
        values: { person, number, finiteness: 'finite', mood: 'imperative', 'verb-form': 'simple' },
      });
    });
    CONDITIONAL_AUXILIARY.forEach((auxiliary, index) => {
      raw.push({
        cell: `cond${index + 1}`,
        texts: [compose(participle(index), auxiliary, se)],
        values: { ...finite(index), mood: 'conditional', 'verb-form': 'compound' },
      });
    });
  }
  const sharing = new Map<string, FormValues[]>();
  for (const entry of raw) {
    for (const text of entry.texts) sharing.set(text, [...(sharing.get(text) ?? []), entry.values]);
  }
  return raw.map((entry) => {
    const text = entry.texts[0]!;
    const others = sharing.get(text)!;
    const values = Object.fromEntries(
      Object.entries(entry.values).filter(([key, value]) =>
        others.every((other) => other[key as FormDimension] === value),
      ),
    ) as FormValues;
    return { cell: entry.cell, text, values };
  });
}

// ---------------------------------------------------------------------------------------------
// Schemas

const ids = uniqueArray(contentId, { max: 64 });
const text = (max: number) => schema.string({ minLength: 1, maxLength: max });
const form = schema.string({ minLength: 1, maxLength: 48 });
const cell: Schema<Cell> = schema.union(form, schema.array(form, { min: 1, max: 4 }));
const sevenCells = schema.array(cell, { min: 7, max: 7 });
const topic = schema.string({ minLength: 1, maxLength: 48, pattern: CONTENT_ID_PATTERN });

const nounSchema: Schema<NounData> = objectWithOptional(
  {
    gender: oneOf(GENDERS),
    numbers: oneOf(NOUN_NUMBERS),
    pattern: nullable(oneOf(NOUN_PATTERNS)),
    paradigm: objectWithOptional({}, { sg: sevenCells, pl: sevenCells }),
  },
  { animate: schema.boolean, proper: oneOf(PROPER_KINDS) },
);

const verbSchema: Schema<VerbData> = schema.object({
  aspect: oneOf(ASPECTS),
  reflexive: nullable(oneOf(REFLEXIVES)),
  paradigm: objectWithOptional(
    {
      inf: cell,
      pres: schema.array(cell, { min: 6, max: 6 }),
      imp: schema.array(cell, { min: 3, max: 3 }),
      past: schema.object(
        Object.fromEntries(PAST_KEYS.map((key) => [key, cell])) as Record<PastKey, Schema<Cell>>,
      ),
    },
    { fut: schema.array(cell, { min: 6, max: 6 }) },
  ),
});

const segmentSchema: Schema<Segment> = refine(
  schema.array(schema.string({ maxLength: 32 }), { min: 2, max: 2 }),
  ([role]) => ((SEGMENT_ROLES as readonly string[]).includes(role!) ? null : 'Unknown role.'),
) as unknown as Schema<Segment>;

const spellingPointSchema: Schema<SpellingPoint> = objectWithOptional(
  {
    at: int(0, 63),
    correct: schema.string({ minLength: 1, maxLength: 16 }),
    alt: schema.array(schema.string({ minLength: 1, maxLength: 16 }), { min: 1, max: 6 }),
    rule: oneOf(SPELLING_RULES),
  },
  { test: form },
);

export const wordSchema: Schema<Word> = objectWithOptional(
  {
    id: contentId,
    lemma: form,
    pos: oneOf(PARTS_OF_SPEECH),
    grade: gradeSchema,
    topics: uniqueArray(topic, { max: 16 }),
    tags: uniqueArray(topic, { max: 16 }),
    src: ids,
  },
  {
    noun: nounSchema,
    verb: verbSchema,
    register: oneOf(REGISTERS),
    standard: contentId,
    family: schema.object({ id: contentId, role: oneOf(['head', 'related'] as const) }),
    segments: schema.array(segmentSchema, { min: 1, max: 8 }),
    spelling: schema.array(spellingPointSchema, { max: 8 }),
    senses: schema.array(text(80), { min: 2, max: 6 }),
  },
);

export const familySchema: Schema<WordFamily> = objectWithOptional(
  {
    id: contentId,
    letter: nullable(oneOf(LISTED_LETTERS)),
    head: contentId,
    order: nullable(int(1, 40)),
    core: schema.boolean,
    root: schema.string({ minLength: 1, maxLength: 16 }),
    kin: ids,
    src: ids,
  },
  { soundAlike: contentId },
);

const caseSchema = int(1, 7) as Schema<Case>;
const tokenIndices = uniqueArray(int(0, 31), { min: 1, max: 8 });

const tokenSchema: Schema<Token> = objectWithOptional(
  { t: form },
  {
    word: contentId,
    pos: oneOf(PARTS_OF_SPEECH),
    case: caseSchema,
    number: oneOf(NUMBERS),
    gender: oneOf(GENDER_CLASSES),
    person: int(1, 3) as Schema<Person>,
    tense: oneOf(TENSES),
    mood: oneOf(MOODS),
    member: oneOf(SENTENCE_MEMBERS),
  },
);

export const sentenceSchema: Schema<Sentence> = objectWithOptional(
  {
    id: contentId,
    grade: gradeSchema,
    topics: uniqueArray(topic, { max: 16 }),
    text: text(240),
    gaps: schema.array(
      objectWithOptional(
        { rule: oneOf(SPELLING_RULES), word: nullable(contentId) },
        { point: int(0, 63), case: caseSchema, number: oneOf(NUMBERS), subjects: tokenIndices },
      ),
      { max: MAX_SENTENCE_GAPS },
    ),
  },
  {
    tokens: schema.array(tokenSchema, { min: 1, max: 32 }),
    kind: oneOf(SENTENCE_KINDS),
    subjects: tokenIndices,
    predicates: tokenIndices,
    clauses: int(1, 4),
    conjunctions: tokenIndices,
  },
);

const pair = schema.array(contentId, { min: 2, max: 2 }) as unknown as Schema<[string, string]>;
const soundRef: Schema<SoundRef> = schema.union(
  contentId,
  schema.object({ word: contentId, form: form }),
);
const soundPair = schema.array(soundRef, { min: 2, max: 2 }) as unknown as Schema<
  [SoundRef, SoundRef]
>;

export const lexiconSchema: Schema<Lexicon> = schema.object({
  sources: schema.array(
    objectWithOptional({ id: contentId, title: text(200) }, { url: text(400) }),
    { max: 64 },
  ),
  words: schema.array(wordSchema, { max: 20_000 }),
  families: schema.array(familySchema, { max: 2_000 }),
  sentences: schema.array(sentenceSchema, { max: 20_000 }),
  relations: schema.object({
    synonyms: schema.array(pair, { max: 5_000 }),
    antonyms: schema.array(pair, { max: 5_000 }),
    hierarchies: schema.array(
      schema.object({ general: contentId, specific: uniqueArray(contentId, { min: 2, max: 32 }) }),
      { max: 2_000 },
    ),
    soundAlikes: schema.array(soundPair, { max: 5_000 }),
  }),
});

// ---------------------------------------------------------------------------------------------
// Validation

/** A problem found in the lexicon, with the record it is in. */
export interface LexiconProblem {
  where: string;
  message: string;
}

/** The text of a cell's preferred form. */
export function preferred(value: Read<Cell>): string {
  return typeof value === 'string' ? value : value[0]!;
}

/**
 * Every form of a word as written: its lemma, every variant of its paradigm cells and its
 * composed forms (`formCells`). A word without a paradigm (a pronoun) accepts any form: S3's
 * checker verifies those against the sources.
 */
function formsOf(word: Read<Word>): { has(form: string): boolean } {
  if (!word.noun && !word.verb) return { has: () => true };
  const forms = new Set<string>([word.lemma, ...formCells(word).map((cell) => cell.text)]);
  const add = (cell: Read<Cell> | undefined) => {
    if (cell !== undefined)
      for (const text of typeof cell === 'string' ? [cell] : cell) forms.add(text);
  };
  word.noun?.paradigm.sg?.forEach(add);
  word.noun?.paradigm.pl?.forEach(add);
  if (word.verb) {
    const { inf, pres, imp, past, fut } = word.verb.paradigm;
    [inf, ...pres, ...imp, ...Object.values(past), ...(fut ?? [])].forEach(add);
  }
  return forms;
}

/** i/y and í/ý folded together: two words that differ only there are written alike by ear. */
function foldIY(word: string): string {
  return word.toLowerCase().replaceAll('ý', 'í').replaceAll('y', 'i');
}

/** Linguistic consistency of a lexicon (structure is checked by `lexiconSchema` first). */
export function validateLexicon(lexicon: Read<Lexicon>): LexiconProblem[] {
  const problems: LexiconProblem[] = [];
  const report = (where: string, message: string) => problems.push({ where, message });
  const words = new Map<string, Read<Word>>();
  const families = new Map<string, Read<WordFamily>>();
  const sources = new Set(lexicon.sources.map((source) => source.id));
  const wordIds = new Set(lexicon.words.map((word) => word.id));

  if (sources.size !== lexicon.sources.length) report('sources', 'Duplicate source IDs.');
  for (const family of lexicon.families) {
    if (families.has(family.id)) report(`family ${family.id}`, 'Duplicate family ID.');
    families.set(family.id, family);
  }

  for (const word of lexicon.words) {
    const where = `word ${word.id}`;
    if (words.has(word.id)) report(where, 'Duplicate word ID.');
    words.set(word.id, word);
    if (word.lemma.normalize('NFC') !== word.lemma) report(where, 'The lemma is not NFC.');
    const base = lexiconId(word.lemma);
    if (base === null) report(where, `The lemma "${word.lemma}" has no ASCII ID.`);
    else if (word.id !== base && !new RegExp(`^${base}\\.[a-z0-9]+$`).test(word.id)) {
      report(where, `The ID must be "${base}" or "${base}.<sense>".`);
    }
    for (const id of word.src) if (!sources.has(id)) report(where, `Unknown source "${id}".`);

    if (word.noun && word.pos !== 'noun') report(where, 'Noun data on a word that is not a noun.');
    if (word.verb && word.pos !== 'verb') report(where, 'Verb data on a word that is not a verb.');
    if (word.pos === 'noun' && !word.noun) report(where, 'A noun needs its noun data.');
    if (word.noun) {
      const noun = word.noun;
      if ((noun.gender === 'm') !== (noun.animate !== undefined)) {
        report(where, 'Masculine nouns, and only they, state `animate`.');
      }
      const klass = genderClass(noun.gender, noun.animate ?? null);
      if (noun.pattern !== null && PATTERN_GENDER[noun.pattern] !== klass) {
        report(where, `The pattern "${noun.pattern}" does not fit the gender ${klass}.`);
      }
      const wantSg = noun.numbers !== 'pl';
      const wantPl = noun.numbers !== 'sg';
      if (
        wantSg !== (noun.paradigm.sg !== undefined) ||
        wantPl !== (noun.paradigm.pl !== undefined)
      ) {
        report(where, `The paradigm must have exactly the numbers "${noun.numbers}" says.`);
      }
      const first = noun.paradigm.sg?.[0] ?? noun.paradigm.pl?.[0];
      if (first !== undefined && preferred(first) !== word.lemma) {
        report(where, 'The 1st case of the paradigm must be the lemma.');
      }
      if (noun.proper && word.lemma[0] === word.lemma[0]!.toLowerCase()) {
        report(where, 'A proper name starts with a capital letter.');
      }
    }
    if (word.verb) {
      const { aspect, reflexive, paradigm } = word.verb;
      const infinitive = preferred(paradigm.inf);
      if ((reflexive ? `${infinitive} ${reflexive}` : infinitive) !== word.lemma) {
        report(where, 'The infinitive (with its reflexive pronoun) must be the lemma.');
      }
      if (paradigm.fut && aspect === 'pf') {
        report(where, 'A perfective verb lists no future: its present forms are the future.');
      }
      if (
        aspect === 'impf' &&
        !paradigm.fut &&
        (IRREGULAR_FUTURE_INFINITIVES as readonly string[]).includes(infinitive)
      ) {
        report(where, `"${infinitive}" forms its future without "budu": list \`fut\`.`);
      }
    }
    if (word.register === 'colloquial' && word.standard === undefined) {
      report(where, 'A colloquial word names its standard twin.');
    }

    if (word.segments) {
      const roles = word.segments.map(([role]) => role);
      const joined = word.segments.map(([, piece]) => piece).join('');
      if (joined !== word.lemma.toLowerCase()) {
        report(where, `The segments rebuild "${joined}", not "${word.lemma}".`);
      }
      const order: Record<SegmentRole, number> = { prefix: 0, root: 1, suffix: 2, ending: 3 };
      if (roles.filter((role) => role === 'root').length !== 1) report(where, 'Exactly one root.');
      if (roles.filter((role) => role === 'ending').length > 1)
        report(where, 'At most one ending.');
      for (let index = 1; index < roles.length; index++) {
        if (order[roles[index]!] < order[roles[index - 1]!]) {
          report(where, 'Segments go prefix, root, suffix, ending.');
          break;
        }
      }
      for (const [role, piece] of word.segments) {
        if (piece === '' && role !== 'ending' && role !== 'suffix') {
          report(where, `Only an ending or a suffix may be empty (${role}).`);
        }
      }
    }

    const letters = codePoints(word.lemma);
    for (const point of word.spelling ?? []) {
      const span = letters.slice(point.at, point.at + codePoints(point.correct).length).join('');
      if (span !== point.correct) {
        report(where, `Spelling point at ${point.at} reads "${span}", not "${point.correct}".`);
      }
      if (point.alt.includes(point.correct))
        report(where, 'An alternative equals the correct form.');
    }

    if (word.family) {
      const family = families.get(word.family.id);
      if (!family) report(where, `Unknown family "${word.family.id}".`);
      else {
        if ((family.head === word.id) !== (word.family.role === 'head')) {
          report(where, 'A family has exactly its head word in the role "head".');
        }
        if (family.letter !== null) {
          const listed = (word.spelling ?? []).some((point) => {
            const before = letters[point.at - 1]?.toLowerCase();
            return (
              (point.rule === 'vyjm' || point.rule === 'vyjm-prefix') &&
              (point.correct === 'y' || point.correct === 'ý') &&
              (point.rule === 'vyjm-prefix' || before === family.letter)
            );
          });
          if (!listed) {
            report(where, `A word of a listed family needs a "vyjm" y/ý after "${family.letter}".`);
          }
        }
      }
    }
    if (word.standard !== undefined && !wordIds.has(word.standard)) {
      report(where, `Unknown standard twin "${word.standard}".`);
    }
  }

  for (const family of lexicon.families) {
    const where = `family ${family.id}`;
    const head = words.get(family.head);
    if (!head) report(where, `Unknown head word "${family.head}".`);
    else if (head.family?.id !== family.id) report(where, 'The head word is not in this family.');
    if ((family.letter === null) !== (family.order === null)) {
      report(where, 'A listed family has a rhyme order; an ordinary family has none.');
    }
    for (const kin of family.kin) {
      if (kin === family.id || !families.has(kin)) report(where, `Bad kin family "${kin}".`);
    }
    if (family.soundAlike !== undefined && !families.has(family.soundAlike)) {
      report(where, `Unknown sound-alike family "${family.soundAlike}".`);
    }
    for (const id of family.src) if (!sources.has(id)) report(where, `Unknown source "${id}".`);
  }

  const soundAlike = new Set(
    lexicon.relations.soundAlikes.flatMap(([a, b]) =>
      typeof a === 'string' && typeof b === 'string' ? [`${a}|${b}`, `${b}|${a}`] : [],
    ),
  );
  const byFold = new Map<string, Read<Word>>();
  for (const word of lexicon.words) {
    const folded = foldIY(word.lemma);
    const other = byFold.get(folded);
    if (other && other.lemma !== word.lemma && !soundAlike.has(`${other.id}|${word.id}`)) {
      report(
        `word ${word.id}`,
        `"${word.lemma}" and "${other.lemma}" differ only in i/y: declare them sound-alikes or fix the spelling.`,
      );
    }
    if (!other) byFold.set(folded, word);
  }

  const sentenceIds = new Set<string>();
  for (const sentence of lexicon.sentences) {
    const where = `sentence ${sentence.id}`;
    if (sentenceIds.has(sentence.id)) report(where, 'Duplicate sentence ID.');
    sentenceIds.add(sentence.id);
    let parsed: GappedText;
    try {
      parsed = parseGappedText(sentence.text);
    } catch (error) {
      report(where, error instanceof Error ? error.message : String(error));
      continue;
    }
    if (parsed.gaps.length !== sentence.gaps.length) {
      report(where, `${parsed.gaps.length} gaps in the text, ${sentence.gaps.length} annotated.`);
    }
    const tokens = textWords(parsed.plain);
    if (tokens.length > MAX_SENTENCE_WORDS) report(where, `${tokens.length} words (max 10).`);
    if (sentence.tokens) {
      const given = sentence.tokens.map((token) => token.t);
      if (given.join(' ') !== tokens.join(' ')) {
        report(where, `Tokens "${given.join(' ')}" do not match the text "${tokens.join(' ')}".`);
      }
      for (const token of sentence.tokens) {
        if (token.word !== undefined && !words.has(token.word)) {
          report(where, `Unknown token word "${token.word}".`);
        }
      }
    }
    sentence.gaps.forEach((gap, index) => {
      if (gap.word !== null) {
        const word = words.get(gap.word);
        if (!word) report(where, `Gap ${index}: unknown word "${gap.word}".`);
        else if (
          gap.point !== undefined &&
          !(word.spelling ?? []).some((point) => point.at === gap.point)
        ) {
          report(where, `Gap ${index}: "${gap.word}" has no spelling point at ${gap.point}.`);
        }
      } else if (gap.point !== undefined) report(where, `Gap ${index}: a point needs a word.`);
      for (const subject of gap.subjects ?? []) {
        if (subject >= tokens.length)
          report(where, `Gap ${index}: subject ${subject} is no token.`);
      }
    });
    for (const list of [sentence.subjects, sentence.predicates, sentence.conjunctions]) {
      for (const at of list ?? []) {
        if (at >= tokens.length) report(where, `Token index ${at} is out of range.`);
      }
    }
  }

  const relationPairs: [string, readonly (readonly [Read<SoundRef>, Read<SoundRef>])[]][] = [
    ['synonyms', lexicon.relations.synonyms],
    ['antonyms', lexicon.relations.antonyms],
    ['soundAlikes', lexicon.relations.soundAlikes],
  ];
  for (const [name, pairs] of relationPairs) {
    const seen = new Set<string>();
    for (const [left, right] of pairs) {
      const a = soundRefTarget(left);
      const b = soundRefTarget(right);
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (a === b) report(`relations.${name}`, `"${a}" is paired with itself.`);
      if (seen.has(key)) report(`relations.${name}`, `Duplicate pair ${a}/${b}.`);
      seen.add(key);
      for (const ref of [left, right]) {
        const word = words.get(soundRefWord(ref));
        if (!word) report(`relations.${name}`, `Unknown word "${soundRefWord(ref)}".`);
        else if (typeof ref !== 'string' && !formsOf(word).has(ref.form)) {
          report(`relations.${name}`, `"${ref.form}" is not a form of "${word.lemma}".`);
        }
      }
    }
  }
  for (const hierarchy of lexicon.relations.hierarchies) {
    for (const id of [hierarchy.general, ...hierarchy.specific]) {
      if (!words.has(id)) report('relations.hierarchies', `Unknown word "${id}".`);
    }
    if (hierarchy.specific.includes(hierarchy.general)) {
      report('relations.hierarchies', `"${hierarchy.general}" is general and specific at once.`);
    }
  }
  return problems;
}

export type { Read as LexiconRead };
