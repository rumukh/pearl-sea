/**
 * Game views for the screens' and helpers' tests: the contract's view types filled with small,
 * valid lagoon data (a region with three levels and Murena Mumla, Krab Tvrďák as the first
 * friend), each part overridable per test. Type-checked against the contract, so a view change
 * fails here first.
 */
import type {
  ClassifyProblem,
  FriendView,
  GameView,
  Gap,
  GapsProblem,
  LevelCard,
  MistakeProblem,
  OddProblem,
  Problem,
  ProblemRoundView,
  ProblemView,
  RegionView,
  RelationProblem,
} from '../../../src/rules/contract';

export function gap(correct: string, patch: Partial<Gap> = {}): Gap {
  return {
    correct,
    options: [correct, correct === 'y' ? 'i' : 'y'],
    keys: ['i', 'í', 'y', 'ý'],
    rule: 'vyjm',
    word: null,
    item: `spell-${correct}`,
    hint: null,
    ...patch,
  };
}

export function level(id: string, order: number, patch: Partial<LevelCard> = {}): LevelCard {
  return {
    id,
    titleKey: `level.${id}.title`,
    order,
    kind: 'lesson',
    status: 'open',
    stars: 0,
    placed: false,
    glowing: false,
    ...patch,
  };
}

export function region(id: string, patch: Partial<RegionView> = {}): RegionView {
  return {
    id,
    titleKey: `region.${id}.title`,
    order: 1,
    map: 'shallows',
    grade: 3,
    unlocked: true,
    monster: {
      id: 'murena-mumla',
      nameKey: 'monster.murena-mumla.name',
      mood: 'grumpy',
      freed: false,
      arms: 1,
    },
    levels: [
      level('lagoon-1', 1, { glowing: true }),
      level('lagoon-2', 2, { status: 'locked' }),
      level('lagoon-monster', 3, { kind: 'monster', status: 'locked' }),
    ],
    ...patch,
  };
}

export function friend(id: string, patch: Partial<FriendView> = {}): FriendView {
  return {
    id,
    nameKey: `friend.${id}.name`,
    mnemonicKey: `friend.${id}.mnemonic`,
    region: 'sunny-lagoon',
    stage: 'egg',
    expression: 'idle',
    mastery: { seen: 0, bronze: 0, silver: 0, gold: 0, items: 10 },
    hungry: false,
    dueItems: 0,
    outfit: { head: null, eyes: null, neck: null },
    next: { stage: 'baby', share: 0, mastery: 'seen', have: 0, need: 10, monster: null },
    ...patch,
  };
}

export function lagoonView(patch: Partial<GameView> = {}): GameView {
  return {
    revision: 1,
    turn: 1,
    day: '2026-10-31',
    screen: 'hub',
    coins: 0,
    settings: { dailyGoal: 30, race: true, unlockAhead: [], grade: 3 },
    onboarding: { firstFriend: 'krab-tvrdak', choices: [], placement: 'skipped' },
    story: null,
    hub: {
      regions: [region('sunny-lagoon')],
      next: { kind: 'level', level: 'lagoon-1' },
      hungry: [],
      race: { available: false, best: 0 },
      certificates: [],
    },
    run: null,
    round: null,
    friends: [friend('krab-tvrdak')],
    shell: { strands: [], counts: { cloudy: 0, bronze: 0, silver: 0, gold: 0 }, recent: [] },
    gallery: {
      monsters: [
        { id: 'murena-mumla', nameKey: 'monster.murena-mumla.name', freed: false, day: null },
      ],
    },
    grotto: { spots: [null, null, null] },
    market: { items: [] },
    album: { pages: [], earned: 0, total: 0 },
    daily: null,
    grownUps: {
      objectives: [],
      skills: [],
      hardest: [],
      trend: [],
      daysPracticed: 0,
      answers: 0,
    },
    ...patch,
  };
}

