/**
 * Board generation, typed board views and credits (src/rules/minigames/boards.ts, design
 * §5.8-§5.12, contract §12.1) on the real fixture packs: the rules' lagoon fixture, the contract's
 * mini pack, and the lagoon with a few listed-word, kin and sound-alike families added below (the
 * fixtures have no rhyme, kin or sound-alike families). Expected values come from the lexicon and
 * the contract (compareCzech, the consonant classes, the families' rhyme order), not from the
 * board makers. Boards keep the design's sizes (at least 3 pairs, 4 fish, 2 family words) and
 * never repeat the previous board of the round while another one is possible.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { createMinigame, projectMinigame, reduceMinigame } from '@aegis/narrative';
import type { Json, MinigameDefinition, MinigameState } from '@aegis/narrative';
import { requireValue, validateContent } from '@aegis/runtime';
import type { DeepReadonly } from '@aegis/runtime';
import {
  BOTH_WAY_CONSONANTS,
  CARD_BACK_LABEL,
  HARD_CONSONANTS,
  MINIGAME_KIND_BY_ACTIVITY,
  PAIR_KINDS,
  PATTERN_WORD,
  SEGMENT_ROLES,
  SOFT_CONSONANTS,
  cardLabel,
  compareCzech,
  contentRegistration,
  czechLetters,
  initialProfileState,
  isMinigameKind,
  lexiconId,
  skillItems,
  skillSchema,
  validateLexicon,
} from '../../../src/rules/contract';
import type {
  BoardView,
  CardFace,
  ContentData,
  ListedLetter,
  MinigameActivityKind,
  MinigameMove,
  NounPattern,
  ProfileState,
  SegmentRole,
  Skill,
  VerbParadigm,
  Word,
  WordFamily,
} from '../../../src/rules/contract';
import { itemIndex, itemsOf, lexiconIndex } from '../../../src/rules/learning/index-cache';
import {
  MINIGAMES,
  boardCredits,
  boardView,
  canMakeBoard,
  makeBoard,
  memoryPairKind,
  necklaceShape,
  parseFace,
  shellTarget,
} from '../../../src/rules/minigames/boards';
import type { BoardRequest } from '../../../src/rules/minigames/boards';
import type { SortingNetsConfig } from '../../../src/rules/minigames/sorting-nets';
import { partsOf } from '../../../src/rules/minigames/word-builder';
import type { WordBuilderConfig } from '../../../src/rules/minigames/word-builder';
import type { WordFamilyConfig } from '../../../src/rules/minigames/word-family';
import { moveProblem } from '../../../src/rules/progression/minigame-rounds';
import type { Data } from '../../../src/rules/types';
import { lagoonPack, lagoonPackJson, miniPack, realPack } from '../../fixtures/rules/packs';

// ------------------------------------------------------------------------------ test content

const SRC = ['ujc'];
type Cases = [string | string[], string, string, string, string, string | string[], string];

function noun(
  lemma: string,
  shape: { gender: 'm' | 'f' | 'n'; animate?: boolean; pattern: NounPattern },
  sg: Cases,
  pl: Cases,
  rest: Partial<Word>,
): Word {
  return {
    id: lexiconId(lemma)!,
    lemma,
    pos: 'noun',
    grade: 3,
    topics: [],
    tags: [],
    src: SRC,
    noun: { ...shape, numbers: 'both', paradigm: { sg, pl } },
    ...rest,
  };
}

function adjective(lemma: string, rest: Partial<Word>): Word {
  return {
    id: lexiconId(lemma)!,
    lemma,
    pos: 'adj',
    grade: 3,
    topics: [],
    tags: [],
    src: SRC,
    ...rest,
  };
}

function verb(lemma: string, paradigm: VerbParadigm, rest: Partial<Word>): Word {
  return {
    id: lexiconId(lemma)!,
    lemma,
    pos: 'verb',
    grade: 3,
    topics: [],
    tags: [],
    src: SRC,
    verb: { aspect: 'impf', reflexive: null, paradigm },
    ...rest,
  };
}

const head = (family: string) => ({ family: { id: family, role: 'head' as const } });
const member = (family: string) => ({ family: { id: family, role: 'related' as const } });
/** The listed-word y or ý right after the family's letter. */
const vyjm = (correct: 'y' | 'ý') => ({
  spelling: [{ at: 1, correct, alt: [correct === 'y' ? 'i' : 'í'], rule: 'vyjm' as const }],
});
const past = (stem: string) => ({
  m: stem,
  f: `${stem}a`,
  n: `${stem}o`,
  ma: `${stem}i`,
  mi: `${stem}y`,
  fpl: `${stem}y`,
  npl: `${stem}a`,
});
/** Both numbers of a noun declined exactly like hrad (pyl, vír). */
const likeHrad = (stem: string): [Cases, Cases] => [
  [stem, `${stem}u`, `${stem}u`, stem, `${stem}e`, `${stem}u`, `${stem}em`],
  [`${stem}y`, `${stem}ů`, `${stem}ům`, `${stem}y`, `${stem}y`, `${stem}ech`, `${stem}y`],
];

/**
 * Real Czech words for the boards the fixtures cannot make: the school rhyme of s (syn, sytý, sýr,
 * syrový, sychravý) with a word of syn's family; být with its kin byt and its sound-alike bít, and
 * two more listed families of b; the sound-alike pairs pyl × pil (a form of pít) and výr × vír.
 */
const BOARD_WORDS: Word[] = [
  noun(
    'syn',
    { gender: 'm', animate: true, pattern: 'pan' },
    ['syn', 'syna', 'synovi', 'syna', 'synu', 'synovi', 'synem'],
    ['synové', 'synů', 'synům', 'syny', 'synové', 'synech', 'syny'],
    { ...head('syn'), ...vyjm('y') },
  ),
  adjective('synovský', { ...member('syn'), ...vyjm('y') }),
  adjective('sytý', { ...head('sytyy'), ...vyjm('y') }),
  noun(
    'sýr',
    { gender: 'm', animate: false, pattern: 'hrad' },
    ['sýr', 'sýra', 'sýru', 'sýr', 'sýre', 'sýru', 'sýrem'],
    ['sýry', 'sýrů', 'sýrům', 'sýry', 'sýry', 'sýrech', 'sýry'],
    { ...head('syyr'), ...vyjm('ý') },
  ),
  adjective('syrový', { ...head('syrovyy'), ...vyjm('y') }),
  adjective('sychravý', { ...head('sychravyy'), ...vyjm('y') }),
  verb(
    'být',
    {
      inf: 'být',
      pres: ['jsem', 'jsi', 'je', 'jsme', 'jste', 'jsou'],
      imp: ['buď', 'buďme', 'buďte'],
      past: past('byl'),
      fut: ['budu', 'budeš', 'bude', 'budeme', 'budete', 'budou'],
    },
    { ...head('byyt'), ...vyjm('ý') },
  ),
  noun(
    'bytost',
    { gender: 'f', pattern: 'kost' },
    ['bytost', 'bytosti', 'bytosti', 'bytost', 'bytosti', 'bytosti', 'bytostí'],
    ['bytosti', 'bytostí', 'bytostem', 'bytosti', 'bytosti', 'bytostech', 'bytostmi'],
    { ...member('byyt'), ...vyjm('y') },
  ),
  adjective('bývalý', { ...member('byyt'), ...vyjm('ý') }),
  noun(
    'byt',
    { gender: 'm', animate: false, pattern: 'hrad' },
    ['byt', 'bytu', 'bytu', 'byt', 'byte', ['bytě', 'bytu'], 'bytem'],
    ['byty', 'bytů', 'bytům', 'byty', 'byty', 'bytech', 'byty'],
    { ...head('byt'), ...vyjm('y') },
  ),
  adjective('bytový', { ...member('byt'), ...vyjm('y') }),
  noun(
    'byteček',
    { gender: 'm', animate: false, pattern: 'hrad' },
    ['byteček', 'bytečku', 'bytečku', 'byteček', 'bytečku', 'bytečku', 'bytečkem'],
    ['bytečky', 'bytečků', 'bytečkům', 'bytečky', 'bytečky', 'bytečcích', 'bytečky'],
    { ...member('byt'), ...vyjm('y') },
  ),
  verb(
    'bít',
    {
      inf: 'bít',
      pres: [['biju', 'biji'], 'biješ', 'bije', 'bijeme', 'bijete', ['bijí', 'bijou']],
      imp: ['bij', 'bijme', 'bijte'],
      past: past('bil'),
    },
    head('biit'),
  ),
  noun(
    'bitva',
    { gender: 'f', pattern: 'zena' },
    ['bitva', 'bitvy', 'bitvě', 'bitvu', 'bitvo', 'bitvě', 'bitvou'],
    ['bitvy', 'bitev', 'bitvám', 'bitvy', 'bitvy', 'bitvách', 'bitvami'],
    member('biit'),
  ),
  adjective('bitevní', member('biit')),
  adjective('bystrý', { ...head('bystryy'), ...vyjm('y') }),
  adjective('bystrozraký', { ...member('bystryy'), ...vyjm('y') }),
  noun(
    'bylina',
    { gender: 'f', pattern: 'zena' },
    ['bylina', 'byliny', 'bylině', 'bylinu', 'bylino', 'bylině', 'bylinou'],
    ['byliny', 'bylin', 'bylinám', 'byliny', 'byliny', 'bylinách', 'bylinami'],
    { ...head('bylina'), ...vyjm('y') },
  ),
  adjective('bylinkový', { ...member('bylina'), ...vyjm('y') }),
  noun('pyl', { gender: 'm', animate: false, pattern: 'hrad' }, ...likeHrad('pyl'), {}),
  verb(
    'pít',
    {
      inf: 'pít',
      pres: [['piju', 'piji'], 'piješ', 'pije', 'pijeme', 'pijete', ['pijí', 'pijou']],
      imp: ['pij', 'pijme', 'pijte'],
      past: past('pil'),
    },
    {},
  ),
  noun(
    'výr',
    { gender: 'm', animate: true, pattern: 'pan' },
    ['výr', 'výra', 'výrovi', 'výra', 'výre', 'výrovi', 'výrem'],
    ['výři', 'výrů', 'výrům', 'výry', 'výři', 'výrech', 'výry'],
    {},
  ),
  noun('vír', { gender: 'm', animate: false, pattern: 'hrad' }, ...likeHrad('vír'), {}),
];

