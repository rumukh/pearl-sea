/**
 * The content pack: everything data-driven about the game, in one versioned JSON file
 * (`content/pearl-sea.content.json`, S3), validated by `contentRegistration`.
 *
 * Adding levels, regions, skills, words, sentences, friends, stickers or cosmetics is a JSON edit
 * plus a new pack `revision`. Only a new generator, activity kind or criterion kind needs code. A
 * save pins the exact pack (id, revision, hash) it was played with; shipped packs are archived
 * under `content/history/<revision>.json` and every one of them must stay valid under this
 * schema, so the schema only ever grows by adding union variants or optional fields
 * (docs/contract.md §7.6). The structure is Dragon Valley's, with sea friends for dragons,
 * monsters for bosses, the Inkoustíci and the lexicon added.
 */
import { failure, schema, success, validateReferences } from '@aegis/runtime';
import type { ContentRegistration, DeepReadonly, RuntimeDiagnostic, Schema } from '@aegis/runtime';
import { validateNarrative } from '@aegis/narrative';
import type { NarrativeGraph } from '@aegis/narrative';
import { COSMETIC_SLOTS, FRIEND_STAGES, PAINTED_STAGES, SEA_MAPS } from './ids';
import type { CosmeticSlot, FriendStage, SeaMap } from './ids';
import { GRADES, INPUT_MODES, LEVEL_ACTIVITY_KINDS, STRANDS, isMinigameKind } from './kinds';
import type { Dimension, GeneratorId, Grade, InputMode, LevelActivityKind, Strand } from './kinds';
import { lexiconSchema, validateLexicon } from './lexicon';
import type { Lexicon } from './lexicon';
import { ART } from './media';
import {
  artId,
  catalogKey,
  contentId,
  gradeSchema,
  hexColor,
  int,
  nullable,
  objectWithOptional,
  oneOf,
  percent,
  uniqueArray,
} from './schema';
import { DIMENSION_VALUES, skillItems, skillSchema } from './skills';
import type { Skill } from './skills';
import { LISTED_LETTERS } from './language';
import { GROWN_UPS_KEY_PREFIX } from './catalogs';

type Read<T> = DeepReadonly<T>;

/** The content pack ID. */
export const CONTENT_PACK_ID = 'pearl-sea';
/** The pack's file, under `content/`. */
export const CONTENT_FILE = 'pearl-sea.content.json';
/** Content data schema version. Frozen at 1: the schema evolves only compatibly (see above). */
export const CONTENT_SCHEMA_VERSION = 1;

const ids = uniqueArray(contentId, { max: 256 });

// ---------------------------------------------------------------------------------------------
// Records

/** A curriculum objective (docs/curriculum.md): taught by lessons, reviewed by monsters. */
export interface Objective {
  id: string;
  strand: Strand;
  grade: Grade;
  /** Shown in the grown-ups' area only, so a `grownups.objective.*` key with an English twin. */
  titleKey: string;
  /** RVP ZV expected outcomes (`ČJL-3-2-08`, `ČJL-5-2-02`, …). */
  rvp: string[];
}

/** Unlocked once every listed level is completed (at least one star, or placed out). */
export interface Unlock {
  after: string[];
}

export interface Region {
  id: string;
  /** 1-based map order. */
  order: number;
  titleKey: string;
  unlock: Unlock;
  /** The region monster, or `null`. */
  monster: string | null;
  /** The sea map the region lies on. */
  map: SeaMap;
  /** The school grade the region teaches. */
  grade: Grade;
}

/** Where a grade starts: the region a child of that grade begins in, always open to them. */
export interface GradeStart {
  grade: Grade;
  start: string;
}

/**
 * One activity of a level: its kind, the skills it draws from, how many problems or boards it has,
 * the input mode, and kind-specific `options` (`ACTIVITY_OPTION_SCHEMAS`).
 */
export interface Activity {
  kind: LevelActivityKind;
  skills: string[];
  count: number;
  input: InputMode;
  options: Record<string, number | boolean | string>;
}

/** Star thresholds: 1 star = completed; 2 and 3 need accuracy, 3 also fluency (fast share). */
export interface StarRule {
  twoStars: { accuracy: number };
  threeStars: { accuracy: number; fastShare: number };
}

export interface LevelRewards {
  /** Coins for first reaching 1, 2 and 3 stars (paid once per star level). */
  coins: [number, number, number];
  /** Sea friend eggs given on first completion. */
  eggs: string[];
  /** Cosmetics given on first completion. */
  cosmetics: string[];
}

export interface Level {
  id: string;
  region: string;
  /** 1-based order inside the region; the monster level comes last. */
  order: number;
  titleKey: string;
  kind: 'lesson' | 'monster';
  unlock: Unlock;
  activities: Activity[];
  /** `null` uses `balance.stars`. */
  stars: StarRule | null;
  rewards: LevelRewards;
  /** The monster of a `monster` level; `null` for lessons. */
  monster: string | null;
  /** Story beat played before the level's first run, or `null`. */
  storyBeat: string | null;
  /** Curriculum objectives this level teaches or reviews (docs/curriculum.md §3, exactly). */
  objectives: string[];
}

/**
 * A sea friend. Its mastery set is the union of its skills' items; growth needs a share of them at
 * a mastery level (`balance.growth`), and to grow up its region monster freed.
 */
export interface Friend {
  id: string;
  nameKey: string;
  /** Catalog key of the friend's memory hook (the crab's seven hard spikes, …). */
  mnemonicKey: string;
  /** The region whose levels give its egg. */
  region: string;
  skills: string[];
  /** The monster whose freeing lets the friend grow up, or `null`. */
  monster: string | null;
}

export type MonsterMood = 'grumpy' | 'sulky' | 'laughing';

/**
 * A monster soaked in ink: wash it clean with right answers. Misses never refill the ink and
 * nobody loses. A monster with several arms shares its meter evenly between them and serves its
 * battle activity's skills in order, one skill per arm (Krakatice: one strand per arm).
 */
export interface Monster {
  id: string;
  region: string;
  nameKey: string;
  mood: MonsterMood;
  /** Right answers that wash all the ink off. */
  meter: number;
  /** Share of battle problems drawn as spaced review of earlier skills. */
  reviewShare: number;
  /** Catalog keys of the monster's little jokes, told between answers. */
  jokes: string[];
  /** Arms to wash one after another (default 1). */
  arms?: number;
  /** Freeing this monster completes the game (the finale). Default false. */
  finale?: boolean;
  /** Freeing this monster completes a grade's sea (Ledana: grade 3). */
  gradeFinale?: Grade;
}

/** An Inkoustík: a little ink monster that ambushes a round now and then (`balance.ambush`). */
export interface Inkoustik {
  id: string;
  nameKey: string;
}

