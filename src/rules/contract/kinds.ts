/**
 * Closed vocabularies of the rules: activity kinds, input modes, generators, response buckets,
 * classification dimensions, random streams and curriculum strands. Each value is implemented in
 * code, so adding one is a code change plus a contract change (docs/contract.md §2).
 */

/**
 * Activity kinds. "Problem" activities serve one problem at a time and are answered with the
 * `answer` action; "minigame" activities are played with `minigameMove` on an `@aegis/narrative`
 * minigame instance. docs/design.md §5 has every activity's rules.
 */
export const PROBLEM_ACTIVITY_KINDS = [
  'feeding', // Krmení: the core round
  'ink-sentence', // Inkoustová věta: a sentence with 1-3 ink-blot gaps, filled one by one
  'bug-hunt', // Lov chyb: find the mistake the ink hid, then fix it
  'analysis', // Určování: which part of speech, gender, case, person, tense, pattern?
  'battle', // Souboj s příšerou: the monster battle
  'race', // Závod s delfíny: a 60-second race against your own best (hub only)
  'snack', // Svačinka: hungry friends' due reviews (hub only)
  'placement', // Ukaž, co umíš: the placement check (hub only)
] as const;
export const MINIGAME_ACTIVITY_KINDS = [
  'memory-match', // Pexeso
  'pearl-necklace', // Perlový náhrdelník
  'fishing-nets', // Rybářské sítě
  'word-shell', // Ulita slov
  'word-family', // Slovní rodinka
] as const;
export const ACTIVITY_KINDS = [...PROBLEM_ACTIVITY_KINDS, ...MINIGAME_ACTIVITY_KINDS] as const;
export type ProblemActivityKind = (typeof PROBLEM_ACTIVITY_KINDS)[number];
export type MinigameActivityKind = (typeof MINIGAME_ACTIVITY_KINDS)[number];
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Activity kinds a content level may list (race, snack and placement are hub-only). */
export const LEVEL_ACTIVITY_KINDS = [
  'feeding',
  'ink-sentence',
  'bug-hunt',
  'analysis',
  'battle',
  ...MINIGAME_ACTIVITY_KINDS,
] as const;
export type LevelActivityKind = (typeof LEVEL_ACTIVITY_KINDS)[number];

export function isMinigameKind(kind: string): kind is MinigameActivityKind {
  return (MINIGAME_ACTIVITY_KINDS as readonly string[]).includes(kind);
}

/**
 * Narrative minigame kinds behind the minigame activities. `matching` and `ordering` are built
 * into `@aegis/narrative`; the `ps.*` kinds are custom `MinigameAdapter`s registered by the rules.
 */
export const MINIGAME_KIND_BY_ACTIVITY = {
  'memory-match': 'matching',
  'pearl-necklace': 'ordering',
  'fishing-nets': 'ps.sorting-nets',
  'word-shell': 'ps.word-builder',
  'word-family': 'ps.word-family',
} as const satisfies Record<MinigameActivityKind, string>;
export type NarrativeMinigameKind =
  (typeof MINIGAME_KIND_BY_ACTIVITY)[keyof typeof MINIGAME_KIND_BY_ACTIVITY];

/**
 * School grades the sea serves. A profile's `settings.grade` picks where the child starts and
 * what the daily adventure suggests; content regions belong to one grade.
 */
export const GRADES = [3, 4] as const;
export type Grade = (typeof GRADES)[number];
/** The grade of a save or region that does not name one. */
export const DEFAULT_GRADE: Grade = 3;

/**
 * How answers are entered. `auto` resolves per problem from the item's Leitner box: choice
 * buttons while the item is new, then the big letter pad (`letters`: i í y ý, d t, ú ů, …), then
 * typing on the Czech on-screen keyboard (`typed`) once it is strong, where the problem allows
 * it (`balance.input`).
 */
export const INPUT_MODES = ['auto', 'choice', 'letters', 'typed'] as const;
export type InputMode = (typeof INPUT_MODES)[number];
export type ResolvedInputMode = Exclude<InputMode, 'auto'>;

/**
 * Response buckets. The shell measures `elapsedMs`; the rules sort a right answer into `fast`,
 * `ok` or `slow` with `balance.response`, and record a wrong answer as `miss`.
 */