function family(
  id: string,
  letter: ListedLetter | null,
  order: number | null,
  root: string,
  more: Partial<WordFamily> = {},
): WordFamily {
  return { id, letter, head: id, order, core: letter !== null, root, kin: [], src: SRC, ...more };
}

/**
 * The lagoon fixture with BOARD_WORDS. byt names být as its kin; `symmetricKin` has být name byt
 * too (the contract does not say whether kin is listed on one side or on both).
 */
function boardLagoon(symmetricKin: boolean): Data {
  const json = lagoonPackJson();
  const lexicon = (json.data as ContentData).lexicon;
  lexicon.words.push(...BOARD_WORDS);
  lexicon.families.push(
    family('syn', 's', 1, 'syn'),
    family('sytyy', 's', 2, 'syt'),
    family('syyr', 's', 3, 'sýr'),
    family('syrovyy', 's', 4, 'syr'),
    family('sychravyy', 's', 5, 'sychr'),
    family('byyt', 'b', 1, 'bý', { soundAlike: 'biit', kin: symmetricKin ? ['byt'] : [] }),
    family('byt', 'b', 4, 'byt', { kin: ['byyt'] }),
    family('biit', null, null, 'bi', { soundAlike: 'byyt' }),
    family('bystryy', 'b', 9, 'bystr'),
    family('bylina', 'b', 10, 'byl'),
  );
  lexicon.relations.soundAlikes.push(
    ['byyt', 'biit'],
    ['pyl', { word: 'piit', form: 'pil' }],
    ['vyyr', 'viir'],
  );
  return requireValue(validateContent(json, contentRegistration, 'board-lagoon')).data;
}

const LAGOON: Data = lagoonPack().data;
const MINI: Data = miniPack().data;
const BOARD_LAGOON = boardLagoon(false);
const SYMMETRIC_KIN = boardLagoon(true);

const testSkill = (id: string, strand: Skill['strand']) => ({
  id: `sk.test.${id}`,
  titleKey: `skill.test.${id}`,
  strand,
});
const ABC8: Skill = {
  ...testSkill('abc8', 'letters-sounds'),
  generator: 'alphabet',
  params: { words: {}, order: 'alphabet', size: 8 },
};
/** Six pearls of any lexicon word: the necklace's order rules on pools of the tests' own. */
const ABC6: Skill = {
  ...testSkill('abc6', 'letters-sounds'),
  generator: 'alphabet',
  params: { words: {}, order: 'alphabet', size: 6 },
};
const RHYME_S: Skill = {
  ...testSkill('rhyme-s', 'listed-words'),
  generator: 'alphabet',
  params: { words: { letters: ['s'] }, order: 'rhyme', size: 4 },
};
const RHYME_B: Skill = {
  ...testSkill('rhyme-b', 'listed-words'),
  generator: 'alphabet',
  params: { words: { letters: ['b'] }, order: 'rhyme', size: 6 },
};
const PATTERN_PAIRS: Skill = {
  ...testSkill('pattern-pairs', 'nouns'),
  generator: 'pairs',
  params: { pair: 'pattern', words: { pos: ['noun'] }, pairs: 6 },
};
const STANDARD_PAIRS: Skill = {
  ...testSkill('standard-pairs', 'standard-czech'),
  generator: 'pairs',
  params: { pair: 'standard', words: { registers: ['colloquial'] }, pairs: 3 },
};
const SOUND_PAIRS: Skill = {
  ...testSkill('sound-pairs', 'listed-words'),
  generator: 'pairs',
  params: { pair: 'sound-alike', words: {}, pairs: 3 },
};
const FAMILY_PAIRS: Skill = {
  ...testSkill('family-pairs', 'word-meaning'),
  generator: 'pairs',
  params: { pair: 'family', words: {}, pairs: 6 },
};
const GENDER_NETS: Skill = {
  ...testSkill('gender-nets', 'nouns'),
  generator: 'sort',
  params: {
    dimension: 'gender',
    context: 'word',
    values: ['m', 'f', 'n'],
    words: { pos: ['noun'] },
    fish: 12,
    cells: null,
  },
};
const NUMBER_NETS: Skill = {
  ...testSkill('number-nets', 'nouns'),
  generator: 'sort',
  params: {
    dimension: 'number',
    context: 'form',
    values: ['sg', 'pl'],
    words: { topics: ['plural'] },
    fish: 8,
    cells: ['sg', 'pl'],
  },
};
const PREFIX_SHELL: Skill = {
  ...testSkill('prefix-shell', 'word-structure'),
  generator: 'segment',
  params: { words: { topics: ['stavba'] }, roles: ['prefix'] },
};
const ENDING_SHELL: Skill = {
  ...testSkill('ending-shell', 'word-structure'),
  generator: 'segment',
  params: { words: { topics: ['stavba'] }, roles: ['ending'] },
};
const familySkill = (families: string[] | null, distractors: number): Skill => ({
  ...testSkill('family', 'word-structure'),
  generator: 'family',
  params: { words: {}, families, pick: 8, distractors },
});

// ------------------------------------------------------------------------------ helpers

const STATE: ProfileState = initialProfileState({ dailyGoal: 30, race: true });
const SEEDS = Array.from({ length: 24 }, (_, seed) => seed);

interface OrderingConfig {
  items: { id: string; labelKey: string }[];
  solution: string[];
}
interface MatchingConfig {
  cards: { id: string; pair: string; labelKey: string; backLabelKey: string }[];
}
const cards = (def: MinigameDefinition) => (def.config as unknown as MatchingConfig).cards;

function request(
  data: Data,
  activity: MinigameActivityKind,
  skills: BoardRequest['skills'],
  pool: readonly string[],
  seed: number,
  more: Partial<BoardRequest> = {},
): BoardRequest {
  return {
    activity,
    id: 'r1.b1',
    board: 1,
    boards: 2,
    pool,
    focus: null,
    skills,
    previous: null,
    state: STATE,
    data,
    random: createPrng(`problems/${seed}`),
    words: createPrng(`words/${seed}`),
    ...more,
  };
}

/** The second board of the round whose first board was `previous`. */
const second = (previous: MinigameDefinition): Partial<BoardRequest> => ({
  id: 'r1.b2',
  board: 2,
  previous,
});

function made(definition: MinigameDefinition | null): MinigameDefinition {
  expect(definition, 'a board').not.toBeNull();
  return definition!;
}

/** The skills, the item pool and the index of a fixture level's minigame activity. */
function activity(data: Data, level: string, kind: MinigameActivityKind) {
  const activities = data.levels.find((l) => l.id === level)?.activities ?? [];
  const index = activities.findIndex((a) => a.kind === kind);
  expect(index, `${level} ${kind}`).toBeGreaterThanOrEqual(0);
  const found = activities[index]!;
  return {
    index,
    skills: data.skills.filter((skill) => found.skills.includes(skill.id)),
    pool: itemsOf(found.skills, itemIndex(data)),
  };
}

/** Every state of a game: the new board, then one per move. */
function run(def: MinigameDefinition, moves: readonly MinigameMove[]): MinigameState[] {
  const states = [createMinigame(def, def.id, MINIGAMES)];
  for (const move of moves) {
    const state = states[states.length - 1]!;
    states.push(
      reduceMinigame(
        def,
        state,
        { type: 'move', revision: state.revision, value: move as Json },
        MINIGAMES,
      ),
    );
  }
  return states;
}

/** The typed board, as the round view projects it. */
function viewOf<K extends BoardView['kind']>(
  kind: K,
  data: Data,
  def: MinigameDefinition,
  state: MinigameState,
): Extract<BoardView, { kind: K }> {
  const view = boardView(data, def, state, projectMinigame(def, state, MINIGAMES).view);
  expect(view.kind).toBe(kind);
  return view as Extract<BoardView, { kind: K }>;
}

/** What the last move of `states` earned. */
const lastCredit = (def: MinigameDefinition, states: MinigameState[], pool: readonly string[]) =>
  boardCredits(def, states.at(-2)!, states.at(-1)!, new Set(pool));

const word = (data: Data, id: string) => {
  const found = lexiconIndex(data).words.get(id);
  expect(found, id).toBeDefined();
  return found!;
};
const lemma = (data: Data, id: string) => word(data, id).lemma;
const preferred = (cell: DeepReadonly<string | string[]>) =>
  typeof cell === 'string' ? cell : cell[0]!;

