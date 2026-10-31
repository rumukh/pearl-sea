/**
 * Skills: what a level practises. A skill names a generator (kinds.ts `GENERATOR_IDS`) and its
 * parameters, which select words or sentences of the lexicon and the spelling rules, dimensions
 * or relations to practise. `skillItems` enumerates a skill's item universe, which bounds what
 * the Leitner boxes track, what a friend's growth counts and what the Great Shell shows.
 *
 * Adding a skill that uses an existing generator is data (content.ts); adding a generator is
 * code in src/rules/learning/generators plus a contract change.
 */
import { failure, schema, success } from '@aegis/runtime';
import type { DeepReadonly, Outcome, Schema } from '@aegis/runtime';
import { DIMENSIONS, GENERATOR_IDS, STRANDS } from './kinds';
import type { Dimension, GeneratorId, Grade, Strand } from './kinds';
import {
  ASPECTS,
  BOTH_WAY_CONSONANTS,
  CASES,
  CLAUSE_STRUCTURES,
  CONSONANT_CLASSES,
  GENDER_CLASSES,
  GENDERS,
  HARD_CONSONANTS,
  INFLECTION,
  LISTED_LETTERS,
  MEANING_CLASSES,
  MOODS,
  NOUN_PATTERNS,
  NUMBERS,
  PARTS_OF_SPEECH,
  PERSONS,
  REFLEXIVES,
  REGISTERS,
  SEGMENT_ROLES,
  SENTENCE_KINDS,
  SENTENCE_MEMBERS,
  SOFT_CONSONANTS,
  SPELLING_RULES,
  TENSES,
  VERB_FINITENESS,
  VERB_FORMS,
  WORD_RELATIONS,
  genderClass,
  isInflected,
} from './language';
import type {
  Aspect,
  ListedLetter,
  PartOfSpeech,
  SegmentRole,
  SpellingRule,
  WordRelation,
} from './language';
import {
  FORM_GROUPS,
  formCells,
  formGroup,
  lexiconId,
  soundRefTarget,
  soundRefWord,
} from './lexicon';
import type { FormDimension, FormGroup, Lexicon, Sentence, Word } from './lexicon';
import {
  PAIR_KINDS,
  alphabetItem,
  classItem,
  familyItem,
  gapItem,
  pairItem,
  relationItem,
  segmentItem,
  spellItem,
} from './problems';
import type { PairKind } from './problems';
import {
  catalogKey,
  contentId,
  gradeSchema,
  int,
  nullable,
  objectWithOptional,
  oneOf,
  uniqueArray,
} from './schema';

type Read<T> = DeepReadonly<T>;

/** The values each dimension can take, as answer options (`classify`, nets, odd-one-out). */
export const DIMENSION_VALUES: Readonly<Record<Dimension, readonly string[]>> = {
  pos: PARTS_OF_SPEECH,
  inflection: INFLECTION,
  'meaning-class': MEANING_CLASSES,
  gender: GENDERS,
  'gender-class': GENDER_CLASSES,
  number: NUMBERS,
  case: CASES.map(String),
  pattern: NOUN_PATTERNS,
  person: PERSONS.map(String),
  tense: TENSES,
  mood: MOODS,
  'verb-form': VERB_FORMS,
  finiteness: VERB_FINITENESS,
  reflexive: [...REFLEXIVES, 'none'],
  consonant: CONSONANT_CLASSES,
  register: REGISTERS,
  segment: SEGMENT_ROLES,
  'sentence-kind': SENTENCE_KINDS,
  clauses: CLAUSE_STRUCTURES,
  member: SENTENCE_MEMBERS,
};

// ---------------------------------------------------------------------------------------------
// Filters

/** Selects lexicon words. Every present field narrows the selection; absent fields allow all. */
export interface WordFilter {
  words?: string[];
  topics?: string[];
  tags?: string[];
  pos?: PartOfSpeech[];
  families?: string[];
  /** Words of the listed-word families of these letters. */
  letters?: ListedLetter[];
  grades?: Grade[];
  /** Only verbs of these aspects (a 3rd-grade tense skill keeps to imperfective verbs). */
  aspects?: Aspect[];
  /** Only words of core (school-list) families. */
  core?: boolean;
  exclude?: string[];
}

/** Selects lexicon sentences. */
export interface SentenceFilter {
  sentences?: string[];
  topics?: string[];
  grades?: Grade[];
}