/** A cosmetic: the narrative `CosmeticItem` (`id`, `slot`, `assetId`) plus shop data. */
export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  assetId: string;
  nameKey: string;
  price: number;
  /** Shown at U Mrože once this level is completed; `null` = from the start. */
  unlock: string | null;
}

export type StickerCriteria =
  | { kind: 'level-complete'; level: string; stars: number }
  | { kind: 'monster-freed'; monster: string }
  | { kind: 'friend-stage'; friend: string | null; stage: FriendStage }
  /** `count` owned friends at `stage` or later; `count: null` = every friend of the content. */
  | { kind: 'friends-stage'; stage: FriendStage; count: number | null }
  | { kind: 'items-mastered'; level: 'bronze' | 'silver' | 'gold'; count: number }
  | {
      kind: 'skill-mastered';
      skill: string;
      level: 'seen' | 'bronze' | 'silver' | 'gold';
      share: number;
    }
  | { kind: 'streak'; count: number }
  | { kind: 'days-practiced'; count: number }
  | { kind: 'week-days'; count: number }
  | { kind: 'coins-earned'; count: number }
  | { kind: 'cosmetics-owned'; count: number }
  | { kind: 'friends-dressed'; count: number }
  | { kind: 'race-best'; count: number }
  | { kind: 'quests-claimed'; count: number }
  | { kind: 'inkoustici-splashed'; count: number }
  | { kind: 'placement-done' }
  | { kind: 'finale' };

/** A sticker for the album, composed by the art pipeline from `icon`, `color` and `frame`. */
export interface Sticker {
  id: string;
  nameKey: string;
  /** The album page: a region. */
  page: string;
  criteria: StickerCriteria;
  icon: string;
  color: string;
  frame: string;
}

export type QuestGoal =
  | 'correct-answers'
  | 'fast-answers'
  | 'feed-hungry'
  | 'play-minigame'
  | 'finish-level'
  | 'best-streak'
  | 'splash-inkoustik';

/** A daily quest template; some are drawn per day from the unlocked templates. */
export interface QuestTemplate {
  id: string;
  titleKey: string;
  goal: QuestGoal;
  target: number;
  coins: number;
  weight: number;
  /** Offered once this level is completed; `null` = from the start. */
  unlock: string | null;
}

/** One rung of the placement check: a few problems of `skill`; passing marks `levels` placed. */
export interface PlacementStep {
  skill: string;
  problems: number;
  passAccuracy: number;
  levels: string[];
  /** The grades whose ladder includes the rung. */
  grades: Grade[];
}

export interface Placement {
  steps: PlacementStep[];
  minProblems: number;
  maxProblems: number;
  /** Stop early (gently) after this many misses in a row. */
  stopAfterMisses: number;
}

/** What starts a beat; with `grades`, only for a child of one of those grades. */
export type BeatTrigger = (
  | { kind: 'first-session' }
  | { kind: 'after-beat'; beat: string }
  | { kind: 'level-start'; level: string }
  | { kind: 'level-complete'; level: string }
  | { kind: 'monster-freed'; monster: string }
  | { kind: 'finale' }
) & { grades?: Grade[] };

/**
 * A story beat: a small `@aegis/narrative` graph played when its trigger fires. Text references
 * in the graph are catalog keys; scenes are scene or map art IDs (`scene/sunny-lagoon`,
 * `scene/grotto`, `map/deep`: `BEAT_SCENE_PATTERN`) and assets are art IDs (a character, a
 * friend, a monster); reward claims map to game grants via `story.rewards`.
 */
export interface StoryBeat {
  id: string;
  trigger: BeatTrigger;
  skippable: boolean;
  graph: NarrativeGraph;
}

/** What a beat's scene may be: a painted scene or a sea map (media.ts). */
export const BEAT_SCENE_PATTERN = /^(scene\/[a-z0-9]+(?:-[a-z0-9]+)*|map\/(shallows|deep))$/;

export type Grant =
  | { kind: 'egg'; friend: string }
  | { kind: 'coins'; amount: number }
  | { kind: 'cosmetic'; item: string };

export interface StoryReward {
  /** A narrative `reward` catalog ID claimed by a beat's effect. */
  reward: string;
  grant: Grant;
}

export type GrowthMastery = 'seen' | 'bronze' | 'silver' | 'gold';

export interface GrowthRule {
  stage: Exclude<FriendStage, 'egg'>;
  /** Share of the friend's mastery set at `mastery` or better. */
  share: number;
  /** `seen` = answered right at least once (box 1+). */
  mastery: GrowthMastery;
  /** Also require the friend's monster freed. */
  monster: boolean;
}

/** The effort path to bronze and silver pearls (as Dragon Valley's, design §6). */
export interface EffortPath {
  bronzeDays: number;
  silverDays: number;
  gapDays: number;
}

export interface ResponseTiming {
  fastMs: number;
  okMs: number;
}

/** Every tunable number. Percentages and durations are integers; nothing is a fraction. */
export interface Balance {
  leitner: {
    /** Days until an item in box 0..5 is due again. */
    intervals: number[];
  };
  response: {
    choice: ResponseTiming;
    letters: ResponseTiming;
    /** Typing: extra time per letter beyond the first. */
    typed: ResponseTiming & { perExtraLetterMs: number };
    /** Reading time per word of a sentence shown with a problem. */
    perSentenceWordMs: number;
  };
  input: {
    /** Leitner box from which `auto` input uses the letter pad, then typing. */
    lettersFromBox: number;
    typedFromBox: number;
    choices: number;
  };
  mix: {
    successTarget: number;
    knownShare: number;
    minLearningShare: number;
    maxLearningShare: number;
    window: number;
    noRepeatWithin: number;
  };
  reask: { delay: number; maxPerRound: number };
  coins: {
    correct: number;
    streakEvery: number;
    streakBonus: number;
    monsterFreed: number;
    placementDone: number;
    /** The bonus coin for splashing an Inkoustík away. */
    ambush: number;
  };
  stars: StarRule;
  mastery: { goldBox: number; goldFast: number; goldOfLast: number; effort?: EffortPath };
  /** Rules for baby, grown and crowned, in that order. */
  growth: GrowthRule[];
  daily: {
    goalAnswers: number;
    goalMin: number;
    goalMax: number;
    quests: number;
    historyDays: number;
  };
  /** The treasure chest after the daily goal. */
  chest: { coinsMin: number; coinsMax: number; cosmeticWeight: number; coinsWeight: number };
  race: { unlockAfter: string; maxProblems: number; seconds: number };
  hungry: { minDue: number };
  /**
   * Inkoustíci ambushes, once `unlockAfter` (a level: Murena Mumla's) is completed: from the
   * problem `minIndex` of a round on, each next problem is ambushed with `chance` percent (drawn
   * from the `ambush` stream), at most `maxPerRound` times; never in a battle, the race or the
   * placement check.
   */
  ambush: { unlockAfter: string; chance: number; minIndex: number; maxPerRound: number };
  /** Monster battles: harmless ink blots splash onto the screen every `splashEvery` answers. */
  battle: { splashEvery: number };
  /** Per-grade overrides of the response limits and the number of choices. */
  grades?: GradeBalance[];
}