/** Letters that sort with their base letter in Czech (contract language.ts); others do not. */
const TIE_ONLY: Readonly<Record<string, string>> = {
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
const primaryLetters = (text: string) => czechLetters(text).map((l) => TIE_ONLY[l] ?? l);
const firstLetter = (text: string) => primaryLetters(text)[0]!;
/** Two words only diacritics tell apart (pas, pás). */
const diacriticTie = (a: string, b: string) =>
  a !== b && primaryLetters(a).join('|') === primaryLetters(b).join('|');

/** The heads of the core listed families of `letter`, in the school rhyme's order. */
function rhyme(data: Data, letter: ListedLetter): string[] {
  return data.lexicon.families
    .filter((f) => f.letter === letter && f.core && f.order !== null)
    .sort((a, b) => a.order! - b.order!)
    .map((f) => f.head);
}

const consonantClass = (letter: string) =>
  (HARD_CONSONANTS as readonly string[]).includes(letter)
    ? 'hard'
    : (SOFT_CONSONANTS as readonly string[]).includes(letter)
      ? 'soft'
      : (BOTH_WAY_CONSONANTS as readonly string[]).includes(letter)
        ? 'both-way'
        : null;

const counts = (values: readonly (string | number)[]) => {
  const map = new Map<string | number, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
};

// ------------------------------------------------------------------------------ tests

describe('the test content', () => {
  it('is a valid lexicon and the hand-made skills are valid skills', () => {
    expect(validateLexicon(BOARD_LAGOON.lexicon)).toEqual([]);
    expect(validateLexicon(SYMMETRIC_KIN.lexicon)).toEqual([]);
    for (const skill of [
      ABC8,
      RHYME_S,
      RHYME_B,
      PATTERN_PAIRS,
      STANDARD_PAIRS,
      SOUND_PAIRS,
      FAMILY_PAIRS,
      GENDER_NETS,
      NUMBER_NETS,
      PREFIX_SHELL,
      ENDING_SHELL,
      familySkill(['byyt'], 2),
      familySkill(null, 2),
    ]) {
      expect(skillSchema.parse(skill).ok, skill.id).toBe(true);
    }
  });
});

describe('making boards', () => {
  it('knows the narrative kind behind every minigame activity', () => {
    for (const kind of Object.values(MINIGAME_KIND_BY_ACTIVITY)) {
      expect(MINIGAMES.get(kind).kind).toBe(kind);
    }
  });

  it('makes valid boards of the activity’s narrative kind for every lagoon minigame activity', () => {
    const kinds = new Set<string>();
    for (const level of LAGOON.levels) {
      level.activities.forEach((act, index) => {
        if (!isMinigameKind(act.kind)) return;
        const kind = act.kind;
        const { skills, pool } = activity(LAGOON, level.id, kind);
        expect(canMakeBoard(LAGOON, kind, pool, skills, STATE), `${level.id}#${index}`).toBe(true);
        for (const seed of SEEDS) {
          const def = made(makeBoard(request(LAGOON, kind, skills, pool, seed)));
          expect(def.kind).toBe(MINIGAME_KIND_BY_ACTIVITY[kind]);
          const state = createMinigame(def, def.id, MINIGAMES);
          expect(state.status).toBe('active');
          viewOf(kind, LAGOON, def, state);
        }
        kinds.add(kind);
      });
    }
    expect([...kinds].sort()).toEqual([
      'fishing-nets',
      'memory-match',
      'pearl-necklace',
      'word-family',
      'word-shell',
    ]);
  });

  it('makes boards for every minigame activity of the game’s pack', () => {
    const real = realPack().data;
    const index = itemIndex(real);
    const failing: string[] = [];
    for (const level of real.levels) {
      level.activities.forEach((act, at) => {
        if (!isMinigameKind(act.kind)) return;
        const where = `${level.id}#${at} ${act.kind} ${act.skills.join(' ')}`;
        const skills = real.skills.filter((skill) => act.skills.includes(skill.id));
        const pool = itemsOf(act.skills, index);
        if (!canMakeBoard(real, act.kind, pool, skills, STATE)) failing.push(where);
        for (const seed of SEEDS.slice(0, 8)) {
          const def = makeBoard(request(real, act.kind, skills, pool, seed));
          if (def === null) {
            failing.push(`${where} (seed ${seed})`);
            continue;
          }
          expect(createMinigame(def, def.id, MINIGAMES).status, where).toBe('active');
        }
      });
    }
    expect(failing).toEqual([]);
  });

  it('canMakeBoard is false for an activity whose pool cannot make a board', () => {
    // The mini pack: its word shell plays; its Pexeso cannot, mlýn ↔ mlynář is its only pair.
    const miniShell = activity(MINI, 'moon-caves.1', 'word-shell');
    expect(canMakeBoard(MINI, 'word-shell', miniShell.pool, miniShell.skills, STATE)).toBe(true);
    const miniPairs = activity(MINI, 'sunny-lagoon.1', 'memory-match');
    expect(miniPairs.pool).toEqual(['pair:family:mlynaarx', 'pair:family:mlyyn']);
    expect(canMakeBoard(MINI, 'memory-match', miniPairs.pool, miniPairs.skills, STATE)).toBe(false);

    const abc = activity(LAGOON, 'sunny-lagoon.1', 'pearl-necklace');
    const nets = activity(LAGOON, 'sunny-lagoon.1', 'fishing-nets');
    const shell = activity(LAGOON, 'moon-caves.1', 'word-shell');
    const families = activity(LAGOON, 'moon-caves.1', 'word-family');
    const hardOnly = itemsOf(['sk.lagoon.letters.hard'], itemIndex(LAGOON));
    const cannot: [
      string,
      Data,
      MinigameActivityKind,
      readonly string[],
      BoardRequest['skills'],
    ][] = [
      ['two pearls', LAGOON, 'pearl-necklace', abc.pool.slice(0, 2), abc.skills],
      ['fish for one net only', LAGOON, 'fishing-nets', hardOnly, nets.skills],
      ['no word with a prefix', LAGOON, 'word-shell', ['seg:les', 'seg:voda'], [PREFIX_SHELL]],
      ['a family of one word', MINI, 'word-family', ['fam:byyt'], [familySkill(null, 2)]],
      ['no skill of the activity', LAGOON, 'memory-match', abc.pool, abc.skills],
      ['no family words in the pool', LAGOON, 'word-family', [], families.skills],
      ['no words in the pool', LAGOON, 'word-shell', [], shell.skills],
    ];
    for (const [why, data, kind, pool, skills] of cannot) {
      expect(canMakeBoard(data, kind, pool, skills, STATE), why).toBe(false);
    }
  });

  it('canMakeBoard depends on the content only, not on the profile', () => {
    const later: ProfileState = {
      ...STATE,
      coins: 120,
      roundCounter: 7,
      settings: { ...STATE.settings, grade: 4 },
    };
    for (const level of LAGOON.levels) {
      for (const act of level.activities) {
        if (!isMinigameKind(act.kind)) continue;
        const { skills, pool } = activity(LAGOON, level.id, act.kind);
        expect(canMakeBoard(LAGOON, act.kind, pool, skills, later)).toBe(
          canMakeBoard(LAGOON, act.kind, pool, skills, STATE),
        );
      }
    }
  });

  it('is deterministic: the same streams make the same boards', () => {
    for (const level of LAGOON.levels) {
      for (const act of level.activities) {
        if (!isMinigameKind(act.kind)) continue;
        const { skills, pool } = activity(LAGOON, level.id, act.kind);
        for (const seed of SEEDS.slice(0, 6)) {
          expect(makeBoard(request(LAGOON, act.kind, skills, pool, seed))).toEqual(
            makeBoard(request(LAGOON, act.kind, skills, pool, seed)),
          );
        }
      }
    }
  });
});

describe('Perlový náhrdelník boards (built-in ordering)', () => {
  const abc = activity(LAGOON, 'sunny-lagoon.1', 'pearl-necklace');
  const config = (def: MinigameDefinition) => def.config as unknown as OrderingConfig;
  const lemmas = (data: Data, def: MinigameDefinition) =>
    config(def).solution.map((id) => lemma(data, id));
  const words = (...ids: string[]) => ids.map((id) => `abc:${id}`);

  it('threads the skill’s number of pearls in Czech alphabetical order, never dealt in order', () => {
    expect(abc.skills[0]).toMatchObject({ params: { order: 'alphabet', size: 6 } });
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(LAGOON, 'pearl-necklace', abc.skills, abc.pool, seed)));
      const { items, solution } = config(def);
      expect(def.id).toBe('r1.b1.alphabet');
      expect(items).toHaveLength(6);
      expect(items.map((item) => item.labelKey)).toEqual(items.map((item) => `word:${item.id}`));
      expect(items.map((item) => item.id).sort()).toEqual([...solution].sort());
      expect(solution.every((id) => abc.pool.includes(`abc:${id}`))).toBe(true);
      expect(lemmas(LAGOON, def)).toEqual([...lemmas(LAGOON, def)].sort(compareCzech));
      expect(items.map((item) => item.id)).not.toEqual(solution);
    }
  });

  it('puts ch after h, and č, ř, š, ž after c, r, s, z; other accents only break ties', () => {
    const pool = words('zxirafa', 'chyba', 'sxipka', 'hrad', 'cxistyy', 'zub', 'stuol', 'cibule');
    // A later necklace of the round may thread words of one first letter.
    const later = words('morxe', 'duom', 'mexsto', 'dyynex', 'morava', 'dexda', 'maak', 'draaha');
    for (const seed of SEEDS.slice(0, 6)) {
      const def = made(makeBoard(request(LAGOON, 'pearl-necklace', [ABC8], pool, seed)));
      expect(lemmas(LAGOON, def)).toEqual([
        'cibule',
        'čistý',
        'hrad',
        'chyba',
        'stůl',
        'šipka',
        'zub',
        'žirafa',
      ]);
      const next = made(
        makeBoard(request(LAGOON, 'pearl-necklace', [ABC8], later, seed, { board: 2 })),
      );
      expect(lemmas(LAGOON, next)).toEqual([
        'děda',
        'dráha',
        'dům',
        'dýně',
        'mák',
        'město',
        'Morava',
        'moře',
      ]);
    }
  });

  it('gives the first necklace of a round different first letters; the next may repeat one', () => {
    // m: mák, město; d: dýně, dům, dráha; l: led, les; h: hrad.
    const pool = words('maak', 'mexsto', 'dyynex', 'duom', 'draaha', 'led', 'les', 'hrad');
    for (const seed of SEEDS) {
      const first = made(makeBoard(request(LAGOON, 'pearl-necklace', [ABC6], pool, seed)));
      expect(lemmas(LAGOON, first).map(firstLetter).sort()).toEqual(['d', 'h', 'l', 'm']);
      const next = made(
        makeBoard(request(LAGOON, 'pearl-necklace', [ABC6], pool, seed + 100, second(first))),
      );
      const letters = lemmas(LAGOON, next).map(firstLetter);
      expect(letters).toHaveLength(6);
      expect(new Set(letters).size).toBeLessThan(6);
    }
  });

  it('never threads two words that only diacritics tell apart (pas, pás)', () => {
    const pool = words('pas', 'paas', 'maak', 'ryba', 'led', 'hrad', 'kytara');
    for (const seed of SEEDS) {
      const first = made(makeBoard(request(LAGOON, 'pearl-necklace', [ABC6], pool, seed)));
      const next = made(
        makeBoard(request(LAGOON, 'pearl-necklace', [ABC6], pool, seed + 100, second(first))),
      );
      for (const def of [first, next]) {
        const threaded = lemmas(LAGOON, def);
        const ties = threaded.flatMap((a) => threaded.filter((b) => diacriticTie(a, b)));
        expect(ties, threaded.join()).toEqual([]);
      }
      expect(config(next).solution).toHaveLength(6);
    }
  });

  it('threads each board from its own skill’s words, the round’s skills in turn', () => {
    // Želva's alphabet beside another necklace skill (S3's lesson 1): her board threads her words.
    const own = (id: string, ids: string[]): Skill => ({
      ...testSkill(id, 'letters-sounds'),
      generator: 'alphabet',
      params: { words: { words: ids }, order: 'alphabet', size: 3 },
    });
    const m = ['hrad', 'led', 'maak', 'ryba'];
    const d = ['les', 'mexsto', 'dyynex', 'zub'];
    const skills = [own('abc-m', m), own('abc-d', d)];
    const pool = words(...m, ...d);
    for (const seed of SEEDS) {
      const first = made(makeBoard(request(LAGOON, 'pearl-necklace', skills, pool, seed)));
      expect(config(first).solution.every((id) => m.includes(id))).toBe(true);
      const next = made(
        makeBoard(request(LAGOON, 'pearl-necklace', skills, pool, seed + 100, second(first))),
      );
      expect(config(next).solution.every((id) => d.includes(id))).toBe(true);
    }
  });

  it('threads first the words the previous necklace left out', () => {
    for (const seed of SEEDS) {
      const first = made(makeBoard(request(LAGOON, 'pearl-necklace', abc.skills, abc.pool, seed)));
      const left = abc.pool
        .map((item) => item.slice('abc:'.length))
        .filter((id) => !config(first).solution.includes(id));
      const next = made(
        makeBoard(
          request(LAGOON, 'pearl-necklace', abc.skills, abc.pool, seed + 100, second(first)),
        ),
      );
      expect(config(next).solution).toEqual(expect.arrayContaining(left));
    }
  });

  it('threads a run of a letter’s school rhyme in the families’ order: heads of core families', () => {
    const pool = skillItems(RHYME_S, BOARD_LAGOON.lexicon);
    expect(pool).toContain('abc:synovskyy');
    const line = rhyme(BOARD_LAGOON, 's');
    expect(line.map((id) => lemma(BOARD_LAGOON, id))).toEqual([
      'syn',
      'sytý',
      'sýr',
      'syrový',
      'sychravý',
    ]);
    const runs = new Set<string>();
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(BOARD_LAGOON, 'pearl-necklace', [RHYME_S], pool, seed)));
      expect(def.id).toBe('r1.b1.rhyme.s');
      const { items, solution } = config(def);
      const start = line.indexOf(solution[0]!);
      expect(solution).toEqual(line.slice(start, start + 4));
      expect(items.map((item) => item.id)).not.toEqual(solution);
      // The rhyme, not the alphabet: syn, sytý, sýr, syrový is not alphabetical.
      expect(lemmas(BOARD_LAGOON, def)).not.toEqual(
        [...lemmas(BOARD_LAGOON, def)].sort(compareCzech),
      );
      runs.add(solution.join());
    }
    expect(runs.size).toBe(2);
  });

  it('puts být before byt in the rhyme of b, though the alphabet puts byt first', () => {
    const pool = skillItems(RHYME_B, BOARD_LAGOON.lexicon);
    const def = made(makeBoard(request(BOARD_LAGOON, 'pearl-necklace', [RHYME_B], pool, 1)));
    expect(def.id).toBe('r1.b1.rhyme.b');
    expect(lemmas(BOARD_LAGOON, def)).toEqual(['být', 'byt', 'bystrý', 'bylina']);
    expect(compareCzech('byt', 'být')).toBeLessThan(0);
  });

  it('never threads the previous rhyme necklace again while another run is possible', () => {
    // A line of five heads makes two runs of four: the round's second necklace is the other run.
    const pool = skillItems(RHYME_S, BOARD_LAGOON.lexicon);
    const repeated: number[] = [];
    for (const seed of SEEDS) {
      const first = made(makeBoard(request(BOARD_LAGOON, 'pearl-necklace', [RHYME_S], pool, seed)));
      const next = made(
        makeBoard(
          request(BOARD_LAGOON, 'pearl-necklace', [RHYME_S], pool, seed + 100, second(first)),
        ),
      );
      if (config(next).solution.join() === config(first).solution.join()) repeated.push(seed);
    }
    expect(repeated, 'seeds whose second necklace repeats the first').toEqual([]);
  });

  it('reads the order and the letter back from the definition ID', () => {
    expect(necklaceShape('r3.b1.alphabet')).toEqual({ order: 'alphabet', letter: null });
    expect(necklaceShape('r3.b2.rhyme.s')).toEqual({ order: 'rhyme', letter: 's' });
    expect(necklaceShape('r3.b2.rhyme.b')).toEqual({ order: 'rhyme', letter: 'b' });
    expect(necklaceShape('r3.b2.rhyme.x')).toEqual({ order: 'alphabet', letter: null });
  });

  it('projects the pearls in their current order with their lemmas', () => {
    const def = made(makeBoard(request(LAGOON, 'pearl-necklace', abc.skills, abc.pool, 5)));
    const { items, solution } = config(def);
    const states = run(def, [{ type: 'place', item: solution[0]!, index: 0 }]);
    expect(viewOf('pearl-necklace', LAGOON, def, states[0]!)).toEqual({
      kind: 'pearl-necklace',
      order: 'alphabet',
      letter: null,
      pearls: items.map((item) => ({
        id: item.id,
        word: item.id,
        text: lemma(LAGOON, item.id),
        inPlace: false,
      })),
      submitted: false,
      attempts: 0,
    });
    const moved = viewOf('pearl-necklace', LAGOON, def, states[1]!);
    expect(moved.pearls[0]!.id).toBe(solution[0]);
    expect(moved.pearls.map((pearl) => pearl.id).sort()).toEqual([...solution].sort());
    // A wrong check (pearls are never dealt in order) stays on the string, editable.
    const checked = run(def, [{ type: 'submit' }]);
    expect(checked[1]!.status).toBe('active');
    expect(viewOf('pearl-necklace', LAGOON, def, checked[1]!)).toMatchObject({
      pearls: viewOf('pearl-necklace', LAGOON, def, checked[0]!).pearls.map((pearl, index) => ({
        ...pearl,
        inPlace: pearl.id === solution[index],
      })),
      submitted: true,
      attempts: 1,
    });

    const pool = skillItems(RHYME_S, BOARD_LAGOON.lexicon);
    const rhymeDef = made(makeBoard(request(BOARD_LAGOON, 'pearl-necklace', [RHYME_S], pool, 2)));
    const rhymeView = viewOf(
      'pearl-necklace',
      BOARD_LAGOON,
      rhymeDef,
      createMinigame(rhymeDef, rhymeDef.id, MINIGAMES),
    );
    expect(rhymeView).toMatchObject({ order: 'rhyme', letter: 's' });
    expect(rhymeView.pearls.map((pearl) => pearl.text)).toEqual(
      config(rhymeDef).items.map((item) => lemma(BOARD_LAGOON, item.id)),
    );
  });

  it('marks the pearls in their place after a wrong check, never before it, until the next move', () => {
    let wrongChecks = 0;
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(LAGOON, 'pearl-necklace', abc.skills, abc.pool, seed)));
      const { solution } = config(def);
      const view = (state: MinigameState) => viewOf('pearl-necklace', LAGOON, def, state);
      const marks = (state: MinigameState) => view(state).pearls.map((pearl) => pearl.inPlace);
      const [dealt, threaded, checked, moved] = run(def, [
        { type: 'place', item: solution[0]!, index: 0 },
        { type: 'submit' },
        { type: 'place', item: solution[1]!, index: 1 },
      ]);
      // Before a check nothing is marked, not even pearls the deal or a move put in place.
      expect(marks(dealt!).some(Boolean), `seed ${seed}: dealt`).toBe(false);
      expect(marks(threaded!).some(Boolean), `seed ${seed}: threaded`).toBe(false);
      if (checked!.status !== 'active') continue;
      wrongChecks += 1;
      expect(
        view(checked!).pearls.map(
          (pearl, index) => pearl.inPlace === (pearl.id === solution[index]),
        ),
        `seed ${seed}: checked`,
      ).not.toContain(false);
      expect(view(checked!).pearls[0]!.inPlace, `seed ${seed}: the first pearl`).toBe(true);
      expect(marks(checked!), `seed ${seed}: a wrong check`).toContain(false);
      expect(marks(moved!).some(Boolean), `seed ${seed}: moved`).toBe(false);
    }
    expect(wrongChecks).toBeGreaterThan(SEEDS.length / 2);
  });

  it('credits every pearl fast at a right first check, slow after a wrong one; a coin a pearl', () => {
    const def = made(makeBoard(request(LAGOON, 'pearl-necklace', abc.skills, abc.pool, 2)));
    const { solution } = config(def);
    const thread = solution.map((item, index): MinigameMove => ({ type: 'place', item, index }));
    const credits = (bucket: string, ids = solution) =>
      ids.map((id) => ({ item: `abc:${id}`, bucket }));

    const right = run(def, [...thread, { type: 'submit' }]);
    expect(right.at(-1)!.status).toBe('completed');
    expect(lastCredit(def, right, abc.pool)).toEqual({ items: credits('fast'), coins: 6 });
    // Moving pearls earns nothing.
    expect(boardCredits(def, right[0]!, right[1]!, new Set(abc.pool))).toEqual({
      items: [],
      coins: 0,
    });

    const retried = run(def, [{ type: 'submit' }, ...thread, { type: 'submit' }]);
    expect(boardCredits(def, retried[0]!, retried[1]!, new Set(abc.pool))).toEqual({
      items: [],
      coins: 0,
    });
    expect(lastCredit(def, retried, abc.pool)).toEqual({ items: credits('slow'), coins: 6 });

    // Only the round's items are credited; every pearl still earns its coin.
    const pool = abc.pool.filter((item) => item !== `abc:${solution[0]}`);
    expect(lastCredit(def, right, pool)).toEqual({
      items: credits('fast', solution.slice(1)),
      coins: 6,
    });
  });
});