export function matchesWordFilter(
  word: Read<Word>,
  filter: Read<WordFilter>,
  families: ReadonlyMap<string, { letter: string | null; core: boolean }>,
): boolean {
  const family = word.family ? families.get(word.family.id) : undefined;
  return (
    (filter.words === undefined || filter.words.includes(word.id)) &&
    (filter.topics === undefined || filter.topics.some((topic) => word.topics.includes(topic))) &&
    (filter.tags === undefined || filter.tags.some((tag) => word.tags.includes(tag))) &&
    (filter.pos === undefined || filter.pos.includes(word.pos)) &&
    (filter.families === undefined ||
      (word.family !== undefined && filter.families.includes(word.family.id))) &&
    (filter.letters === undefined ||
      (family !== undefined &&
        family.letter !== null &&
        filter.letters.includes(family.letter as ListedLetter))) &&
    (filter.grades === undefined || filter.grades.includes(word.grade)) &&
    (filter.aspects === undefined ||
      (word.verb !== undefined && filter.aspects.includes(word.verb.aspect))) &&
    (filter.core === undefined || (family !== undefined && family.core === filter.core)) &&
    (filter.exclude === undefined || !filter.exclude.includes(word.id))
  );
}

export function matchesSentenceFilter(
  sentence: Read<Sentence>,
  filter: Read<SentenceFilter>,
): boolean {
  return (
    (filter.sentences === undefined || filter.sentences.includes(sentence.id)) &&
    (filter.topics === undefined ||
      filter.topics.some((topic) => sentence.topics.includes(topic))) &&
    (filter.grades === undefined || filter.grades.includes(sentence.grade))
  );
}

/**
 * The value of `dimension` for a word on its own (its lemma), or `null` when the dimension needs
 * a form or a sentence (case, person, tense, member …) or does not apply to the word.
 */
export function wordDimensionValue(word: Read<Word>, dimension: Dimension): string | null {
  switch (dimension) {
    case 'pos':
      return word.pos;
    case 'inflection':
      return isInflected(word.pos) ? 'inflected' : 'uninflected';
    case 'meaning-class':
      return (
        (
          { noun: 'thing', verb: 'action', adj: 'property', adv: 'circumstance' } as Partial<
            Record<PartOfSpeech, string>
          >
        )[word.pos] ?? null
      );
    case 'gender':
      return word.noun?.gender ?? null;
    case 'gender-class':
      return word.noun ? genderClass(word.noun.gender, word.noun.animate ?? null) : null;
    case 'number':
      return word.noun ? (word.noun.numbers === 'pl' ? 'pl' : 'sg') : null;
    case 'pattern':
      return word.noun?.pattern ?? null;
    case 'register':
      return word.register ?? 'standard';
    case 'reflexive':
      return word.verb ? (word.verb.reflexive ?? 'none') : null;
    default:
      return null;
  }
}

/** Dimensions `wordDimensionValue` answers: what odd-one-out sets and word nets differ in. */
export const WORD_VALUE_DIMENSIONS = [
  'pos',
  'inflection',
  'meaning-class',
  'gender',
  'gender-class',
  'number',
  'pattern',
  'register',
  'reflexive',
] as const satisfies readonly Dimension[];

/**
 * What a classification looks at, and the dimensions each context can ask:
 * - `word`: a lexicon word on its own (its lemma), a consonant letter (`consonant`) or a
 *   highlighted part of a word (`segment`);
 * - `form`: a form derived from a word's paradigm (lexicon.ts `formCells`: rybou, plaval jsem,
 *   budu plavat, plav, plaval bych);
 * - `sentence`: a token of an annotated sentence, or the sentence itself (`sentence-kind`,
 *   `clauses`).
 */
export const CONTEXT_DIMENSIONS = {
  word: [...WORD_VALUE_DIMENSIONS, 'consonant', 'segment'],
  form: ['number', 'case', 'person', 'tense', 'mood', 'verb-form', 'finiteness'],
  sentence: [
    'pos',
    'gender',
    'gender-class',
    'number',
    'case',
    'person',
    'tense',
    'mood',
    'member',
    'sentence-kind',
    'clauses',
  ],
} as const satisfies Record<ContextKind, readonly Dimension[]>;