export interface GradeBalance {
  grade: Grade;
  choice?: ResponseTiming;
  letters?: ResponseTiming;
  typed?: ResponseTiming & { perExtraLetterMs: number };
  choices?: number;
}

export interface ContentData {
  /** Where each grade starts. */
  grades: GradeStart[];
  objectives: Objective[];
  regions: Region[];
  levels: Level[];
  skills: Skill[];
  friends: Friend[];
  monsters: Monster[];
  inkoustici: Inkoustik[];
  cosmetics: Cosmetic[];
  stickers: Sticker[];
  quests: QuestTemplate[];
  placement: Placement;
  story: { beats: StoryBeat[]; rewards: StoryReward[] };
  balance: Balance;
  lexicon: Lexicon;
}

// ---------------------------------------------------------------------------------------------
// Activities

/** Feeding draws: the mix (default), or the child's weakest known items first. */
export const FEEDING_DRAWS = ['mix', 'weakest'] as const;

/** Per-kind activity options: allowed keys and their schemas. Absent keys take the default. */
export const ACTIVITY_OPTION_SCHEMAS: Readonly<
  Record<LevelActivityKind, Readonly<Record<string, Schema<number | boolean | string>>>>
> = {
  feeding: { draw: oneOf(FEEDING_DRAWS) },
  'ink-sentence': {},
  'bug-hunt': {},
  analysis: {},
  battle: {},
  'memory-match': {},
  'pearl-necklace': {},
  'fishing-nets': {},
  'word-shell': {},
  'word-family': {},
};
export const ACTIVITY_OPTION_DEFAULTS: Readonly<
  Record<LevelActivityKind, Readonly<Record<string, number | boolean | string>>>
> = {
  feeding: { draw: 'mix' },
  'ink-sentence': {},
  'bug-hunt': {},
  analysis: {},
  battle: {},
  'memory-match': {},
  'pearl-necklace': {},
  'fishing-nets': {},
  'word-shell': {},
  'word-family': {},
};

/** The generators each activity kind can serve. */
export const ACTIVITY_GENERATORS: Readonly<Record<LevelActivityKind, readonly GeneratorId[]>> = {
  feeding: ['spell.word', 'classify', 'odd-one-out', 'relation'],
  'ink-sentence': ['spell.sentence'],
  'bug-hunt': ['spell.mistake'],
  analysis: ['classify', 'odd-one-out'],
  battle: ['spell.word', 'spell.sentence', 'spell.mistake', 'classify', 'odd-one-out', 'relation'],
  'memory-match': ['pairs'],
  'pearl-necklace': ['alphabet'],
  'fishing-nets': ['sort'],
  'word-shell': ['segment'],
  'word-family': ['family'],
};

// ---------------------------------------------------------------------------------------------
// Schemas

const unlockSchema: Schema<Unlock> = schema.object({ after: ids });
const starRuleSchema: Schema<StarRule> = schema.object({
  twoStars: schema.object({ accuracy: percent }),
  threeStars: schema.object({ accuracy: percent, fastShare: percent }),
});
const grades = uniqueArray(gradeSchema, { min: 1, max: 2 });
const rvpCode = schema.string({ minLength: 10, maxLength: 12, pattern: /^ČJL-[35]-2-0[1-9]p?$/ });

const activitySchema: Schema<Activity> = schema.object({
  kind: oneOf(LEVEL_ACTIVITY_KINDS),
  skills: uniqueArray(contentId, { min: 1, max: 16 }),
  count: int(1, 30),
  input: oneOf(INPUT_MODES),
  options: schema.record(schema.union(int(0, 1000), schema.boolean, contentId)),
});

const levelSchema: Schema<Level> = schema.object({
  id: contentId,
  region: contentId,
  order: int(1, 50),
  titleKey: catalogKey,
  kind: oneOf(['lesson', 'monster'] as const),
  unlock: unlockSchema,
  activities: schema.array(activitySchema, { min: 1, max: 8 }),
  stars: nullable(starRuleSchema),
  rewards: schema.object({
    coins: schema.array(int(0, 1000), { min: 3, max: 3 }) as Schema<[number, number, number]>,
    eggs: uniqueArray(contentId, { max: 4 }),
    cosmetics: uniqueArray(contentId, { max: 4 }),
  }),
  monster: nullable(contentId),
  storyBeat: nullable(contentId),
  objectives: uniqueArray(contentId, { max: 64 }),
});

const masteryLevel = oneOf(['seen', 'bronze', 'silver', 'gold'] as const);

const stickerCriteriaSchema: Schema<StickerCriteria> = schema.union(
  schema.object({ kind: schema.literal('level-complete'), level: contentId, stars: int(1, 3) }),
  schema.object({ kind: schema.literal('monster-freed'), monster: contentId }),
  schema.object({
    kind: schema.literal('friend-stage'),
    friend: nullable(contentId),
    stage: oneOf(FRIEND_STAGES),
  }),
  schema.object({
    kind: schema.literal('friends-stage'),
    stage: oneOf(FRIEND_STAGES),
    count: nullable(int(1, 100)),
  }),
  schema.object({
    kind: schema.literal('items-mastered'),
    level: oneOf(['bronze', 'silver', 'gold'] as const),
    count: int(1, 100_000),
  }),
  schema.object({
    kind: schema.literal('skill-mastered'),
    skill: contentId,
    level: masteryLevel,
    share: int(1, 100),
  }),
  schema.object({ kind: schema.literal('streak'), count: int(1, 1000) }),
  schema.object({ kind: schema.literal('days-practiced'), count: int(1, 10_000) }),
  schema.object({ kind: schema.literal('week-days'), count: int(1, 7) }),
  schema.object({ kind: schema.literal('coins-earned'), count: int(1, 1_000_000) }),
  schema.object({ kind: schema.literal('cosmetics-owned'), count: int(1, 1000) }),
  schema.object({ kind: schema.literal('friends-dressed'), count: int(1, 100) }),
  schema.object({ kind: schema.literal('race-best'), count: int(1, 1000) }),
  schema.object({ kind: schema.literal('quests-claimed'), count: int(1, 10_000) }),
  schema.object({ kind: schema.literal('inkoustici-splashed'), count: int(1, 10_000) }),
  schema.object({ kind: schema.literal('placement-done') }),
  schema.object({ kind: schema.literal('finale') }),
);