describe('Pexeso boards (built-in matching)', () => {
  const plural = activity(LAGOON, 'sunny-lagoon.5', 'memory-match');
  /** The two labels of each pair, by the pair's item. */
  const pairsOf = (def: MinigameDefinition) => {
    const pairs = new Map<string, string[]>();
    for (const card of cards(def))
      pairs.set(card.pair, [...(pairs.get(card.pair) ?? []), card.labelKey]);
    return pairs;
  };
  /** What a card shows: a pattern card shows "vzor <pattern word>". */
  const shown = (data: Data, label: string) => {
    const face = parseFace(data, label)!;
    return face.kind === 'word' || face.kind === 'form'
      ? face.text
      : face.kind === 'pattern'
        ? `vzor ${PATTERN_WORD[face.pattern]}`
        : `${face.dimension}:${face.value}`;
  };

  /** What every memory board keeps: 3-8 pairs of the pool, faces of §12.1, no look-alikes. */
  function checkDeck(data: Data, def: MinigameDefinition, pool: readonly string[], pairs: number) {
    const deck = cards(def);
    expect(def.kind).toBe('matching');
    expect(pairs).toBeGreaterThanOrEqual(3);
    expect(pairs).toBeLessThanOrEqual(8);
    expect(pairsOf(def).size).toBe(pairs);
    expect([...pairsOf(def).values()].every((labels) => labels.length === 2)).toBe(true);
    expect([...pairsOf(def).keys()].every((item) => pool.includes(item))).toBe(true);
    expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
    expect(deck.every((card) => card.backLabelKey === CARD_BACK_LABEL)).toBe(true);
    for (const card of deck) {
      expect(card.labelKey).toMatch(
        /^(word:[a-z0-9.-]+|form:[a-z0-9.-]+:[a-z0-9]+|pattern:[a-z]+)$/,
      );
      const face = parseFace(data, card.labelKey);
      expect(face, card.labelKey).not.toBeNull();
      expect(cardLabel(face!)).toBe(card.labelKey);
    }
    const texts = deck.map((card) => shown(data, card.labelKey));
    expect(new Set(texts).size, texts.join(', ')).toBe(texts.length);
  }

  it('pairs a noun with its plural, word:<noun> ↔ form:<noun>:pl1 (the paradigm’s plural)', () => {
    expect(plural.skills[0]).toMatchObject({ params: { pair: 'plural', pairs: 4 } });
    for (const seed of SEEDS) {
      const def = made(
        makeBoard(request(LAGOON, 'memory-match', plural.skills, plural.pool, seed)),
      );
      expect(def.id).toBe('r1.b1.pairs.plural');
      checkDeck(LAGOON, def, plural.pool, 4);
      for (const [item, labels] of pairsOf(def)) {
        const id = item.slice('pair:plural:'.length);
        expect([...labels].sort()).toEqual([`form:${id}:pl1`, `word:${id}`]);
        const noun = word(LAGOON, id);
        expect(parseFace(LAGOON, `word:${id}`)).toEqual({
          kind: 'word',
          word: id,
          text: noun.lemma,
        });
        expect(parseFace(LAGOON, `form:${id}:pl1`)).toEqual({
          kind: 'form',
          word: id,
          cell: 'pl1',
          text: preferred(noun.noun!.paradigm!.pl![0]!),
        });
      }
    }
  });

  it('pairs a noun with its pattern, each pattern once', () => {
    const pool = skillItems(PATTERN_PAIRS, LAGOON.lexicon);
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(LAGOON, 'memory-match', [PATTERN_PAIRS], pool, seed)));
      expect(memoryPairKind(def.id)).toBe('pattern');
      checkDeck(LAGOON, def, pool, 6);
      const patterns: string[] = [];
      for (const [item, labels] of pairsOf(def)) {
        const id = item.slice('pair:pattern:'.length);
        const pattern = word(LAGOON, id).noun!.pattern!;
        expect([...labels].sort()).toEqual([`pattern:${pattern}`, `word:${id}`]);
        patterns.push(pattern);
      }
      // So no noun card matches another pair's pattern card.
      expect(new Set(patterns).size).toBe(6);
    }
  });

  it('pairs a colloquial word with its standard twin (the mini pack)', () => {
    const pool = skillItems(STANDARD_PAIRS, MINI.lexicon);
    expect(pool).toEqual(['pair:standard:bejt', 'pair:standard:dobrej', 'pair:standard:mlejn']);
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(MINI, 'memory-match', [STANDARD_PAIRS], pool, seed)));
      checkDeck(MINI, def, pool, 3);
      for (const [item, labels] of pairsOf(def)) {
        const colloquial = item.slice('pair:standard:'.length);
        const twin = word(MINI, colloquial).standard!;
        expect([...labels].sort()).toEqual([`word:${colloquial}`, `word:${twin}`].sort());
      }
    }
  });

  it('pairs sound-alikes, words or a form of one: být ↔ bít, pyl ↔ pil (pít), výr ↔ vír', () => {
    const pool = skillItems(SOUND_PAIRS, BOARD_LAGOON.lexicon);
    expect(pool).toEqual([
      'pair:sound-alike:biit',
      'pair:sound-alike:byyt',
      'pair:sound-alike:piit:pil',
      'pair:sound-alike:pyl',
      'pair:sound-alike:viir',
      'pair:sound-alike:vyyr',
    ]);
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(BOARD_LAGOON, 'memory-match', [SOUND_PAIRS], pool, seed)));
      checkDeck(BOARD_LAGOON, def, pool, 3);
      const pairs = [...pairsOf(def).values()]
        .map((labels) =>
          labels
            .map((label) => shown(BOARD_LAGOON, label))
            .sort()
            .join(' ↔ '),
        )
        .sort();
      expect(pairs).toEqual(['bít ↔ být', 'pil ↔ pyl', 'vír ↔ výr']);
    }
    expect(parseFace(BOARD_LAGOON, 'form:piit:past3')).toEqual({
      kind: 'form',
      word: 'piit',
      cell: 'past3',
      text: 'pil',
    });
  });

  it('deals a word’s sound-alike forms beside it: být ↔ bít, byl ↔ bil, byli ↔ bili (the game’s pack)', () => {
    // Cards of the same two words, told apart by sound only: none sounds like another pair's card.
    const real = realPack().data;
    const skill: Skill = {
      ...testSkill('pairs-byt', 'listed-words'),
      generator: 'pairs',
      params: { pair: 'sound-alike', words: { words: ['byyt', 'biit'] }, pairs: 3 },
    };
    const pool = skillItems(skill, real.lexicon);
    expect(pool).toEqual([
      'pair:sound-alike:biit',
      'pair:sound-alike:biit:bil',
      'pair:sound-alike:biit:bili',
      'pair:sound-alike:byyt',
      'pair:sound-alike:byyt:byl',
      'pair:sound-alike:byyt:byli',
    ]);
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(real, 'memory-match', [skill], pool, seed)));
      checkDeck(real, def, pool, 3);
      const pairs = [...pairsOf(def).values()]
        .map((labels) =>
          labels
            .map((label) => shown(real, label))
            .sort()
            .join(' ↔ '),
        )
        .sort();
      expect(pairs).toEqual(['bil ↔ byl', 'bili ↔ byli', 'bít ↔ být']);
    }
  });

  /** Families of the cards of each pair, and the families' kin (listed on either side). */
  function familyDecks(data: Data, seeds: readonly number[]) {
    const lexicon = lexiconIndex(data);
    const kin = (a: string, b: string) =>
      lexicon.families.get(a)!.kin.includes(b) || lexicon.families.get(b)!.kin.includes(a);
    const pool = skillItems(FAMILY_PAIRS, data.lexicon);
    return seeds.map((seed) => {
      const def = made(makeBoard(request(data, 'memory-match', [FAMILY_PAIRS], pool, seed)));
      checkDeck(data, def, pool, 6);
      const families = [...pairsOf(def).values()].map((labels) => {
        const [a, b] = labels.map((label) => word(data, label.slice('word:'.length)).family!.id);
        expect(a, labels.join()).toBe(b);
        return a!;
      });
      const clashes = families.flatMap((a, i) =>
        families.slice(i + 1).flatMap((b) => (a === b || kin(a, b) ? [`${a}/${b}`] : [])),
      );
      return { seed, clashes };
    });
  }

  it('deals family pairs of different families, never two of one family or of kin families', () => {
    const decks = familyDecks(SYMMETRIC_KIN, SEEDS);
    expect(decks.filter((deck) => deck.clashes.length > 0)).toEqual([]);
  });

  it('keeps kin families apart when only one of them lists the other as kin', () => {
    // Kin counts from either side: byt lists být as kin, být does not list byt.
    const decks = familyDecks(BOARD_LAGOON, SEEDS);
    expect(decks.filter((deck) => deck.clashes.length > 0)).toEqual([]);
  });

  it('parseFace reads every face label of contract §12.1 back to its card face', () => {
    const faces: [string, CardFace][] = [
      ['word:ryba', { kind: 'word', word: 'ryba', text: 'ryba' }],
      ['word:vltava', { kind: 'word', word: 'vltava', text: 'Vltava' }],
      ['form:ryba:pl1', { kind: 'form', word: 'ryba', cell: 'pl1', text: 'ryby' }],
      ['form:ryba:sg7', { kind: 'form', word: 'ryba', cell: 'sg7', text: 'rybou' }],
      ['form:duom:sg6', { kind: 'form', word: 'duom', cell: 'sg6', text: 'domě' }],
      ['pattern:zena', { kind: 'pattern', pattern: 'zena' }],
      ['cat:pos:noun', { kind: 'category', dimension: 'pos', value: 'noun' }],
      ['cat:consonant:both-way', { kind: 'category', dimension: 'consonant', value: 'both-way' }],
    ];
    for (const [label, face] of faces) {
      expect(parseFace(LAGOON, label), label).toEqual(face);
      expect(cardLabel(face)).toBe(label);
    }
    for (const label of [
      CARD_BACK_LABEL,
      'word:kapr',
      'word:ryba:pl1',
      'form:ryba',
      'form:ryba:pl9',
      'form:kapr:pl1',
      'pattern:kapr',
      'pattern:',
      'cat:pos',
      'ryba',
      '',
    ]) {
      expect(parseFace(LAGOON, label), label).toBeNull();
    }
  });

  it('parseFace gives no face for a category of no dimension or no value', () => {
    // A category face names one of the contract's dimensions and one of its values.
    expect(parseFace(LAGOON, 'cat:colour:red')).toBeNull();
    expect(parseFace(LAGOON, 'cat:pos:fish')).toBeNull();
  });

  it('reads the pair kind back from the definition ID', () => {
    for (const kind of PAIR_KINDS) expect(memoryPairKind(`r2.b1.pairs.${kind}`)).toBe(kind);
  });

  it('projects cards face down until turned, a mismatch up until cleared, pairs matched', () => {
    const def = made(makeBoard(request(LAGOON, 'memory-match', plural.skills, plural.pool, 7)));
    const deck = cards(def);
    const [p, q] = [...pairsOf(def).keys()];
    const of = (pair: string) => deck.filter((card) => card.pair === pair);
    const [p1, p2] = of(p!);
    const [q1] = of(q!);
    const select = (card: string): MinigameMove => ({ type: 'select', card });
    const states = run(def, [
      select(p1!.id),
      select(q1!.id),
      { type: 'clear' },
      select(p1!.id),
      select(p2!.id),
    ]);
    const views = states.map((state) => viewOf('memory-match', LAGOON, def, state));
    const faceUp = (card: { id: string; labelKey: string }, matched: boolean) => ({
      [card.id]: { face: parseFace(LAGOON, card.labelKey), matched },
    });
    /** The cards face up, by ID. */
    const up = (view: (typeof views)[number]) =>
      Object.fromEntries(
        view.cards
          .filter((card) => card.faceUp)
          .map((card) => [card.id, { face: card.face, matched: card.matched }]),
      );

    expect(views[0]).toMatchObject({ pair: 'plural', pairs: 4, matched: 0, attempts: 0 });
    expect(views[0]!.cards.map((card) => card.id)).toEqual(deck.map((card) => card.id));
    expect(views[0]!.cards.every((card) => card.face === null && !card.faceUp)).toBe(true);
    expect(up(views[1]!)).toEqual(faceUp(p1!, false));
    // A mismatch stays face up: only `clear` is possible now.
    expect(views[2]).toMatchObject({ clearAvailable: true, attempts: 1, matched: 0 });
    expect(up(views[2]!)).toEqual({ ...faceUp(p1!, false), ...faceUp(q1!, false) });
    expect(views[3]).toMatchObject({ clearAvailable: false });
    expect(up(views[3]!)).toEqual({});
    expect(views[3]!.cards.every((card) => card.face === null)).toBe(true);
    expect(views[5]).toMatchObject({ clearAvailable: false, matched: 1, attempts: 2 });
    expect(up(views[5]!)).toEqual({ ...faceUp(p1!, true), ...faceUp(p2!, true) });
    // The narrative projection shows only the back of every hidden card.
    const raw = projectMinigame(def, states[1]!, MINIGAMES).view as {
      cards: { id: string; labelKey: string }[];
    };
    expect(raw.cards.filter((card) => card.id !== p1!.id).map((card) => card.labelKey)).toEqual(
      Array.from({ length: deck.length - 1 }, () => CARD_BACK_LABEL),
    );
  });

  it('credits a pair found before any mismatch fast, later pairs ok; a coin a pair', () => {
    const def = made(makeBoard(request(LAGOON, 'memory-match', plural.skills, plural.pool, 3)));
    const deck = cards(def);
    const pairs = [...pairsOf(def).keys()];
    const of = (pair: string) => deck.filter((card) => card.pair === pair).map((card) => card.id);
    const select = (card: string): MinigameMove => ({ type: 'select', card });
    const [p, q, r] = pairs as [string, string, string];

    const clean = run(def, [select(of(p)[0]!), select(of(p)[1]!), select(of(q)[0]!)]);
    expect(boardCredits(def, clean[1]!, clean[2]!, new Set(plural.pool))).toEqual({
      items: [{ item: p, bucket: 'fast' }],
      coins: 1,
    });
    // Turning one card earns nothing.
    expect(lastCredit(def, clean, plural.pool)).toEqual({ items: [], coins: 0 });

    const after = run(def, [
      select(of(p)[0]!),
      select(of(p)[1]!),
      select(of(q)[0]!),
      select(of(r)[0]!),
      { type: 'clear' },
      select(of(q)[0]!),
      select(of(q)[1]!),
    ]);
    expect(lastCredit(def, after, plural.pool)).toEqual({
      items: [{ item: q, bucket: 'ok' }],
      coins: 1,
    });
    // The mismatch and the clear earn nothing; a pair outside the round earns its coin only.
    expect(boardCredits(def, after[3]!, after[4]!, new Set(plural.pool))).toEqual({
      items: [],
      coins: 0,
    });
    expect(
      lastCredit(
        def,
        after,
        plural.pool.filter((item) => item !== q),
      ),
    ).toEqual({
      items: [],
      coins: 1,
    });

    // Every pair found, none missed: all fast, a coin each.
    const moves = pairs.flatMap((pair) => of(pair).map(select));
    const states = run(def, moves);
    expect(states.at(-1)!.status).toBe('completed');
    const all = states
      .slice(1)
      .map((state, i) => boardCredits(def, states[i]!, state, new Set(plural.pool)));
    expect(all.flatMap((credit) => credit.items)).toEqual(
      pairs.map((item) => ({ item, bucket: 'fast' })),
    );
    expect(all.reduce((sum, credit) => sum + credit.coins, 0)).toBe(pairs.length);
  });

  it('deals pairs the previous board did not have', () => {
    for (const seed of SEEDS) {
      const first = made(
        makeBoard(request(LAGOON, 'memory-match', plural.skills, plural.pool, seed)),
      );
      const next = made(
        makeBoard(
          request(LAGOON, 'memory-match', plural.skills, plural.pool, seed + 100, second(first)),
        ),
      );
      const before = new Set(pairsOf(first).keys());
      expect([...pairsOf(next).keys()].filter((item) => before.has(item))).toEqual([]);
    }
  });

  it('never deals fewer than 3 pairs (design §5.8: 3-8 pairs)', () => {
    const pool = ['pair:plural:ryba', 'pair:plural:hrad'];
    expect(makeBoard(request(LAGOON, 'memory-match', plural.skills, pool, 1))).toBeNull();
  });
});