function stepsOf(problem: Problem): number {
  if (problem.kind === 'gaps') return problem.gaps.length;
  return problem.kind === 'mistake' ? 2 : 1;
}

export function problemView(problem: Problem, patch: Partial<ProblemView> = {}): ProblemView {
  return {
    index: 1,
    item: 'spell-y',
    problem,
    input: 'choice',
    step: 0,
    steps: stepsOf(problem),
    reask: false,
    hinted: false,
    teach: false,
    ambush: null,
    ...patch,
  };
}

export function problemRoundView(
  problem: ProblemView | null,
  patch: Partial<ProblemRoundView> = {},
): ProblemRoundView {
  return {
    id: 'round-1',
    type: 'problems',
    activity: 'feeding',
    source: { kind: 'level', level: 'lagoon-1', activity: 0 },
    input: 'auto',
    status: 'active',
    endReason: null,
    progress: { answered: 0, target: 10, correct: 0, streak: 0 },
    problem,
    feedback: null,
    coins: 0,
    friend: { id: 'krab-tvrdak', expression: 'idle' },
    battle: null,
    placement: null,
    ...patch,
  };
}

/** mlýn: one gap, with the family hint (mlýn → mlynář). */
export const MLYN: GapsProblem = {
  kind: 'gaps',
  sentence: null,
  parts: [
    { kind: 'text', text: 'ml' },
    { kind: 'gap', gap: 0 },
    { kind: 'text', text: 'n' },
  ],
  gaps: [
    gap('ý', {
      options: ['ý', 'í'],
      keys: ['i', 'í', 'y', 'ý'],
      hint: { kind: 'family', word: 'mlyn', related: 'mlynář' },
    }),
  ],
};

/** A sentence with two gaps: "Ryba plave u mlýna." */
export const RYBA: GapsProblem = {
  kind: 'gaps',
  sentence: 'ryba-u-mlyna',
  parts: [
    { kind: 'text', text: 'R' },
    { kind: 'gap', gap: 0 },
    { kind: 'text', text: 'ba plave u ml' },
    { kind: 'gap', gap: 1 },
    { kind: 'text', text: 'na.' },
  ],
  gaps: [gap('y', { options: ['y', 'i'] }), gap('ý', { options: ['ý', 'í'] })],
};

/** Lov chyb: "Mlín stojí u moře." — find "Mlín", then fix its í. */
export const MLIN: MistakeProblem = {
  kind: 'mistake',
  sentence: 'mlyn-stoji',
  tokens: ['Mlín', 'stojí', 'u', 'moře.'],
  wrong: 0,
  fix: gap('ý', { options: ['ý', 'í'], hint: { kind: 'listed', letter: 'm' } }),
  around: ['Ml', 'n'],
};

/** Určování: the part of speech of "plave" in its sentence. */
export const PLAVE: ClassifyProblem = {
  kind: 'classify',
  dimension: 'pos',
  target: { word: 'plavat', text: 'plave' },
  context: { tokens: ['Ryba', 'plave', 'u', 'mlýna.'], at: 1 },
  span: null,
  options: ['1', '2', '5'],
  correct: '5',
  hint: { kind: 'rule', rule: 'vyjm' },
};

/** The odd one out: three listed words and one that is not. */
export const ODD: OddProblem = {
  kind: 'odd',
  basis: 'listed',
  words: [
    { word: 'byt', text: 'byt' },
    { word: 'mys', text: 'myš' },
    { word: 'pivo', text: 'pivo' },
    { word: 'syn', text: 'syn' },
  ],
  correct: 2,
  hint: { kind: 'listed', letter: 'p' },
};

/** A relation: the opposite of "velký". */
export const VELKY: RelationProblem = {
  kind: 'relation',
  relation: 'antonym',
  target: { word: 'velky', text: 'velký' },
  options: [
    { word: 'maly', text: 'malý' },
    { word: 'obri', text: 'obří' },
    { word: 'siroky', text: 'široký' },
  ],
  correct: 0,
  hint: null,
};