function narrativeGraphSchema(): Schema<NarrativeGraph> {
  return {
    parse(value: unknown, path = '') {
      try {
        const result = validateNarrative(value);
        if (result.ok && result.value) return success(result.value);
        const detail = result.diagnostics
          .slice(0, 3)
          .map((d) => `${d.code} at ${d.location?.path ?? '$'}: ${d.message}`)
          .join('; ');
        return failure('invalid-story', `Invalid story graph: ${detail}`, { path });
      } catch (error) {
        return failure('invalid-story', error instanceof Error ? error.message : String(error), {
          path,
        });
      }
    },
  };
}

const gradesFilter = { grades };

const beatTriggerSchema = schema.union(
  objectWithOptional({ kind: schema.literal('first-session') }, gradesFilter),
  objectWithOptional({ kind: schema.literal('after-beat'), beat: contentId }, gradesFilter),
  objectWithOptional({ kind: schema.literal('level-start'), level: contentId }, gradesFilter),
  objectWithOptional({ kind: schema.literal('level-complete'), level: contentId }, gradesFilter),
  objectWithOptional({ kind: schema.literal('monster-freed'), monster: contentId }, gradesFilter),
  objectWithOptional({ kind: schema.literal('finale') }, gradesFilter),
) as Schema<BeatTrigger>;

const grantSchema: Schema<Grant> = schema.union(
  schema.object({ kind: schema.literal('egg'), friend: contentId }),
  schema.object({ kind: schema.literal('coins'), amount: int(1, 10_000) }),
  schema.object({ kind: schema.literal('cosmetic'), item: contentId }),
);

const timingSchema: Schema<ResponseTiming> = schema.object({
  fastMs: int(500, 60_000),
  okMs: int(500, 120_000),
});
const typedTimingSchema = schema.object({
  fastMs: int(500, 60_000),
  okMs: int(500, 120_000),
  perExtraLetterMs: int(0, 10_000),
});

const gradeBalanceSchema: Schema<GradeBalance> = objectWithOptional(
  { grade: gradeSchema },
  { choice: timingSchema, letters: timingSchema, typed: typedTimingSchema, choices: int(2, 4) },
) as Schema<GradeBalance>;

const balanceSchema: Schema<Balance> = objectWithOptional(
  {
    leitner: schema.object({ intervals: schema.array(int(0, 365), { min: 6, max: 6 }) }),
    response: schema.object({
      choice: timingSchema,
      letters: timingSchema,
      typed: typedTimingSchema,
      perSentenceWordMs: int(0, 10_000),
    }),
    input: schema.object({
      lettersFromBox: int(0, 6),
      typedFromBox: int(0, 6),
      choices: int(2, 4),
    }),
    mix: schema.object({
      successTarget: percent,
      knownShare: percent,
      minLearningShare: percent,
      maxLearningShare: percent,
      window: int(1, 200),
      noRepeatWithin: int(0, 10),
    }),
    reask: schema.object({ delay: int(1, 20), maxPerRound: int(0, 10) }),
    coins: schema.object({
      correct: int(0, 100),
      streakEvery: int(1, 100),
      streakBonus: int(0, 100),
      monsterFreed: int(0, 1000),
      placementDone: int(0, 1000),
      ambush: int(0, 100),
    }),
    stars: starRuleSchema,
    mastery: objectWithOptional(
      { goldBox: int(0, 5), goldFast: int(0, 10), goldOfLast: int(1, 10) },
      {
        effort: schema.object({
          bronzeDays: int(1, 365),
          silverDays: int(1, 365),
          gapDays: int(1, 365),
        }),
      },
    ),
    growth: schema.array(
      schema.object({
        stage: oneOf(['baby', 'grown', 'crowned'] as const),
        share: percent,
        mastery: masteryLevel,
        monster: schema.boolean,
      }),
      { min: 3, max: 3 },
    ),
    daily: schema.object({
      goalAnswers: int(1, 1000),
      goalMin: int(1, 1000),
      goalMax: int(1, 1000),
      quests: int(0, 5),
      historyDays: int(7, 365),
    }),
    chest: schema.object({
      coinsMin: int(0, 1000),
      coinsMax: int(0, 1000),
      cosmeticWeight: int(0, 100),
      coinsWeight: int(0, 100),
    }),
    race: schema.object({
      unlockAfter: contentId,
      maxProblems: int(1, 200),
      seconds: int(10, 300),
    }),
    hungry: schema.object({ minDue: int(1, 100) }),
    ambush: schema.object({
      unlockAfter: contentId,
      chance: percent,
      minIndex: int(1, 30),
      maxPerRound: int(0, 5),
    }),
    battle: schema.object({ splashEvery: int(1, 20) }),
  },
  { grades: schema.array(gradeBalanceSchema, { min: 1, max: 2 }) },
) as Schema<Balance>;

export const contentDataSchema: Schema<ContentData> = schema.object({
  grades: schema.array(schema.object({ grade: gradeSchema, start: contentId }), { min: 1, max: 2 }),
  objectives: schema.array(
    schema.object({
      id: contentId,
      strand: oneOf(STRANDS),
      grade: gradeSchema,
      titleKey: catalogKey,
      rvp: uniqueArray(rvpCode, { min: 1, max: 4 }),
    }),
    { min: 1, max: 200 },
  ),
  regions: schema.array(
    schema.object({
      id: contentId,
      order: int(1, 50),
      titleKey: catalogKey,
      unlock: unlockSchema,
      monster: nullable(contentId),
      map: oneOf(SEA_MAPS),
      grade: gradeSchema,
    }),
    { min: 1, max: 50 },
  ),
  levels: schema.array(levelSchema, { min: 1, max: 500 }),
  skills: schema.array(skillSchema, { min: 1, max: 1000 }),
  friends: schema.array(
    schema.object({
      id: contentId,
      nameKey: catalogKey,
      mnemonicKey: catalogKey,
      region: contentId,
      skills: uniqueArray(contentId, { min: 1, max: 64 }),
      monster: nullable(contentId),
    }),
    { max: 100 },
  ),
  monsters: schema.array(
    objectWithOptional(
      {
        id: contentId,
        region: contentId,
        nameKey: catalogKey,
        mood: oneOf(['grumpy', 'sulky', 'laughing'] as const),
        meter: int(1, 200),
        reviewShare: percent,
        jokes: uniqueArray(catalogKey, { max: 20 }),
      },
      { arms: int(1, 10), finale: schema.boolean, gradeFinale: gradeSchema },
    ),
    { max: 100 },
  ),
  inkoustici: schema.array(schema.object({ id: contentId, nameKey: catalogKey }), { max: 20 }),
  cosmetics: schema.array(
    schema.object({
      id: contentId,
      slot: oneOf(COSMETIC_SLOTS),
      assetId: artId,
      nameKey: catalogKey,
      price: int(0, 100_000),
      unlock: nullable(contentId),
    }),
    { max: 1000 },
  ),
  stickers: schema.array(
    schema.object({
      id: contentId,
      nameKey: catalogKey,
      page: contentId,
      criteria: stickerCriteriaSchema,
      icon: artId,
      color: hexColor,
      frame: artId,
    }),
    { max: 1000 },
  ),
  quests: schema.array(
    schema.object({
      id: contentId,
      titleKey: catalogKey,
      goal: oneOf([
        'correct-answers',
        'fast-answers',
        'feed-hungry',
        'play-minigame',
        'finish-level',
        'best-streak',
        'splash-inkoustik',
      ] as const),
      target: int(1, 1000),
      coins: int(0, 1000),
      weight: int(1, 100),
      unlock: nullable(contentId),
    }),
    { max: 200 },
  ),
  placement: schema.object({
    steps: schema.array(
      schema.object({
        skill: contentId,
        problems: int(1, 20),
        passAccuracy: percent,
        levels: uniqueArray(contentId, { min: 1, max: 100 }),
        grades,
      }),
      { max: 50 },
    ),
    minProblems: int(1, 200),
    maxProblems: int(1, 200),
    stopAfterMisses: int(1, 20),
  }),
  story: schema.object({
    beats: schema.array(
      schema.object({
        id: contentId,
        trigger: beatTriggerSchema,
        skippable: schema.boolean,
        graph: narrativeGraphSchema(),
      }),
      { max: 500 },
    ),
    rewards: schema.array(schema.object({ reward: contentId, grant: grantSchema }), { max: 500 }),
  }),
  balance: balanceSchema,
  lexicon: lexiconSchema,
});