/** Dimensions fishing nets can sort words (`word`) or forms (`form`) by. */
export const SORT_DIMENSIONS = {
  word: [...WORD_VALUE_DIMENSIONS, 'consonant'],
  form: CONTEXT_DIMENSIONS.form,
} as const satisfies Record<SortContext, readonly Dimension[]>;

/** The consonant letters whose class `classify` with `consonant` asks, as ASCII IDs. */
export const CONSONANT_ITEMS: readonly { letter: string; id: string; value: string }[] = [
  ...HARD_CONSONANTS.map((letter) => ({ letter, value: 'hard' })),
  ...SOFT_CONSONANTS.map((letter) => ({ letter, value: 'soft' })),
  ...BOTH_WAY_CONSONANTS.map((letter) => ({ letter, value: 'both-way' })),
].map((entry) => ({ ...entry, id: lexiconId(entry.letter)! }));

// ---------------------------------------------------------------------------------------------
// Skills

export type ContextKind = 'word' | 'form' | 'sentence';
export type SortContext = 'word' | 'form';
export type OddBasis = Dimension | 'family' | 'listed';
export type AlphabetOrder = 'alphabet' | 'rhyme';

export type SkillSpec =
  | {
      generator: 'spell.word';
      /** `choices`: answer options with choice input (2-4: i/y, or i/í/y/ý). */
      params: { words: WordFilter; rules: SpellingRule[]; maxGaps: number; choices: number };
    }
  | { generator: 'spell.sentence'; params: { sentences: SentenceFilter; rules: SpellingRule[] } }
  | { generator: 'spell.mistake'; params: { sentences: SentenceFilter; rules: SpellingRule[] } }
  | {
      generator: 'classify';
      params: {
        dimension: Dimension;
        context: ContextKind;
        words: WordFilter;
        sentences: SentenceFilter;
        /** Offer only these values (e.g. cases 1-4 first), or every value of the dimension. */
        values: string[] | null;
        /** With `context: 'form'`: only forms of these groups (null: all; else null). */
        cells: FormGroup[] | null;
      };
    }
  | { generator: 'odd-one-out'; params: { basis: OddBasis; words: WordFilter; size: number } }
  | { generator: 'relation'; params: { relations: WordRelation[]; words: WordFilter } }
  | { generator: 'alphabet'; params: { words: WordFilter; order: AlphabetOrder; size: number } }
  | { generator: 'pairs'; params: { pair: PairKind; words: WordFilter; pairs: number } }
  | {
      generator: 'sort';
      params: {
        dimension: Dimension;
        context: SortContext;
        values: string[];
        words: WordFilter;
        fish: number;
        /** With `context: 'form'`: only forms of these groups (null: all; else null). */
        cells: FormGroup[] | null;
      };
    }
  | { generator: 'segment'; params: { words: WordFilter; roles: SegmentRole[] } }
  | {
      generator: 'family';
      params: { words: WordFilter; families: string[] | null; pick: number; distractors: number };
    };

export type Skill = { id: string; titleKey: string; strand: Strand } & SkillSpec;

const ids = uniqueArray(contentId, { max: 512 });
const topics = uniqueArray(contentId, { min: 1, max: 32 });

export const wordFilterSchema: Schema<WordFilter> = objectWithOptional(
  {},
  {
    words: uniqueArray(contentId, { min: 1, max: 1000 }),
    topics,
    tags: topics,
    pos: uniqueArray(oneOf(PARTS_OF_SPEECH), { min: 1, max: 10 }),
    families: uniqueArray(contentId, { min: 1, max: 500 }),
    letters: uniqueArray(oneOf(LISTED_LETTERS), { min: 1, max: 7 }),
    grades: uniqueArray(gradeSchema, { min: 1, max: 2 }),
    aspects: uniqueArray(oneOf(ASPECTS), { min: 1, max: 2 }),
    core: schema.boolean,
    exclude: ids,
  },
);

export const sentenceFilterSchema: Schema<SentenceFilter> = objectWithOptional(
  {},
  {
    sentences: uniqueArray(contentId, { min: 1, max: 2000 }),
    topics,
    grades: uniqueArray(gradeSchema, { min: 1, max: 2 }),
  },
);

const rules = uniqueArray(oneOf(SPELLING_RULES), { min: 1, max: SPELLING_RULES.length });