export const RESPONSE_BUCKETS = ['fast', 'ok', 'slow', 'miss'] as const;
export type ResponseBucket = (typeof RESPONSE_BUCKETS)[number];

/**
 * What an `analysis` problem, a sorting net or an odd-one-out set asks about a word. Each
 * dimension has a closed value list in language.ts (`DIMENSION_VALUES` in skills.ts).
 */
export const DIMENSIONS = [
  'pos', // part of speech (10)
  'inflection', // inflected or uninflected (ohebné, neohebné)
  'meaning-class', // action, thing, circumstance, property (děj, věc, okolnost, vlastnost)
  'gender', // m, f, n (3rd grade: rod without animacy)
  'gender-class', // ma, mi, f, n (4th grade: rod with animacy, životnost)
  'number', // sg, pl
  'case', // 1..7
  'pattern', // the 14 noun patterns
  'person', // 1, 2, 3
  'tense', // past, present, future
  'mood', // indicative, imperative, conditional
  'verb-form', // simple, compound
  'finiteness', // finite form or infinitive
  'reflexive', // se, si, none (zvratná slovesa)
  'consonant', // hard, soft, both-way (of a letter)
  'register', // standard, colloquial
  'segment', // prefix, root, suffix, ending (of a highlighted part)
  'sentence-kind', // statement, question, command, wish
  'clauses', // simple sentence or compound sentence
  'member', // subject, predicate, other (of a highlighted token)
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/**
 * Problem and board generators. A content skill names one generator plus its parameters; the
 * generator enumerates the skill's item universe and draws problems from the `problems` stream.
 * Adding a generator is code (src/rules/learning/generators); adding a skill that uses one is
 * data (docs/contract.md §6).
 */
export const GENERATOR_IDS = [
  'spell.word', // a word with 1-3 letter gaps (i/y, í/ý, ú/ů, ě/je, d/t, capital, …)
  'spell.sentence', // a sentence with 1-3 gaps, filled one by one (Inkoustová věta)
  'spell.mistake', // a sentence with one mistake: find it, then fix it (Lov chyb)
  'classify', // name one dimension of a word or a token in a sentence (Určování)
  'odd-one-out', // which word does not belong
  'relation', // pick the synonym, antonym, general word, … of a word
  'alphabet', // put words in alphabetical order, or in the school rhyme's order (necklace)
  'pairs', // memory-match pairs: word ↔ related word, synonym, antonym, plural, pattern, …
  'sort', // fishing nets: sort words into 2-4 nets by one dimension
  'segment', // word shell: split a word into prefix, root, suffix, ending
  'family', // word family: pick every word of one family among sound-alike neighbours
] as const;
export type GeneratorId = (typeof GENERATOR_IDS)[number];

/** Generators that make board (minigame) activities rather than single problems. */
export const BOARD_GENERATORS = ['alphabet', 'pairs', 'sort', 'segment', 'family'] as const;
export type BoardGeneratorId = (typeof BOARD_GENERATORS)[number];

/**
 * Named random streams, forked once by the runtime before initialisation. They are independent:
 * drawing a reward or an ambush never changes the next problem. `main` (the runtime default) is
 * unused by rules.
 */
export const RANDOM_STREAMS = ['problems', 'distractors', 'rewards', 'words', 'ambush'] as const;
export type RandomStreamName = (typeof RANDOM_STREAMS)[number];

/** Runtime event phases for scheduled jobs (only re-asks today). */
export const EVENT_PHASES = ['reask'] as const;
export type EventPhase = (typeof EVENT_PHASES)[number];

/** Runtime job rules. */
export const JOB_RULES = ['reask'] as const;
export type JobRuleId = (typeof JOB_RULES)[number];

/** Runtime phase IDs entered by the rules: a round, or the hub between rounds. */
export const RUNTIME_PHASES = ['hub', 'round'] as const;

/**
 * Curriculum strands (docs/curriculum.md): ten, one for each of Krakatice's arms in the finale.
 */
export const STRANDS = [
  'letters-sounds',
  'listed-words',
  'word-meaning',
  'word-structure',
  'prefixes',
  'parts-of-speech',
  'nouns',
  'verbs',
  'standard-czech',
  'sentences',
] as const;
export type Strand = (typeof STRANDS)[number];