// ---------------------------------------------------------------------------------------------
// Cross-reference validation

/** The item universe of every skill, by skill ID. */
export function skillItemIndex(data: Read<ContentData>): Map<string, string[]> {
  return new Map(data.skills.map((skill) => [skill.id, skillItems(skill, data.lexicon)]));
}

/** The school grade a region teaches. */
export function regionGrade(region: Read<Region>): Grade {
  return region.grade;
}

/** The start region of `grade`, or `null` when the pack does not serve it. */
export function gradeStart(data: Read<ContentData>, grade: Grade): string | null {
  return data.grades.find((entry) => entry.grade === grade)?.start ?? null;
}

/** The balance for a child of `grade`, with that grade's overrides applied. */
export function gradeBalance(balance: Read<Balance>, grade: Grade): Read<Balance> {
  const entry = balance.grades?.find((g) => g.grade === grade);
  if (entry === undefined) return balance;
  return {
    ...balance,
    response: {
      ...balance.response,
      choice: entry.choice ?? balance.response.choice,
      letters: entry.letters ?? balance.response.letters,
      typed: entry.typed ?? balance.response.typed,
    },
    input: { ...balance.input, choices: entry.choices ?? balance.input.choices },
  };
}

/**
 * Every cross-reference and structural rule of a content pack, including the lexicon's linguistic
 * consistency. Returns diagnostics with record ID and field path; empty means valid.
 */