/** Parameter schema of each generator. */
export const SKILL_PARAM_SCHEMAS: { readonly [G in GeneratorId]: Schema<unknown> } = {
  'spell.word': schema.object({
    words: wordFilterSchema,
    rules,
    maxGaps: int(1, 3),
    choices: int(2, 4),
  }),
  'spell.sentence': schema.object({ sentences: sentenceFilterSchema, rules }),
  'spell.mistake': schema.object({ sentences: sentenceFilterSchema, rules }),
  classify: schema.object({
    dimension: oneOf(DIMENSIONS),
    context: oneOf(['word', 'form', 'sentence'] as const),
    words: wordFilterSchema,
    sentences: sentenceFilterSchema,
    values: nullable(
      uniqueArray(schema.string({ minLength: 1, maxLength: 24 }), { min: 2, max: 14 }),
    ),
    cells: nullable(uniqueArray(oneOf(FORM_GROUPS), { min: 1, max: FORM_GROUPS.length })),
  }),
  'odd-one-out': schema.object({
    basis: oneOf([...DIMENSIONS, 'family', 'listed'] as const),
    words: wordFilterSchema,
    size: int(3, 6),
  }),
  relation: schema.object({
    relations: uniqueArray(oneOf(WORD_RELATIONS), { min: 1, max: WORD_RELATIONS.length }),
    words: wordFilterSchema,
  }),
  alphabet: schema.object({
    words: wordFilterSchema,
    order: oneOf(['alphabet', 'rhyme'] as const),
    size: int(3, 10),
  }),
  pairs: schema.object({ pair: oneOf(PAIR_KINDS), words: wordFilterSchema, pairs: int(3, 8) }),
  sort: schema.object({
    dimension: oneOf(DIMENSIONS),
    context: oneOf(['word', 'form'] as const),
    values: uniqueArray(schema.string({ minLength: 1, maxLength: 24 }), { min: 2, max: 4 }),
    words: wordFilterSchema,
    fish: int(4, 12),
    cells: nullable(uniqueArray(oneOf(FORM_GROUPS), { min: 1, max: FORM_GROUPS.length })),
  }),
  segment: schema.object({
    words: wordFilterSchema,
    roles: uniqueArray(oneOf(SEGMENT_ROLES), { min: 1, max: 4 }),
  }),
  family: schema.object({
    words: wordFilterSchema,
    families: nullable(uniqueArray(contentId, { min: 1, max: 50 })),
    pick: int(2, 8),
    distractors: int(1, 6),
  }),
};

/** A skill record: the generator's parameters are checked against its own schema. */
export const skillSchema: Schema<Skill> = {
  parse(value: unknown, path = ''): Outcome<Skill> {
    const base = schema
      .object({
        id: contentId,
        titleKey: catalogKey,
        strand: oneOf(STRANDS),
        generator: oneOf(GENERATOR_IDS),
        params: schema.json,
      })
      .parse(value, path);
    if (!base.ok) return base;
    const params = SKILL_PARAM_SCHEMAS[base.value.generator].parse(
      base.value.params,
      `${path}.params`,
    );
    if (!params.ok) return params;
    const skill = { ...base.value, params: params.value } as Skill;
    const problem = paramProblem(skill);
    return problem === null ? success(skill) : failure('invalid-data', problem, { path });
  },
};