describe('Rybářské sítě boards (ps.sorting-nets)', () => {
  const nets = activity(LAGOON, 'sunny-lagoon.1', 'fishing-nets');
  const config = (def: MinigameDefinition) => def.config as unknown as SortingNetsConfig;
  const put = (fish: string, net: number | null): MinigameMove => ({ type: 'net', fish, net });
  const HAUL: MinigameMove = { type: 'submit' };

  /** What every nets board keeps: the skill's nets, fish of the pool, distinct texts. */
  function checkNets(
    def: MinigameDefinition,
    pool: readonly string[],
    values: string[],
    fish: number,
  ) {
    const { values: nets, fish: all } = config(def);
    expect(def.kind).toBe('ps.sorting-nets');
    expect(nets).toEqual(values);
    expect(all).toHaveLength(fish);
    expect(all.map((f) => f.id)).toEqual(Array.from({ length: fish }, (_, i) => `f${i + 1}`));
    expect(all.every((f) => pool.includes(f.item))).toBe(true);
    expect(new Set(all.map((f) => f.item)).size).toBe(fish);
    expect(new Set(all.map((f) => f.text)).size).toBe(fish);
    // Every net gets fish.
    expect([...counts(all.map((f) => f.net)).keys()].sort()).toEqual(values.map((_, i) => i));
  }

  it('sorts consonant letters into hard, soft and both-way nets by their class', () => {
    expect(nets.skills[0]).toMatchObject({ params: { dimension: 'consonant', fish: 9 } });
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(LAGOON, 'fishing-nets', nets.skills, nets.pool, seed)));
      checkNets(def, nets.pool, ['hard', 'soft', 'both-way'], 9);
      const { dimension, values, fish } = config(def);
      expect(dimension).toBe('consonant');
      expect([...counts(fish.map((f) => f.net)).values()]).toEqual([3, 3, 3]);
      for (const f of fish) {
        expect(f.word).toBeNull();
        expect(f.item).toBe(`class:consonant:${lexiconId(f.text)}`);
        expect(values[f.net], f.text).toBe(consonantClass(f.text));
      }
    }
  });

  it('sorts nouns by gender, each fish in the net of its lexicon gender', () => {
    const pool = skillItems(GENDER_NETS, LAGOON.lexicon);
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(LAGOON, 'fishing-nets', [GENDER_NETS], pool, seed)));
      checkNets(def, pool, ['m', 'f', 'n'], 12);
      for (const f of config(def).fish) {
        const noun = word(LAGOON, f.word!);
        expect(f.text).toBe(noun.lemma);
        expect(f.item).toBe(`class:gender:${f.word}`);
        expect(config(def).values[f.net], f.text).toBe(noun.noun!.gender);
      }
    }
  });

  it('sorts forms by number, each fish a paradigm form in the net its cell names', () => {
    const pool = skillItems(NUMBER_NETS, LAGOON.lexicon);
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(LAGOON, 'fishing-nets', [NUMBER_NETS], pool, seed)));
      checkNets(def, pool, ['sg', 'pl'], 8);
      for (const f of config(def).fish) {
        const [, , id, cell] = f.item.split(':') as [string, string, string, string];
        expect(f.word).toBe(id);
        const number = cell.slice(0, 2) as 'sg' | 'pl';
        expect(config(def).values[f.net], f.item).toBe(number);
        const paradigm = word(LAGOON, id).noun!.paradigm![number]!;
        expect(f.text).toBe(preferred(paradigm[Number(cell.slice(2)) - 1]!));
      }
    }
  });

  it('deals fish the previous board did not have, and the focus egg’s fish first', () => {
    for (const seed of SEEDS) {
      const first = made(makeBoard(request(LAGOON, 'fishing-nets', nets.skills, nets.pool, seed)));
      const next = made(
        makeBoard(
          request(LAGOON, 'fishing-nets', nets.skills, nets.pool, seed + 100, second(first)),
        ),
      );
      const before = new Set(config(first).fish.map((f) => f.item));
      expect(config(next).fish.filter((f) => before.has(f.item))).toEqual([]);

      const focus = ['class:consonant:cx', 'class:consonant:rx', 'class:consonant:zx'];
      const focused = made(
        makeBoard(request(LAGOON, 'fishing-nets', nets.skills, nets.pool, seed, { focus })),
      );
      expect(config(focused).fish.map((f) => f.item)).toEqual(expect.arrayContaining(focus));
    }
  });

  it('credits a clean first haul fast, the right fish of a first haul with wrong ones ok, later hauls slow; a coin a fish', () => {
    const def = made(makeBoard(request(LAGOON, 'fishing-nets', nets.skills, nets.pool, 4)));
    const { fish } = config(def);
    const right = fish.map((f) => put(f.id, f.net));
    const credits = (bucket: string, list = fish) => list.map((f) => ({ item: f.item, bucket }));

    const clean = run(def, [...right, HAUL]);
    expect(clean.at(-1)!.status).toBe('completed');
    expect(lastCredit(def, clean, nets.pool)).toEqual({ items: credits('fast'), coins: 9 });
    expect(boardCredits(def, clean[0]!, clean[1]!, new Set(nets.pool))).toEqual({
      items: [],
      coins: 0,
    });

    // The first haul has a fish in a wrong net: the right ones are ok, the wrong one later slow.
    const [odd, ...rest] = fish as [(typeof fish)[number], ...typeof fish];
    const mixed = run(def, [
      put(odd.id, (odd.net + 1) % 3),
      ...rest.map((f) => put(f.id, f.net)),
      HAUL,
      put(odd.id, odd.net),
      HAUL,
    ]);
    expect(boardCredits(def, mixed[9]!, mixed[10]!, new Set(nets.pool))).toEqual({
      items: credits('ok', rest),
      coins: 8,
    });
    expect(lastCredit(def, mixed, nets.pool)).toEqual({ items: credits('slow', [odd]), coins: 1 });

    // A clean first haul of some fish: fast; the fish placed later are slow.
    const partial = run(def, [...right.slice(0, 4), HAUL, ...right.slice(4), HAUL]);
    expect(boardCredits(def, partial[4]!, partial[5]!, new Set(nets.pool))).toEqual({
      items: credits('fast', fish.slice(0, 4)),
      coins: 4,
    });
    expect(lastCredit(def, partial, nets.pool)).toEqual({
      items: credits('slow', fish.slice(4)),
      coins: 5,
    });

    // Only the round's items are credited; every caught fish still earns its coin.
    const pool = nets.pool.filter((item) => item !== fish[0]!.item);
    expect(lastCredit(def, clean, pool)).toEqual({
      items: credits('fast', fish.slice(1)),
      coins: 9,
    });
  });

  it('projects the adapter’s view as the typed board', () => {
    const def = made(makeBoard(request(LAGOON, 'fishing-nets', nets.skills, nets.pool, 6)));
    const { fish, values } = config(def);
    const wrong = (fish[0]!.net + 1) % 3;
    const states = run(def, [put(fish[0]!.id, wrong), put(fish[1]!.id, fish[1]!.net), HAUL]);
    const view = viewOf('fishing-nets', LAGOON, def, states[3]!);
    expect(view).toEqual({
      kind: 'fishing-nets',
      ...(projectMinigame(def, states[3]!, MINIGAMES).view as object),
    });
    expect(view.nets).toEqual(values.map((value) => ({ value })));
    expect(view.fish.slice(0, 2)).toEqual([
      { id: fish[0]!.id, word: null, text: fish[0]!.text, net: null, wrong: true },
      { id: fish[1]!.id, word: null, text: fish[1]!.text, net: fish[1]!.net, wrong: false },
    ]);
    expect(view).toMatchObject({ dimension: 'consonant', submitted: true, attempts: 1 });
  });

  it('never deals fewer than 4 fish (design §5.10: 4-12 fish)', () => {
    const pool = ['class:consonant:h', 'class:consonant:j', 'class:consonant:l'];
    expect(makeBoard(request(LAGOON, 'fishing-nets', nets.skills, pool, 1))).toBeNull();
  });
});