export function validateContentData(data: Read<ContentData>): RuntimeDiagnostic[] {
  const file = CONTENT_FILE;
  const out: RuntimeDiagnostic[] = [];
  const problem = (recordId: string, path: string, message: string, code = 'invalid-content') =>
    out.push({ code, message, file, recordId, path });
  const unique = (catalog: string, list: readonly string[]) =>
    out.push(
      ...validateReferences(
        list.map((id) => ({ id, references: [] })),
        [],
        `${file}#${catalog}`,
      ),
    );
  const need = (
    catalog: string,
    recordId: string,
    field: string,
    references: readonly string[],
    available: ReadonlySet<string>,
    kind: string,
  ) =>
    references.forEach((reference, index) => {
      if (!available.has(reference)) {
        out.push({
          code: 'missing-reference',
          message: `Unknown ${kind} "${reference}".`,
          file: `${file}#${catalog}`,
          recordId,
          path: references.length === 1 ? field : `${field}[${index}]`,
        });
      }
    });
  const one = (value: string | null): string[] => (value === null ? [] : [value]);

  const objectives = new Set(data.objectives.map((o) => o.id));
  const regions = new Set(data.regions.map((r) => r.id));
  const levels = new Set(data.levels.map((l) => l.id));
  const skills = new Set(data.skills.map((s) => s.id));
  const friends = new Set(data.friends.map((f) => f.id));
  const monsters = new Set(data.monsters.map((m) => m.id));
  const cosmetics = new Set(data.cosmetics.map((c) => c.id));
  const beats = new Set(data.story.beats.map((b) => b.id));

  unique(
    'objectives',
    data.objectives.map((o) => o.id),
  );
  unique(
    'regions',
    data.regions.map((r) => r.id),
  );
  unique(
    'levels',
    data.levels.map((l) => l.id),
  );
  unique(
    'skills',
    data.skills.map((s) => s.id),
  );
  unique(
    'friends',
    data.friends.map((f) => f.id),
  );
  unique(
    'monsters',
    data.monsters.map((m) => m.id),
  );
  unique(
    'inkoustici',
    data.inkoustici.map((i) => i.id),
  );
  unique(
    'cosmetics',
    data.cosmetics.map((c) => c.id),
  );
  unique(
    'stickers',
    data.stickers.map((s) => s.id),
  );
  unique(
    'quests',
    data.quests.map((q) => q.id),
  );
  unique(
    'beats',
    data.story.beats.map((b) => b.id),
  );
  unique(
    'storyRewards',
    data.story.rewards.map((r) => r.reward),
  );

  for (const r of data.regions) {
    need('regions', r.id, 'unlock.after', r.unlock.after, levels, 'level');
    need('regions', r.id, 'monster', one(r.monster), monsters, 'monster');
  }
  for (const l of data.levels) {
    need('levels', l.id, 'region', [l.region], regions, 'region');
    need('levels', l.id, 'unlock.after', l.unlock.after, levels, 'level');
    need('levels', l.id, 'monster', one(l.monster), monsters, 'monster');
    need('levels', l.id, 'storyBeat', one(l.storyBeat), beats, 'story beat');
    need('levels', l.id, 'objectives', l.objectives, objectives, 'objective');
    l.activities.forEach((a, index) =>
      need('levels', l.id, `activities[${index}].skills`, a.skills, skills, 'skill'),
    );
    need('levels', l.id, 'rewards.eggs', l.rewards.eggs, friends, 'friend');
    need('levels', l.id, 'rewards.cosmetics', l.rewards.cosmetics, cosmetics, 'cosmetic');
  }
  for (const f of data.friends) {
    need('friends', f.id, 'region', [f.region], regions, 'region');
    need('friends', f.id, 'skills', f.skills, skills, 'skill');
    need('friends', f.id, 'monster', one(f.monster), monsters, 'monster');
  }
  for (const m of data.monsters) need('monsters', m.id, 'region', [m.region], regions, 'region');
  for (const c of data.cosmetics) need('cosmetics', c.id, 'unlock', one(c.unlock), levels, 'level');
  for (const s of data.stickers) {
    const c = s.criteria;
    need('stickers', s.id, 'page', [s.page], regions, 'region');
    if (c.kind === 'level-complete')
      need('stickers', s.id, 'criteria.level', [c.level], levels, 'level');
    if (c.kind === 'monster-freed') {
      need('stickers', s.id, 'criteria.monster', [c.monster], monsters, 'monster');
    }
    if (c.kind === 'friend-stage') {
      need('stickers', s.id, 'criteria.friend', one(c.friend), friends, 'friend');
    }
    if (c.kind === 'skill-mastered')
      need('stickers', s.id, 'criteria.skill', [c.skill], skills, 'skill');
  }
  for (const q of data.quests) need('quests', q.id, 'unlock', one(q.unlock), levels, 'level');
  data.placement.steps.forEach((step, index) => {
    need('placement', `step-${index}`, 'skill', [step.skill], skills, 'skill');
    need('placement', `step-${index}`, 'levels', step.levels, levels, 'level');
  });
  for (const b of data.story.beats) {
    const t = b.trigger;
    if (t.kind === 'after-beat') need('beats', b.id, 'trigger.beat', [t.beat], beats, 'story beat');
    if (t.kind === 'level-start' || t.kind === 'level-complete') {
      need('beats', b.id, 'trigger.level', [t.level], levels, 'level');
    }
    if (t.kind === 'monster-freed') {
      need('beats', b.id, 'trigger.monster', [t.monster], monsters, 'monster');
    }
  }
  for (const r of data.story.rewards) {
    if (r.grant.kind === 'egg') {
      need('storyRewards', r.reward, 'grant.friend', [r.grant.friend], friends, 'friend');
    }
    if (r.grant.kind === 'cosmetic') {
      need('storyRewards', r.reward, 'grant.item', [r.grant.item], cosmetics, 'cosmetic');
    }
  }
  need('balance', 'balance', 'race.unlockAfter', [data.balance.race.unlockAfter], levels, 'level');
  need(
    'balance',
    'balance',
    'ambush.unlockAfter',
    [data.balance.ambush.unlockAfter],
    levels,
    'level',
  );

  // The lexicon's linguistic consistency.
  for (const finding of validateLexicon(data.lexicon)) {
    problem(finding.where, 'lexicon', finding.message, 'invalid-lexicon');
  }

  // Skills produce at least one item; skills reference lexicon records that exist.
  const words = new Set(data.lexicon.words.map((w) => w.id));
  const families = new Set(data.lexicon.families.map((f) => f.id));
  const sentences = new Set(data.lexicon.sentences.map((s) => s.id));
  for (const skill of data.skills) {
    const params = skill.params as Read<Record<string, unknown>>;
    const filter = params['words'] as
      Read<{ words?: string[]; families?: string[]; exclude?: string[] }> | undefined;
    need('skills', skill.id, 'params.words.words', filter?.words ?? [], words, 'word');
    need('skills', skill.id, 'params.words.exclude', filter?.exclude ?? [], words, 'word');
    need('skills', skill.id, 'params.words.families', filter?.families ?? [], families, 'family');
    const sentenceFilter = params['sentences'] as Read<{ sentences?: string[] }> | undefined;
    need(
      'skills',
      skill.id,
      'params.sentences.sentences',
      sentenceFilter?.sentences ?? [],
      sentences,
      'sentence',
    );
    if (skill.generator === 'family') {
      need('skills', skill.id, 'params.families', skill.params.families ?? [], families, 'family');
    }
  }
  for (const [id, items] of skillItemIndex(data)) {
    if (items.length === 0)
      problem(id, 'params', 'The skill can never produce a problem.', 'empty-skill');
  }

  // Activities: options match their kind; generators suit their activity; inputs suit the kind.
  const skillById = new Map(data.skills.map((s) => [s.id, s]));
  for (const level of data.levels) {
    level.activities.forEach((activity, index) => {
      const allowed = ACTIVITY_OPTION_SCHEMAS[activity.kind];
      for (const [key, value] of Object.entries(activity.options)) {
        const option = allowed[key];
        if (!option)
          problem(
            level.id,
            `activities[${index}].options.${key}`,
            `Unknown option for ${activity.kind}.`,
          );
        else if (!option.parse(value).ok) {
          problem(level.id, `activities[${index}].options.${key}`, 'Option value out of range.');
        }
      }
      for (const skillId of activity.skills) {
        const skill = skillById.get(skillId);
        if (skill && !ACTIVITY_GENERATORS[activity.kind].includes(skill.generator)) {
          problem(
            level.id,
            `activities[${index}].skills`,
            `${activity.kind} cannot serve the ${skill.generator} skill "${skillId}".`,
          );
        }
      }
      if (isMinigameKind(activity.kind) && activity.input !== 'auto') {
        problem(level.id, `activities[${index}].input`, 'Minigames take input "auto".');
      }
      const last = index === level.activities.length - 1;
      if (activity.kind === 'battle' && !(level.kind === 'monster' && last)) {
        problem(
          level.id,
          `activities[${index}].kind`,
          'Only the last activity of a monster level is a battle.',
        );
      }
      if (level.kind === 'monster' && last && activity.kind !== 'battle') {
        problem(level.id, `activities[${index}].kind`, 'A monster level ends with its battle.');
      }
    });
    if ((level.kind === 'monster') !== (level.monster !== null)) {
      problem(level.id, 'monster', 'Monster levels name a monster; lessons do not.');
    }
    if (level.rewards.coins.some((c, i) => i > 0 && c < level.rewards.coins[i - 1]!)) {
      problem(level.id, 'rewards.coins', 'Star coins must not decrease with more stars.');
    }
  }

  // Regions: unique map order and per-region level order; the region monster has a level.
  const regionOrders = data.regions.map((r) => r.order);
  if (new Set(regionOrders).size !== regionOrders.length) {
    problem('regions', 'order', 'Region map order must be unique.');
  }
  const orderKeys = data.levels.map((l) => `${l.region}#${l.order}`);
  orderKeys.forEach((key, index) => {
    if (orderKeys.indexOf(key) !== index) {
      problem(data.levels[index]!.id, 'order', 'Level order must be unique within its region.');
    }
  });
  for (const region of data.regions) {
    const monsterLevels = data.levels.filter((l) => l.region === region.id && l.kind === 'monster');
    if (region.monster !== null && !monsterLevels.some((l) => l.monster === region.monster)) {
      problem(region.id, 'monster', 'The region monster needs a monster level in the region.');
    }
  }

  // Grades: one start per grade, in a region of that grade; grades never fall along the map.
  const regionById = new Map(data.regions.map((r) => [r.id, r]));
  unique(
    'grades',
    data.grades.map((g) => String(g.grade)),
  );
  for (const entry of data.grades) {
    const id = `grade-${entry.grade}`;
    need('grades', id, 'start', [entry.start], regions, 'region');
    const region = regionById.get(entry.start);
    if (region && region.grade !== entry.grade)
      problem(id, 'start', 'A grade starts in a region of that grade.');
  }
  const served = new Set(GRADES.filter((g) => gradeStart(data, g) !== null));
  const byOrder = [...data.regions].sort((a, b) => a.order - b.order);
  byOrder.forEach((region, index) => {
    const previous = byOrder[index - 1];
    if (previous && previous.grade > region.grade) {
      problem(region.id, 'grade', 'Region grades must not decrease along the map order.');
    }
    if (!served.has(region.grade)) problem(region.id, 'grade', 'The content serves no such grade.');
  });
  const unserved = (filter: readonly Grade[] | undefined) =>
    (filter ?? []).some((g) => !served.has(g));
  for (const beat of data.story.beats) {
    if (unserved(beat.trigger.grades)) {
      problem(beat.id, 'trigger.grades', 'The content serves no such grade.', 'missing-reference');
    }
  }
  data.placement.steps.forEach((step, index) => {
    if (unserved(step.grades))
      problem(`step-${index}`, 'grades', 'The content serves no such grade.', 'missing-reference');
  });
  for (const objective of data.objectives) {
    if (!served.has(objective.grade))
      problem(objective.id, 'grade', 'The content serves no such grade.');
    if (!objective.titleKey.startsWith(GROWN_UPS_KEY_PREFIX)) {
      problem(
        objective.id,
        'titleKey',
        `Objectives are named in the grown-ups' area only: use a "${GROWN_UPS_KEY_PREFIX}" key.`,
      );
    }
  }

  // Monsters: arms share the meter evenly and need a skill per arm; one finale.
  for (const monster of data.monsters) {
    const arms = monster.arms ?? 1;
    if (monster.meter % arms !== 0)
      problem(monster.id, 'arms', 'The meter must share evenly between the arms.');
    for (const level of data.levels.filter((l) => l.monster === monster.id)) {
      const last = level.activities[level.activities.length - 1];
      if (last && last.kind === 'battle' && last.skills.length < arms) {
        problem(level.id, 'activities', 'A monster with several arms needs a skill per arm.');
      }
    }
  }
  if (data.monsters.filter((m) => m.finale === true).length > 1) {
    problem('monsters', 'finale', 'Only one monster can be the finale.');
  }

  // Unlock graph: acyclic and every level reachable from a start region.
  const levelById = new Map(data.levels.map((l) => [l.id, l]));
  const startRegions = new Set(data.grades.map((g) => g.start));
  const requires = (levelId: string): string[] => {
    const level = levelById.get(levelId);
    if (!level) return [];
    const region = startRegions.has(level.region)
      ? []
      : (regionById.get(level.region)?.unlock.after ?? []);
    return [...level.unlock.after, ...region];
  };
  const reached = new Set<string>();
  for (let progress = true; progress;) {
    progress = false;
    for (const level of data.levels) {
      if (!reached.has(level.id) && requires(level.id).every((id) => reached.has(id))) {
        reached.add(level.id);
        progress = true;
      }
    }
  }
  for (const level of data.levels) {
    if (!reached.has(level.id)) {
      problem(
        level.id,
        'unlock.after',
        'Unreachable: its unlock requirements form a cycle or depend on an unreachable level.',
        'unreachable',
      );
    }
  }

  // Growth, Leitner, response and daily sanity.
  if (data.balance.growth.map((g) => g.stage).join(',') !== 'baby,grown,crowned') {
    problem('balance', 'growth', 'Growth rules list baby, grown, crowned in order.');
  }
  const intervals = data.balance.leitner.intervals;
  if (intervals.some((value, i) => i > 0 && value < intervals[i - 1]!)) {
    problem('balance', 'leitner.intervals', 'Leitner intervals must not decrease.');
  }
  const { daily, chest, mix, response, input } = data.balance;
  const effort = data.balance.mastery.effort;
  if (effort !== undefined && effort.bronzeDays > effort.silverDays) {
    problem('balance', 'mastery.effort', 'bronzeDays must not exceed silverDays.');
  }
  if (!(daily.goalMin <= daily.goalAnswers && daily.goalAnswers <= daily.goalMax)) {
    problem('balance', 'daily', 'goalMin <= goalAnswers <= goalMax.');
  }
  if (chest.coinsMin > chest.coinsMax)
    problem('balance', 'chest', 'coinsMin must not exceed coinsMax.');
  if (mix.minLearningShare > mix.maxLearningShare) {
    problem('balance', 'mix', 'minLearningShare must not exceed maxLearningShare.');
  }
  for (const [name, timing] of Object.entries(response)) {
    if (typeof timing === 'object' && timing.fastMs > timing.okMs) {
      problem('balance', `response.${name}`, 'fastMs must not exceed okMs.');
    }
  }
  if (input.lettersFromBox > input.typedFromBox) {
    problem(
      'balance',
      'input',
      'The letter pad comes before typing (lettersFromBox <= typedFromBox).',
    );
  }
  if (data.placement.minProblems > data.placement.maxProblems) {
    problem('placement', 'minProblems', 'minProblems must not exceed maxProblems.');
  }

  // Story: beat graphs are unique; scenes are scene or map art; every story reward is claimed.
  const graphIds = data.story.beats.map((b) => b.graph.id);
  if (new Set(graphIds).size !== graphIds.length)
    problem('story', 'beats', 'Each beat needs its own graph ID.');
  for (const beat of data.story.beats) {
    for (const scene of beat.graph.catalogs.scene) {
      if (!BEAT_SCENE_PATTERN.test(scene)) {
        problem(beat.id, 'graph.catalogs.scene', `"${scene}" is not a scene or map art ID.`);
      }
    }
  }
  const rewardIds = new Set(data.story.beats.flatMap((b) => b.graph.catalogs.reward));
  for (const reward of data.story.rewards) {
    if (!rewardIds.has(reward.reward)) {
      problem(reward.reward, 'reward', 'No beat claims this reward.', 'missing-reference');
    }
  }
  return out;
}