/** Cross-field checks of a skill's parameters. */
function paramProblem(skill: Skill): string | null {
  const valuesOf = (dimension: Dimension, values: readonly string[] | null) => {
    const allowed = DIMENSION_VALUES[dimension];
    const bad = (values ?? []).find((value) => !allowed.includes(value));
    return bad === undefined ? null : `"${bad}" is not a ${dimension} value.`;
  };
  switch (skill.generator) {
    case 'classify': {
      const { dimension, context, cells } = skill.params;
      if (!(CONTEXT_DIMENSIONS[context] as readonly string[]).includes(dimension)) {
        return `A ${context} classification cannot ask "${dimension}".`;
      }
      if (cells !== null && context !== 'form') return 'Only a form classification chooses cells.';
      return valuesOf(dimension, skill.params.values);
    }
    case 'sort': {
      const { dimension, context, cells } = skill.params;
      if (!(SORT_DIMENSIONS[context] as readonly string[]).includes(dimension)) {
        return `Nets of ${context}s cannot sort by "${dimension}".`;
      }
      if (cells !== null && context !== 'form') return 'Only nets of forms choose cells.';
      return valuesOf(dimension, skill.params.values);
    }
    case 'odd-one-out': {
      const basis = skill.params.basis;
      return basis === 'family' ||
        basis === 'listed' ||
        (WORD_VALUE_DIMENSIONS as readonly string[]).includes(basis)
        ? null
        : `Odd-one-out sets cannot differ in "${basis}".`;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Item universes

function familyIndex(lexicon: Read<Lexicon>) {
  return new Map(lexicon.families.map((family) => [family.id, family]));
}

function filteredWords(lexicon: Read<Lexicon>, filter: Read<WordFilter>): Read<Word>[] {
  const families = familyIndex(lexicon);
  return lexicon.words.filter((word) => matchesWordFilter(word, filter, families));
}

function relationPartners(lexicon: Read<Lexicon>, relation: WordRelation | PairKind): Set<string> {
  const relations = lexicon.relations;
  const fromPairs = (pairs: Read<[string, string][]>) => new Set(pairs.flat());
  switch (relation) {
    case 'synonym':
      return fromPairs(relations.synonyms);
    case 'antonym':
      return fromPairs(relations.antonyms);
    case 'sound-alike':
      return new Set(relations.soundAlikes.flat().map(soundRefWord));
    case 'general':
      return new Set(relations.hierarchies.map((hierarchy) => hierarchy.general));
    case 'specific':
    case 'coordinate':
      return new Set(relations.hierarchies.flatMap((hierarchy) => hierarchy.specific));
    case 'related':
    case 'family': {
      const sizes = new Map<string, number>();
      for (const word of lexicon.words) {
        if (word.family) sizes.set(word.family.id, (sizes.get(word.family.id) ?? 0) + 1);
      }
      return new Set(
        lexicon.words
          .filter((word) => word.family && (sizes.get(word.family.id) ?? 0) > 1)
          .map((word) => word.id),
      );
    }
    case 'plural':
      return new Set(
        lexicon.words
          .filter((word) => word.noun?.numbers === 'both' && word.noun.paradigm.pl)
          .map((word) => word.id),
      );
    case 'pattern':
      return new Set(lexicon.words.filter((word) => word.noun?.pattern).map((word) => word.id));
    case 'standard':
      return new Set(
        lexicon.words.filter((word) => word.register === 'colloquial').map((word) => word.id),
      );
  }
}

/**
 * The targets of a relation's items among the selected words: their IDs, and for a sound-alike
 * pair that names a form, `<word>:<form ID>` (pil of pít: `piit:pil`).
 */
function relationTargets(
  lexicon: Read<Lexicon>,
  relation: WordRelation | PairKind,
  words: readonly Read<Word>[],
): string[] {
  if (relation === 'sound-alike') {
    const selected = new Set(words.map((word) => word.id));
    return lexicon.relations.soundAlikes
      .flat()
      .filter((ref) => selected.has(soundRefWord(ref)))
      .map(soundRefTarget);
  }
  const partners = relationPartners(lexicon, relation);
  return words.filter((word) => partners.has(word.id)).map((word) => word.id);
}

/**
 * Every item a skill can serve, sorted (code-unit order) and unique. Bounded by the lexicon, so
 * the state that tracks items stays bounded too.
 */
export function skillItems(skill: Read<Skill>, lexicon: Read<Lexicon>): string[] {
  const items = new Set<string>();
  switch (skill.generator) {
    case 'spell.word':
      for (const word of filteredWords(lexicon, skill.params.words)) {
        for (const point of word.spelling ?? []) {
          if (skill.params.rules.includes(point.rule)) items.add(spellItem(word.id, point.at));
        }
      }
      break;
    case 'spell.sentence':
    case 'spell.mistake':
      for (const sentence of lexicon.sentences) {
        if (!matchesSentenceFilter(sentence, skill.params.sentences)) continue;
        sentence.gaps.forEach((gap, index) => {
          if (!skill.params.rules.includes(gap.rule)) return;
          items.add(
            gap.word !== null && gap.point !== undefined
              ? spellItem(gap.word, gap.point)
              : gapItem(sentence.id, index),
          );
        });
      }
      break;
    case 'classify': {
      const { dimension, context, values } = skill.params;
      const allowed = (value: string | null | undefined) =>
        value !== null && value !== undefined && (values === null || values.includes(value));
      if (dimension === 'consonant') {
        for (const entry of CONSONANT_ITEMS) {
          if (allowed(entry.value)) items.add(classItem('consonant', entry.id));
        }
      } else if (context === 'form') {
        const cells = skill.params.cells;
        for (const word of filteredWords(lexicon, skill.params.words)) {
          for (const form of formCells(word)) {
            if (cells !== null && !cells.includes(formGroup(form.cell))) continue;
            if (allowed(form.values[dimension as FormDimension])) {
              items.add(classItem(dimension, word.id, form.cell));
            }
          }
        }
      } else if (context === 'word') {
        for (const word of filteredWords(lexicon, skill.params.words)) {
          if (dimension === 'segment') {
            (word.segments ?? []).forEach(([role], index) => {
              if (allowed(role)) items.add(classItem('segment', word.id, String(index)));
            });
          } else if (allowed(wordDimensionValue(word, dimension))) {
            items.add(classItem(dimension, word.id));
          }
        }
      } else {
        for (const sentence of lexicon.sentences) {
          if (!matchesSentenceFilter(sentence, skill.params.sentences)) continue;
          if (dimension === 'sentence-kind' || dimension === 'clauses') {
            const value =
              dimension === 'sentence-kind'
                ? sentence.kind
                : sentence.clauses === undefined
                  ? undefined
                  : sentence.clauses > 1
                    ? 'compound'
                    : 'simple';
            if (allowed(value)) items.add(classItem(dimension, sentence.id));
            continue;
          }
          (sentence.tokens ?? []).forEach((token, index) => {
            const value =
              dimension === 'case' || dimension === 'person'
                ? token[dimension] === undefined
                  ? undefined
                  : String(token[dimension])
                : dimension === 'gender'
                  ? token.gender === 'ma' || token.gender === 'mi'
                    ? 'm'
                    : token.gender
                  : dimension === 'gender-class'
                    ? token.gender
                    : (token as Record<string, unknown>)[dimension];
            if (allowed(value as string | undefined)) {
              items.add(classItem(dimension, sentence.id, String(index)));
            }
          });
        }
      }
      break;
    }
    case 'odd-one-out':
      for (const word of filteredWords(lexicon, skill.params.words)) {
        const basis = skill.params.basis;
        if (basis === 'family' || basis === 'listed') {
          if (word.family) items.add(familyItem(word.id));
        } else if (wordDimensionValue(word, basis) !== null) {
          items.add(classItem(basis, word.id));
        }
      }
      break;
    case 'relation': {
      const words = filteredWords(lexicon, skill.params.words);
      for (const relation of skill.params.relations) {
        for (const target of relationTargets(lexicon, relation, words)) {
          items.add(relationItem(relation, target));
        }
      }
      break;
    }
    case 'alphabet':
      for (const word of filteredWords(lexicon, skill.params.words))
        items.add(alphabetItem(word.id));
      break;
    case 'pairs': {
      const words = filteredWords(lexicon, skill.params.words);
      for (const target of relationTargets(lexicon, skill.params.pair, words)) {
        items.add(pairItem(skill.params.pair, target));
      }
      break;
    }
    case 'sort': {
      const { dimension, context, values, cells } = skill.params;
      if (dimension === 'consonant') {
        for (const entry of CONSONANT_ITEMS) {
          if (values.includes(entry.value)) items.add(classItem('consonant', entry.id));
        }
        break;
      }
      for (const word of filteredWords(lexicon, skill.params.words)) {
        if (context === 'form') {
          for (const form of formCells(word)) {
            if (cells !== null && !cells.includes(formGroup(form.cell))) continue;
            const value = form.values[dimension as FormDimension];
            if (value !== undefined && values.includes(value)) {
              items.add(classItem(dimension, word.id, form.cell));
            }
          }
          continue;
        }
        const value = wordDimensionValue(word, dimension);
        if (value !== null && values.includes(value)) items.add(classItem(dimension, word.id));
      }
      break;
    }
    case 'segment':
      for (const word of filteredWords(lexicon, skill.params.words)) {
        if ((word.segments ?? []).some(([role]) => skill.params.roles.includes(role))) {
          items.add(segmentItem(word.id));
        }
      }
      break;
    case 'family':
      for (const word of filteredWords(lexicon, skill.params.words)) {
        if (
          word.family &&
          (skill.params.families === null || skill.params.families.includes(word.family.id))
        ) {
          items.add(familyItem(word.id));
        }
      }
      break;
  }
  return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