describe('Ulita slov boards (ps.word-builder)', () => {
  const shell = activity(LAGOON, 'moon-caves.1', 'word-shell');
  const config = (def: MinigameDefinition) => def.config as unknown as WordBuilderConfig;
  const ALL: SegmentRole[] = [...SEGMENT_ROLES];

  it('shellTarget cuts a word as its segments rebuild it and names the roles asked', () => {
    const target = (data: Data, id: string, roles: SegmentRole[]) =>
      shellTarget(word(data, id), roles);
    expect(target(LAGOON, 'naamorxniik', ALL)).toEqual({
      letters: [...'námořník'],
      cuts: [2, 5],
      labels: ['prefix', 'root', 'suffix'],
      zeroEnding: true,
    });
    expect(target(LAGOON, 'naamorxniik', ['root'])).toEqual({
      letters: [...'námořník'],
      cuts: [2, 5],
      labels: [null, 'root', null],
      zeroEnding: false,
    });
    expect(target(LAGOON, 'podvodnii', ['root', 'ending'])).toEqual({
      letters: [...'podvodní'],
      cuts: [3, 6, 7],
      labels: [null, 'root', null, 'ending'],
      zeroEnding: false,
    });
    expect(target(LAGOON, 'podvodnii', ['prefix'])).toEqual({
      letters: [...'podvodní'],
      cuts: [3],
      labels: ['prefix', null],
      zeroEnding: false,
    });
    expect(target(LAGOON, 'les', ALL)).toEqual({
      letters: ['l', 'e', 's'],
      cuts: [],
      labels: ['root'],
      zeroEnding: true,
    });
    expect(target(MINI, 'vyletext', ALL)).toEqual({
      letters: [...'vyletět'],
      cuts: [2, 5],
      labels: ['prefix', 'root', 'suffix'],
      zeroEnding: false,
    });
    expect(target(LAGOON, 'ryba', ALL)).toBeNull();
    expect(target(LAGOON, 'les', ['prefix'])).toBeNull();
  });

  it('shellTarget: parts rebuild the word, named parts are its asked segments, others run together', () => {
    const roleSets = Array.from({ length: 15 }, (_, mask) =>
      ALL.filter((_, bit) => ((mask + 1) >> bit) % 2 === 1),
    );
    let checked = 0;
    for (const data of [LAGOON, MINI]) {
      for (const w of data.lexicon.words) {
        if (!w.segments) {
          expect(shellTarget(w, ALL)).toBeNull();
          continue;
        }
        for (const roles of roleSets) {
          const target = shellTarget(w, roles);
          const asked = w.segments.filter(([role, piece]) => roles.includes(role) && piece !== '');
          const zeroAsked =
            roles.includes('ending') &&
            w.segments.some(([role, piece]) => role === 'ending' && piece === '');
          // Nothing to name and no zero ending to mark: no board.
          if (asked.length === 0 && !zeroAsked) {
            expect(target, `${w.id} ${roles.join()}`).toBeNull();
            continue;
          }
          expect(target, `${w.id} ${roles.join()}`).not.toBeNull();
          const { letters, cuts, labels, zeroEnding } = target!;
          const parts = partsOf(letters, cuts);
          expect(parts.join('')).toBe(w.lemma.toLowerCase());
          expect(parts.every((part) => part !== '')).toBe(true);
          expect(labels).toHaveLength(parts.length);
          expect(
            parts.flatMap((part, i) => (labels[i] === null ? [] : [[labels[i], part]])),
          ).toEqual(asked.map(([role, piece]) => [role, piece]));
          expect(labels.some((label, i) => label === null && labels[i + 1] === null)).toBe(false);
          expect(zeroEnding).toBe(zeroAsked);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('deals a word of the round as the target, another word next, the focus egg’s word first', () => {
    for (const seed of SEEDS) {
      const def = made(makeBoard(request(LAGOON, 'word-shell', shell.skills, shell.pool, seed)));
      const c = config(def);
      expect(def.id).toBe('r1.b1');
      expect(shell.pool).toContain(`seg:${c.word}`);
      const target = shellTarget(word(LAGOON, c.word), ['root'])!;
      expect(c).toEqual({ word: c.word, text: lemma(LAGOON, c.word), roles: ['root'], ...target });
      const next = made(
        makeBoard(request(LAGOON, 'word-shell', shell.skills, shell.pool, seed + 100, second(def))),
      );
      expect(config(next).word).not.toBe(c.word);
    }
    for (const item of shell.pool) {
      const def = made(
        makeBoard(request(LAGOON, 'word-shell', shell.skills, shell.pool, 1, { focus: [item] })),
      );
      expect(`seg:${config(def).word}`).toBe(item);
    }
  });

  it('asks the zero ending alone when the board asks only endings (les|∅)', () => {
    // seg:les is in an endings-only skill's universe: its board is the whole word and the ∅.
    expect(skillItems(ENDING_SHELL, LAGOON.lexicon)).toContain('seg:les');
    expect(shellTarget(word(LAGOON, 'les'), ['ending'])).toEqual({
      letters: ['l', 'e', 's'],
      cuts: [],
      labels: [null],
      zeroEnding: true,
    });
    const def = made(makeBoard(request(LAGOON, 'word-shell', [ENDING_SHELL], ['seg:les'], 1)));
    const states = run(def, [{ type: 'zero-ending', on: true }, { type: 'submit' }]);
    expect(states.at(-1)!.status).toBe('completed');
    expect(lastCredit(def, states, ['seg:les']).items).toEqual([
      { item: 'seg:les', bucket: 'fast' },
    ]);
  });

  function solve(c: WordBuilderConfig): MinigameMove[] {
    return [
      ...c.cuts.map((at): MinigameMove => ({ type: 'cut', at })),
      ...c.labels.flatMap((role, part): MinigameMove[] =>
        role === null ? [] : [{ type: 'label', part, role }],
      ),
      ...(c.zeroEnding ? [{ type: 'zero-ending', on: true } as MinigameMove] : []),
      { type: 'submit' },
    ];
  }

  it('credits the word fast at a right first check, slow after a wrong one; a coin a part and the ∅', () => {
    const def = made(makeBoard(request(LAGOON, 'word-shell', shell.skills, shell.pool, 3)));
    const c = config(def);
    const right = run(def, solve(c));
    expect(right.at(-1)!.status).toBe('completed');
    const parts = c.labels.length;
    expect(lastCredit(def, right, shell.pool)).toEqual({
      items: [{ item: `seg:${c.word}`, bucket: 'fast' }],
      coins: parts,
    });
    expect(boardCredits(def, right[0]!, right[1]!, new Set(shell.pool))).toEqual({
      items: [],
      coins: 0,
    });
    const late = run(def, [{ type: 'submit' }, ...solve(c)]);
    expect(lastCredit(def, late, shell.pool)).toEqual({
      items: [{ item: `seg:${c.word}`, bucket: 'slow' }],
      coins: parts,
    });
    expect(lastCredit(def, right, [])).toEqual({ items: [], coins: parts });

    // mlýn: one part (the root) and the zero ending, two coins.
    const mini = activity(MINI, 'moon-caves.1', 'word-shell');
    const mlyn = made(makeBoard(request(MINI, 'word-shell', mini.skills, ['seg:mlyyn'], 1)));
    expect(config(mlyn)).toMatchObject({ cuts: [], labels: ['root'], zeroEnding: true });
    expect(lastCredit(mlyn, run(mlyn, solve(config(mlyn))), mini.pool)).toEqual({
      items: [{ item: 'seg:mlyyn', bucket: 'fast' }],
      coins: 2,
    });
  });

  it('projects the adapter’s view as the typed board', () => {
    const def = made(makeBoard(request(LAGOON, 'word-shell', shell.skills, shell.pool, 8)));
    const c = config(def);
    const states = run(def, [{ type: 'cut', at: c.cuts[0]! }, { type: 'submit' }]);
    const view = viewOf('word-shell', LAGOON, def, states[2]!);
    expect(view).toEqual({
      kind: 'word-shell',
      ...(projectMinigame(def, states[2]!, MINIGAMES).view as object),
    });
    expect(view).toMatchObject({
      word: c.word,
      text: lemma(LAGOON, c.word),
      letters: c.letters,
      cuts: [c.cuts[0]],
      roles: ['root'],
      zeroEnding: false,
      submitted: true,
      attempts: 1,
    });
    expect(view.parts.map((part) => part.text).join('')).toBe(c.text);
  });
});

describe('Slovní rodinka boards (ps.word-family)', () => {
  const families = activity(LAGOON, 'moon-caves.1', 'word-family');
  const config = (def: MinigameDefinition) => def.config as unknown as WordFamilyConfig;
  const familyOf = (data: Data, id: string) => word(data, id).family?.id;
  const others = (def: MinigameDefinition) =>
    config(def)
      .words.filter((w) => !w.member)
      .map((w) => w.word);

  it('deals a family of the round: its words but the head, among words of other families', () => {
    expect(families.skills[0]).toMatchObject({ params: { pick: 3, distractors: 2 } });
    for (const seed of SEEDS) {
      const def = made(
        makeBoard(request(LAGOON, 'word-family', families.skills, families.pool, seed)),
      );
      const c = config(def);
      const record = lexiconIndex(LAGOON).families.get(c.family)!;
      expect(families.pool).toContain(`fam:${record.head}`);
      expect(c.head).toEqual({ word: record.head, text: lemma(LAGOON, record.head) });
      expect(c.letter).toBe(record.letter);
      const members = c.words.filter((w) => w.member);
      expect(members.length).toBeGreaterThanOrEqual(2);
      expect(members.length).toBeLessThanOrEqual(3);
      expect(
        members.every((w) => familyOf(LAGOON, w.word) === c.family && w.word !== c.head.word),
      ).toBe(true);
      expect(others(def).length).toBeGreaterThanOrEqual(1);
      expect(others(def).length).toBeLessThanOrEqual(2);
      expect(others(def).every((id) => familyOf(LAGOON, id) !== c.family)).toBe(true);
      expect(c.words.map((w) => w.text)).toEqual(c.words.map((w) => lemma(LAGOON, w.word)));
      const texts = [c.head.text, ...c.words.map((w) => w.text)];
      expect(new Set(texts).size).toBe(texts.length);
      expect(c.words.map((w) => w.id)).toEqual(c.words.map((_, i) => `w${i + 1}`));
    }
  });

  it('puts the sound-alike family beside it first, then its letter’s families, never a kin family', () => {
    const lexicon = lexiconIndex(BOARD_LAGOON);
    /** Lemmas, sorted by code unit (a set to compare). */
    const lemmas = (ids: readonly string[]) => ids.map((id) => lemma(BOARD_LAGOON, id)).sort();
    const familyWords = (id: string) => lemmas(lexicon.members.get(id)!);
    const byyt = familyWords('byyt'); // být, bytost, bývalý
    const byt = familyWords('byt'); // byt, bytový, byteček: kin of být (listed by byt only)
    const biit = familyWords('biit'); // bít, bitva, bitevní: být's sound-alike family
    const sameLetter = [...familyWords('bystryy'), ...familyWords('bylina')].sort();
    const deal = (fam: string, distractors: number, seed: number) => {
      const skill = familySkill([fam], distractors);
      const pool = skillItems(skill, BOARD_LAGOON.lexicon);
      return lemmas(
        others(made(makeBoard(request(BOARD_LAGOON, 'word-family', [skill], pool, seed)))),
      );
    };
    const outside = (list: readonly string[], words: readonly string[]) =>
      list.filter((l) => !words.includes(l));
    for (const seed of SEEDS) {
      // být: two of the sound-alike family bít; with six neighbours, all three and three b words.
      const two = deal('byyt', 2, seed);
      expect(two).toHaveLength(2);
      expect(outside(two, biit)).toEqual([]);
      const six = deal('byyt', 6, seed);
      expect(six).toEqual(expect.arrayContaining(biit));
      expect(outside(outside(six, biit), sameLetter)).toEqual([]);
      expect([...two, ...six].filter((l) => byt.includes(l))).toEqual([]);
      // byt: no sound-alike family, so the b families first; its kin být never.
      expect(deal('byt', 4, seed)).toEqual(sameLetter);
      const more = deal('byt', 6, seed);
      expect(more).toEqual(expect.arrayContaining(sameLetter));
      expect(more.filter((l) => byyt.includes(l))).toEqual([]);
      // bít: its sound-alike family být first.
      expect(deal('biit', 3, seed)).toEqual(byyt);
    }
  });

  it('deals the focus egg’s family first', () => {
    for (const fam of ['les', 'voda', 'morxe']) {
      for (const seed of SEEDS.slice(0, 6)) {
        const def = made(
          makeBoard(
            request(LAGOON, 'word-family', families.skills, families.pool, seed, {
              focus: [`fam:${fam}`],
            }),
          ),
        );
        expect(config(def).family).toBe(fam);
      }
    }
  });

  it('never deals the previous board’s family again while another is possible', () => {
    const repeated: number[] = [];
    for (const seed of Array.from({ length: 40 }, (_, i) => i)) {
      const first = made(
        makeBoard(request(LAGOON, 'word-family', families.skills, families.pool, seed)),
      );
      const next = made(
        makeBoard(
          request(LAGOON, 'word-family', families.skills, families.pool, seed + 100, second(first)),
        ),
      );
      if (config(next).family === config(first).family) repeated.push(seed);
    }
    expect(repeated, 'seeds whose second board repeats the first board’s family').toEqual([]);
  });

  it('never deals fewer than 2 family words (design §5.12: 2-8)', () => {
    // The mini pack's mlýn family has one word besides its head: mlynář.
    const skill = familySkill(null, 2);
    const def = makeBoard(request(MINI, 'word-family', [skill], ['fam:mlyyn', 'fam:mlynaarx'], 1));
    const words = def === null ? 0 : config(def).words.filter((w) => w.member).length;
    expect(def, `a board of ${words} family word(s)`).toBeNull();
  });

  it('credits the head and the family words fast at a right first check, slow later; a coin a family word', () => {
    const def = made(makeBoard(request(LAGOON, 'word-family', families.skills, families.pool, 2)));
    const c = config(def);
    const members = c.words.filter((w) => w.member);
    const solve: MinigameMove[] = [
      ...members.map((w): MinigameMove => ({ type: 'pick', word: w.id })),
      { type: 'submit' },
    ];
    const items = [c.head.word, ...members.map((w) => w.word)].map((id) => `fam:${id}`);
    const right = run(def, solve);
    expect(right.at(-1)!.status).toBe('completed');
    expect(lastCredit(def, right, families.pool)).toEqual({
      items: items.map((item) => ({ item, bucket: 'fast' })),
      coins: members.length,
    });
    expect(boardCredits(def, right[0]!, right[1]!, new Set(families.pool))).toEqual({
      items: [],
      coins: 0,
    });
    const late = run(def, [{ type: 'submit' }, ...solve]);
    expect(lastCredit(def, late, families.pool)).toEqual({
      items: items.map((item) => ({ item, bucket: 'slow' })),
      coins: members.length,
    });
    // Only the round's items: without the head's item, the family words alone.
    const pool = families.pool.filter((item) => item !== `fam:${c.head.word}`);
    expect(lastCredit(def, right, pool)).toEqual({
      items: items.slice(1).map((item) => ({ item, bucket: 'fast' })),
      coins: members.length,
    });
  });

  it('projects the adapter’s view as the typed board', () => {
    const def = made(makeBoard(request(LAGOON, 'word-family', families.skills, families.pool, 9)));
    const c = config(def);
    const states = run(def, [{ type: 'pick', word: c.words[0]!.id }]);
    const view = viewOf('word-family', LAGOON, def, states[1]!);
    expect(view).toEqual({
      kind: 'word-family',
      ...(projectMinigame(def, states[1]!, MINIGAMES).view as object),
    });
    expect(view).toEqual({
      kind: 'word-family',
      family: c.family,
      head: c.head,
      letter: null,
      words: c.words.map((w, i) => ({ id: w.id, word: w.word, text: w.text, picked: i === 0 })),
      needed: c.words.filter((w) => w.member).length,
      submitted: false,
      attempts: 0,
    });
  });
});

describe('board moves in the runtime', () => {
  it('a refused move is invalid-move, a move on an old revision stale-move', () => {
    const cases: [string, MinigameActivityKind, (def: MinigameDefinition) => [Json, Json]][] = [
      [
        'sunny-lagoon.1',
        'pearl-necklace',
        () => [{ type: 'submit' }, { type: 'place', item: 'kapr', index: 0 }],
      ],
      [
        'sunny-lagoon.5',
        'memory-match',
        (def) => [
          { type: 'select', card: cards(def)[0]!.id },
          { type: 'select', card: 'c99' },
        ],
      ],
      [
        'sunny-lagoon.1',
        'fishing-nets',
        () => [
          { type: 'net', fish: 'f1', net: 0 },
          { type: 'net', fish: 'f99', net: 0 },
        ],
      ],
      [
        'moon-caves.1',
        'word-shell',
        () => [
          { type: 'cut', at: 1 },
          { type: 'cut', at: 99 },
        ],
      ],
      [
        'moon-caves.1',
        'word-family',
        () => [
          { type: 'pick', word: 'w1' },
          { type: 'pick', word: 'w99' },
        ],
      ],
    ];
    for (const [level, kind, moves] of cases) {
      const { index, skills, pool } = activity(LAGOON, level, kind);
      const def = made(makeBoard(request(LAGOON, kind, skills, pool, 1)));
      const state: ProfileState = {
        ...STATE,
        round: {
          id: 'r1',
          type: 'minigame',
          activity: kind,
          source: { kind: 'level', level, activity: index },
          skills: skills.map((skill) => skill.id),
          boards: 1,
          completed: 0,
          definition: def,
          state: createMinigame(def, def.id, MINIGAMES),
          coins: 0,
          status: 'active',
          endReason: null,
        },
      };
      const [legal, illegal] = moves(def);
      expect(moveProblem(state, 0, legal), kind).toBeNull();
      expect(moveProblem(state, 0, illegal), kind).toMatchObject({ code: 'invalid-move' });
      expect(moveProblem(state, 1, legal), kind).toMatchObject({ code: 'stale-move' });
    }
    expect(moveProblem(STATE, 0, { type: 'submit' })).toMatchObject({ code: 'no-board' });
  });
});