/** The registration passed to the runtime host and to `parseContentJson`. */
export const contentRegistration: ContentRegistration<ContentData> = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  schema: contentDataSchema,
  validate: validateContentData,
};

// ---------------------------------------------------------------------------------------------
// Cross-file references (catalog strings, art, curriculum), checked by scripts/validate-content.mjs

/**
 * Every catalog key a pack refers to, with where it is used (resolved with `catalogHasKey`):
 * the records' title, name and joke keys, story lines, and the grammar terms its skills can show
 * (`grammarKeys`).
 */
export function collectCatalogKeys(data: Read<ContentData>): { key: string; where: string }[] {
  const keys: { key: string; where: string }[] = [];
  const add = (key: string, where: string) => keys.push({ key, where });
  data.objectives.forEach((o) => add(o.titleKey, `objective ${o.id}`));
  data.regions.forEach((r) => add(r.titleKey, `region ${r.id}`));
  data.levels.forEach((l) => add(l.titleKey, `level ${l.id}`));
  data.skills.forEach((s) => {
    add(s.titleKey, `skill ${s.id}`);
    for (const key of grammarKeys(s)) add(key, `skill ${s.id}`);
  });
  data.friends.forEach((f) => {
    add(f.nameKey, `friend ${f.id}`);
    add(f.mnemonicKey, `friend ${f.id}`);
  });
  data.monsters.forEach((m) => {
    add(m.nameKey, `monster ${m.id}`);
    m.jokes.forEach((joke) => add(joke, `monster ${m.id} joke`));
  });
  data.inkoustici.forEach((i) => add(i.nameKey, `inkoustík ${i.id}`));
  data.cosmetics.forEach((c) => add(c.nameKey, `cosmetic ${c.id}`));
  data.stickers.forEach((s) => add(s.nameKey, `sticker ${s.id}`));
  data.quests.forEach((q) => add(q.titleKey, `quest ${q.id}`));
  for (const beat of data.story.beats) {
    for (const text of beat.graph.catalogs.text) add(text, `story beat ${beat.id}`);
  }
  return keys;
}

/**
 * The grammar terms a skill's problems and boards can show, as catalog keys (docs/contract.md
 * §7.4): a category value `v` of a dimension `d` is `grammar.<d>.<v>` (`grammar.case.7`,
 * `grammar.pos.noun`, `grammar.pattern.hrad`) and a case also has its question
 * (`grammar.case-question.7`); a spelling rule's hint is `grammar.rule.<rule>`, and the listed-word
 * rule shows the school rhyme of each letter (`grammar.listed.<letter>`); a relation is
 * `grammar.relation.<relation>` and a part of a word `grammar.segment.<role>`.
 */
export function grammarKeys(skill: Read<Skill>): string[] {
  const keys: string[] = [];
  const values = (dimension: Dimension, list: readonly string[]) => {
    for (const value of list) {
      keys.push(`grammar.${dimension}.${value}`);
      if (dimension === 'case') keys.push(`grammar.case-question.${value}`);
    }
  };
  switch (skill.generator) {
    case 'spell.word':
    case 'spell.sentence':
    case 'spell.mistake':
      for (const rule of skill.params.rules) keys.push(`grammar.rule.${rule}`);
      if (skill.params.rules.includes('vyjm')) {
        for (const letter of LISTED_LETTERS) keys.push(`grammar.listed.${letter}`);
      }
      break;
    case 'classify':
      values(
        skill.params.dimension,
        skill.params.values ?? DIMENSION_VALUES[skill.params.dimension],
      );
      break;
    case 'sort':
      values(skill.params.dimension, skill.params.values);
      break;
    case 'odd-one-out':
      if (skill.params.basis !== 'family' && skill.params.basis !== 'listed') {
        values(skill.params.basis, DIMENSION_VALUES[skill.params.basis]);
      }
      break;
    case 'relation':
      for (const relation of skill.params.relations) keys.push(`grammar.relation.${relation}`);
      break;
    case 'segment':
      for (const role of skill.params.roles) keys.push(`grammar.segment.${role}`);
      break;
    default:
      break;
  }
  return [...new Set(keys)];
}

/**
 * Every art catalog ID a pack refers to, by the conventions of media.ts: friends (baby, grown,
 * egg), monsters (inked, freed), Inkoustíci, region scenes, the sea maps, cosmetics, stickers and
 * the scenes and assets of story beats.
 */
export function collectArtIds(data: Read<ContentData>): { id: string; where: string }[] {
  const art: { id: string; where: string }[] = [];
  const add = (id: string, where: string) => art.push({ id, where });
  for (const friend of data.friends) {
    for (const stage of PAINTED_STAGES) add(ART.friend(friend.id, stage), `friend ${friend.id}`);
    add(ART.egg(friend.id), `friend ${friend.id} egg`);
  }
  for (const monster of data.monsters) {
    add(ART.monster(monster.id, 'inked'), `monster ${monster.id}`);
    add(ART.monster(monster.id, 'freed'), `monster ${monster.id}`);
  }
  data.inkoustici.forEach((i) => add(ART.inkoustik(i.id), `inkoustík ${i.id}`));
  data.regions.forEach((r) => add(ART.scene(r.id), `region ${r.id} scene`));
  for (const map of new Set(data.regions.map((r) => r.map))) add(ART.map(map), `map ${map}`);
  data.cosmetics.forEach((c) => add(c.assetId, `cosmetic ${c.id}`));
  for (const s of data.stickers) {
    add(s.icon, `sticker ${s.id} icon`);
    add(s.frame, `sticker ${s.id} frame`);
  }
  for (const beat of data.story.beats) {
    for (const scene of beat.graph.catalogs.scene) add(scene, `story beat ${beat.id} scene`);
    for (const asset of beat.graph.catalogs.asset) add(asset, `story beat ${beat.id} asset`);
  }
  return art;
}

/** Diagnostics for art references missing from the published art catalog. */
export function checkArtCatalog(
  data: Read<ContentData>,
  catalogIds: readonly string[],
): RuntimeDiagnostic[] {
  const known = new Set(catalogIds);
  return collectArtIds(data)
    .filter(({ id }) => !known.has(id))
    .map(({ id, where }) => ({
      code: 'missing-art',
      message: `Art ID "${id}" (${where}) is not in assets/art/catalog.json.`,
      file: CONTENT_FILE,
      recordId: id,
    }));
}

/**
 * Curriculum coverage: objectives with no lesson level or no monster level. The content gate
 * (`--strict-coverage`) fails on any.
 */
export function curriculumGaps(
  data: Read<ContentData>,
): { objective: string; missing: ('lesson' | 'monster')[] }[] {
  return data.objectives.flatMap((objective) => {
    const levels = data.levels.filter((level) => level.objectives.includes(objective.id));
    const missing: ('lesson' | 'monster')[] = [];
    if (!levels.some((level) => level.kind === 'lesson')) missing.push('lesson');
    if (!levels.some((level) => level.kind === 'monster')) missing.push('monster');
    return missing.length ? [{ objective: objective.id, missing }] : [];
  });
}
