/**
 * Per-profile game state: everything authoritative about one child's game, stored in the runtime
 * snapshot and saved after every commit. Presentation preferences (volumes, text size, reduced
 * motion, read-aloud, the form of address, the grown-ups' language) are NOT here; they live in the
 * family record and the preferences record (persistence.ts), so changing them never touches a
 * game hash.
 *
 * Bounded by design: items are at most the content's item universe; history keeps the last
 * `balance.daily.historyDays` days; rounds keep short rolling lists. Nothing grows per answer.
 * The structure is Dragon Valley's, with sea friends for dragons and monsters for bosses.
 */
import { failure, isRecord, schema, success } from '@aegis/runtime';
import type { RuntimeSnapshot, Schema } from '@aegis/runtime';
import type {
  CosmeticState,
  MinigameDefinition,
  MinigameState,
  NarrativeState,
} from '@aegis/narrative';
import { FRIEND_STAGES } from './ids';
import type { FriendStage } from './ids';
import {
  DEFAULT_GRADE,
  INPUT_MODES,
  MINIGAME_ACTIVITY_KINDS,
  PROBLEM_ACTIVITY_KINDS,
  RESPONSE_BUCKETS,
} from './kinds';
import type {
  Grade,
  InputMode,
  MinigameActivityKind,
  ProblemActivityKind,
  ResolvedInputMode,
  ResponseBucket,
} from './kinds';
import { answerValueSchema, itemIdSchema, problemSchema } from './problems';
import type { AnswerValue, Problem, ProblemStep } from './problems';
import {
  contentId,
  counter,
  gradeSchema,
  idRecord,
  int,
  nullable,
  objectWithOptional,
  oneOf,
  percent,
  uniqueArray,
} from './schema';

/**
 * The adapter's `stateVersion`. Bump it whenever a change to rules semantics or to this schema
 * means an old snapshot cannot continue unchanged, and add an explicit save migration
 * (docs/contract.md §7.6).
 */
export const STATE_VERSION = 1;

/** One step per old version: `STATE_MIGRATIONS[n]` turns version n into n + 1. */
const STATE_MIGRATIONS: Readonly<Record<number, (state: unknown) => unknown>> = {};

/**
 * Upgrades the profile state of an older snapshot to version `to` (default `STATE_VERSION`), one
 * version at a time. Pure and deterministic; never mutates `state`; throws on an unknown version.
 */
export function migrateProfileState(
  state: unknown,
  fromVersion: number,
  to: number = STATE_VERSION,
): unknown {
  if (!Number.isInteger(fromVersion) || fromVersion < 1 || fromVersion > to || to > STATE_VERSION) {
    throw new RangeError(`No profile state migration from version ${fromVersion} to ${to}.`);
  }
  let current = state;
  for (let version = fromVersion; version < to; version++) {
    const step = STATE_MIGRATIONS[version];
    if (step === undefined) throw new RangeError(`No profile state migration from ${version}.`);
    current = step(current);
  }
  return current;
}

/** The world resource where `@aegis/runtime` keeps the adapter state of a snapshot. */
export const RUNTIME_STATE_RESOURCE = 'aegis.runtime.state';

/**
 * A runtime snapshot of an older `stateVersion` upgraded to version `to`: its profile state
 * migrated by `migrateProfileState`, everything else unchanged. The shell applies it to saves
 * before restoring them.
 */
export function migrateSnapshot(
  snapshot: RuntimeSnapshot,
  to: number = STATE_VERSION,
): RuntimeSnapshot {
  if (snapshot.stateVersion === to) return snapshot;
  const resources = snapshot.world.resources;
  if (!(RUNTIME_STATE_RESOURCE in resources))
    throw new TypeError('The snapshot has no profile state.');
  return {
    ...snapshot,
    stateVersion: to,
    world: {
      ...snapshot.world,
      resources: {
        ...resources,
        [RUNTIME_STATE_RESOURCE]: migrateProfileState(
          resources[RUNTIME_STATE_RESOURCE],
          snapshot.stateVersion,
          to,
        ),
      },
    },
  };
}

/** Days since 1970-01-01 in the child's local calendar (see `dayNumber`). */
export type DayNumber = number;

/** Slots worn by a friend; `grotto` cosmetics are placed in the grotto instead. */
export const WEARABLE_SLOTS = ['head', 'eyes', 'neck'] as const;
export type WearableSlot = (typeof WEARABLE_SLOTS)[number];
/** Places for decorations in Bublinka's home grotto. */
export const GROTTO_SPOTS = 6;

/** Spaced-retrieval record of one item. Absent until the item is first served. */
export interface ItemState {
  /** Leitner box 0..5. */
  box: number;
  /** Day the item is next due for review. */
  due: DayNumber;
  seen: number;
  correct: number;
  /** The last (at most 3) response buckets, oldest first. */
  recent: ResponseBucket[];
  lastDay: DayNumber;
  /** The effort path (`balance.mastery.effort`): days with a right answer. */
  rightDays?: number;
  /** The last day counted in `rightDays`; present exactly when `rightDays` is. */
  lastCountedDay?: DayNumber;
}

export interface LevelProgress {
  /** Best stars (0 = played but not completed). */
  stars: number;
  bestAccuracy: number;
  plays: number;
  /** Completed by the placement check rather than played. */
  placed: boolean;
  /** Highest star level whose coins were already paid (0..3). */
  paidStars: number;
}

export interface FriendState {
  /** Never decreases. */
  stage: FriendStage;
  obtainedDay: DayNumber;
  stageDay: DayNumber;
  /** One entry per wearable slot; `null` = nothing worn. Items must be owned. */
  outfit: Record<WearableSlot, string | null>;
}

export interface QuestState {
  /** `<template>@<day>`, unique per day. */
  id: string;
  template: string;
  progress: number;
  claimed: boolean;
}

export interface DailyState {
  day: DayNumber;
  answers: number;
  correct: number;
  fast: number;
  /** Levels completed and minigame rounds finished today (the daily adventure's order). */
  levels: number;
  minigames: number;
  /** The goal for this day (copied from settings when the day starts). */
  goal: number;
  quests: QuestState[];
  /** The treasure chest after the daily goal. */
  chest: 'locked' | 'ready' | 'opened';
}

/** One practised day, for the grown-ups' trend and "days practised this week". */
export interface DayRecord {
  day: DayNumber;
  answers: number;
  correct: number;
  fast: number;
}

export type RoundSource =
  | { kind: 'level'; level: string; activity: number }
  | { kind: 'race' }
  | { kind: 'snack'; friend: string | null }
  | { kind: 'placement' };

export type RoundEndReason = 'finished' | 'quit' | 'time-up' | 'time-limit';

/** The problem on screen. */
export interface CurrentProblem {
  /** 1-based position in the round. */
  index: number;
  item: string;
  problem: Problem;
  input: ResolvedInputMode;
  /** The step being answered: a gap index, or 0 (find) / 1 (fix) of a mistake hunt. */
  step: ProblemStep;
  /** A re-ask of an item missed earlier in this round. */
  reask: boolean;
  /** The child asked for a hint on this problem. */
  hinted: boolean;
  /** Teach, then ask: show the strategy before asking (first meeting, or two misses in a row). */
  teach: boolean;
  /** The Inkoustík ambushing this problem, or `null`. */
  ambush: string | null;
}

/** Feedback for the last answer, kept in state so it survives a reload. */
export interface Feedback {
  index: number;
  item: string;
  step: ProblemStep;
  correct: boolean;
  bucket: ResponseBucket;
  given: AnswerValue;
  expected: AnswerValue;
  coins: number;
  /** The ambushing Inkoustík and whether the answer splashed it away. */
  ambush: { inkoustik: string; splashed: boolean } | null;
}

export interface PlacementProgress {
  step: number;
  stepAsked: number;
  stepCorrect: number;
  missesInRow: number;
  /** Levels marked placed so far. */
  placed: string[];
}

/** A monster battle in progress: the ink washed off so far, per arm for a many-armed monster. */
export interface BattleProgress {
  monster: string;
  /** Right answers counted towards the meter (misses never lower it). */
  washed: number;
  target: number;
  arms: number;
  /** Ink blots splashed so far (the shell shows them; wiping them is presentation only). */
  splashes: number;
}

export interface ProblemRound {
  /** `r<roundCounter>`; unique for the profile's lifetime. */
  id: string;
  type: 'problems';
  activity: ProblemActivityKind;
  source: RoundSource;
  skills: string[];
  input: InputMode;
  /** Problems to answer, or `null` when the round ends by meter (battle) or time (race). */
  target: number | null;
  asked: number;
  answered: number;
  correct: number;
  fast: number;
  streak: number;
  bestStreak: number;
  reasks: number;
  ambushes: number;
  /** Items whose re-ask job has fired, served next, front first. */
  queue: string[];
  /** Recently served items, newest last (no immediate repeats). */
  recent: string[];
  current: CurrentProblem | null;
  feedback: Feedback | null;
  coins: number;
  battle: BattleProgress | null;
  placement: PlacementProgress | null;
  status: 'active' | 'complete';
  endReason: RoundEndReason | null;
}

export interface MinigameRound {
  id: string;
  type: 'minigame';
  activity: MinigameActivityKind;
  source: RoundSource;
  skills: string[];
  /** Boards to complete (the activity's `count`). */
  boards: number;
  completed: number;
  /** The current board: a generated `@aegis/narrative` definition and its instance state. */
  definition: MinigameDefinition;
  state: MinigameState;
  coins: number;
  status: 'active' | 'complete';
  endReason: RoundEndReason | null;
}

export type Round = ProblemRound | MinigameRound;

export interface ActivityResult {
  activity: number;
  answered: number;
  correct: number;
  fast: number;
  completed: boolean;
}

/** A level being played: which activity is next and the results so far. */
export interface LevelRun {
  level: string;
  next: number;
  results: ActivityResult[];
}

export interface StoryState {
  /** Narrative state of the beat in progress (a finished beat keeps only its ID in `done`). */
  beats: Record<string, NarrativeState>;
  /** The beat the shell should present now, if any. */
  pending: string | null;
  /** Triggered beats waiting for the pending one to finish, in order. */
  queue: string[];
  /** Finished or skipped beats. */
  done: string[];
}

/** Settings that change rules (the grown-ups' area). Presentation settings are preferences. */
export interface RuleSettings {
  /** Right answers that make up the daily goal. */
  dailyGoal: number;
  /** Závod s delfíny on or off. */
  race: boolean;
  /** Regions a grown-up unlocked ahead of progress. */
  unlockAhead: string[];
  /** The child's school grade: where the child starts and what the daily adventure suggests. */
  grade: Grade;
}

export interface ProfileState {
  /** Current session day, `null` before the first `startSession`. */
  day: DayNumber | null;
  firstDay: DayNumber | null;
  sessions: number;
  /** Distinct days with a session. */
  daysPracticed: number;
  onboarding: { firstFriend: string | null; placement: 'pending' | 'done' | 'skipped' };
  items: Record<string, ItemState>;
  levels: Record<string, LevelProgress>;
  monsters: Record<string, { freedDay: DayNumber }>;
  friends: Record<string, FriendState>;
  coins: number;
  coinsEarned: number;
  /** Ownership via `@aegis/narrative` idempotent grants. `equipped` stays empty: outfits are per friend. */
  cosmetics: CosmeticState;
  /** Decorations placed in the grotto, by spot (`GROTTO_SPOTS`). Items must be owned. */
  grotto: (string | null)[];
  stickers: Record<string, { day: DayNumber }>;
  daily: DailyState | null;
  history: DayRecord[];
  race: { best: number; plays: number };
  questsClaimed: number;
  bestStreak: number;
  /** Inkoustíci splashed away, all time. */
  splashed: number;
  story: StoryState;
  run: LevelRun | null;
  round: Round | null;
  roundCounter: number;
  settings: RuleSettings;
  finale: { day: DayNumber | null };
}

// ---------------------------------------------------------------------------------------------
// Schemas

const day = int(0, 2_000_000);
const bucket = oneOf(RESPONSE_BUCKETS);

/** A narrative-owned value: structurally checked here, semantically by `adapter.validate`. */
function narrativeValue<T>(label: string): Schema<T> {
  return {
    parse(value: unknown, path = '') {
      const json = schema.json.parse(value);
      if (!json.ok) return json;
      return isRecord(json.value) && json.value['schema'] === 1
        ? success(json.value as T)
        : failure('invalid-data', `Expected ${label} (schema 1).`, { path });
    },
  };
}

const cosmeticStateSchema: Schema<CosmeticState> = schema.object({
  schema: schema.literal(1),
  owned: uniqueArray(contentId, { max: 1000 }),
  claims: schema.array(
    schema.object({ id: schema.string({ minLength: 1, maxLength: 512 }), item: contentId }),
    { max: 4096 },
  ),
  equipped: schema.array(schema.object({ slot: contentId, item: contentId }), { max: 0 }),
});

const roundSourceSchema: Schema<RoundSource> = schema.union(
  schema.object({ kind: schema.literal('level'), level: contentId, activity: int(0, 7) }),
  schema.object({ kind: schema.literal('race') }),
  schema.object({ kind: schema.literal('snack'), friend: nullable(contentId) }),
  schema.object({ kind: schema.literal('placement') }),
);
const endReason = nullable(oneOf(['finished', 'quit', 'time-up', 'time-limit'] as const));
const roundId = schema.string({ minLength: 2, maxLength: 16, pattern: /^r[1-9][0-9]*$/ });

const problemRoundSchema: Schema<ProblemRound> = schema.object({
  id: roundId,
  type: schema.literal('problems'),
  activity: oneOf(PROBLEM_ACTIVITY_KINDS),
  source: roundSourceSchema,
  skills: uniqueArray(contentId, { max: 64 }),
  input: oneOf(INPUT_MODES),
  target: nullable(int(1, 200)),
  asked: int(0, 1000),
  answered: int(0, 1000),
  correct: int(0, 1000),
  fast: int(0, 1000),
  streak: int(0, 1000),
  bestStreak: int(0, 1000),
  reasks: int(0, 100),
  ambushes: int(0, 100),
  queue: schema.array(itemIdSchema, { max: 20 }),
  recent: schema.array(itemIdSchema, { max: 20 }),
  current: nullable(
    schema.object({
      index: int(1, 1000),
      item: itemIdSchema,
      problem: problemSchema,
      input: oneOf(['choice', 'letters', 'typed'] as const),
      step: int(0, 2),
      reask: schema.boolean,
      hinted: schema.boolean,
      teach: schema.boolean,
      ambush: nullable(contentId),
    }),
  ),
  feedback: nullable(
    schema.object({
      index: int(1, 1000),
      item: itemIdSchema,
      step: int(0, 2),
      correct: schema.boolean,
      bucket,
      given: answerValueSchema,
      expected: answerValueSchema,
      coins: int(0, 1000),
      ambush: nullable(schema.object({ inkoustik: contentId, splashed: schema.boolean })),
    }),
  ),
  coins: int(0, 100_000),
  battle: nullable(
    schema.object({
      monster: contentId,
      washed: int(0, 1000),
      target: int(1, 1000),
      arms: int(1, 10),
      splashes: int(0, 1000),
    }),
  ),
  placement: nullable(
    schema.object({
      step: int(0, 100),
      stepAsked: int(0, 100),
      stepCorrect: int(0, 100),
      missesInRow: int(0, 100),
      placed: uniqueArray(contentId, { max: 1000 }),
    }),
  ),
  status: oneOf(['active', 'complete'] as const),
  endReason,
});

const minigameRoundSchema: Schema<MinigameRound> = schema.object({
  id: roundId,
  type: schema.literal('minigame'),
  activity: oneOf(MINIGAME_ACTIVITY_KINDS),
  source: roundSourceSchema,
  skills: uniqueArray(contentId, { max: 64 }),
  boards: int(1, 30),
  completed: int(0, 30),
  definition: narrativeValue<MinigameDefinition>('a minigame definition'),
  state: narrativeValue<MinigameState>('a minigame state'),
  coins: int(0, 100_000),
  status: oneOf(['active', 'complete'] as const),
  endReason,
});

export const profileStateSchema: Schema<ProfileState> = schema.object({
  day: nullable(day),
  firstDay: nullable(day),
  sessions: counter,
  daysPracticed: counter,
  onboarding: schema.object({
    firstFriend: nullable(contentId),
    placement: oneOf(['pending', 'done', 'skipped'] as const),
  }),
  items: schema.record(
    objectWithOptional(
      {
        box: int(0, 5),
        due: day,
        seen: counter,
        correct: counter,
        recent: schema.array(bucket, { max: 3 }),
        lastDay: day,
      },
      { rightDays: counter, lastCountedDay: day },
    ),
  ),
  levels: idRecord(
    schema.object({
      stars: int(0, 3),
      bestAccuracy: percent,
      plays: counter,
      placed: schema.boolean,
      paidStars: int(0, 3),
    }),
  ),
  monsters: idRecord(schema.object({ freedDay: day })),
  friends: idRecord(
    schema.object({
      stage: oneOf(FRIEND_STAGES),
      obtainedDay: day,
      stageDay: day,
      outfit: schema.object({
        head: nullable(contentId),
        eyes: nullable(contentId),
        neck: nullable(contentId),
      }),
    }),
  ),
  coins: counter,
  coinsEarned: counter,
  cosmetics: cosmeticStateSchema,
  grotto: schema.array(nullable(contentId), { min: GROTTO_SPOTS, max: GROTTO_SPOTS }),
  stickers: idRecord(schema.object({ day })),
  daily: nullable(
    schema.object({
      day,
      answers: counter,
      correct: counter,
      fast: counter,
      levels: counter,
      minigames: counter,
      goal: int(1, 1000),
      quests: schema.array(
        schema.object({
          id: schema.string({ minLength: 3, maxLength: 96, pattern: /^[a-z0-9.:-]+@[0-9]+$/ }),
          template: contentId,
          progress: counter,
          claimed: schema.boolean,
        }),
        { max: 5 },
      ),
      chest: oneOf(['locked', 'ready', 'opened'] as const),
    }),
  ),
  history: schema.array(schema.object({ day, answers: counter, correct: counter, fast: counter }), {
    max: 366,
  }),
  race: schema.object({ best: counter, plays: counter }),
  questsClaimed: counter,
  bestStreak: counter,
  splashed: counter,
  story: schema.object({
    beats: idRecord(narrativeValue<NarrativeState>('a narrative state')),
    pending: nullable(contentId),
    queue: uniqueArray(contentId, { max: 100 }),
    done: uniqueArray(contentId, { max: 1000 }),
  }),
  run: nullable(
    schema.object({
      level: contentId,
      next: int(0, 8),
      results: schema.array(
        schema.object({
          activity: int(0, 7),
          answered: int(0, 1000),
          correct: int(0, 1000),
          fast: int(0, 1000),
          completed: schema.boolean,
        }),
        { max: 8 },
      ),
    }),
  ),
  round: nullable(schema.union(problemRoundSchema, minigameRoundSchema)),
  roundCounter: counter,
  settings: schema.object({
    dailyGoal: int(1, 1000),
    race: schema.boolean,
    unlockAhead: uniqueArray(contentId, { max: 100 }),
    grade: gradeSchema,
  }),
  finale: schema.object({ day: nullable(day) }),
});

// ---------------------------------------------------------------------------------------------
// Days (integer civil calendar arithmetic, as Dragon Valley's)

/** Integer division for non-negative operands, without floating point. */
function idiv(a: number, b: number): number {
  return (a - (a % b)) / b;
}

/**
 * Day number of an ISO local date `YYYY-MM-DD` (days since 1970-01-01), or `null` if the text is
 * not a real calendar date in 2000..2999 (H. Hinnant, "days_from_civil").
 */
export function dayNumber(iso: string): DayNumber | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  if (year < 2000 || year > 2999 || month < 1 || month > 12 || date < 1) return null;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (date > lengths[month - 1]!) return null;
  const y = month <= 2 ? year - 1 : year;
  const era = idiv(y, 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = idiv(153 * (month > 2 ? month - 3 : month + 9) + 2, 5) + date - 1;
  const dayOfEra = yearOfEra * 365 + idiv(yearOfEra, 4) - idiv(yearOfEra, 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** ISO local date of a non-negative day number (inverse of `dayNumber`; "civil_from_days"). */
export function isoDay(day: DayNumber): string {
  const z = day + 719468;
  const era = idiv(z, 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = idiv(
    dayOfEra - idiv(dayOfEra, 1460) + idiv(dayOfEra, 36524) - idiv(dayOfEra, 146096),
    365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + idiv(yearOfEra, 4) - idiv(yearOfEra, 100));
  const mp = idiv(5 * dayOfYear + 2, 153);
  const date = dayOfYear - idiv(153 * mp + 2, 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(date)}`;
}

/** Day of week, Monday = 0 ... Sunday = 6 (1970-01-01 was a Thursday). */
export function weekday(day: DayNumber): number {
  return (((day + 3) % 7) + 7) % 7;
}

/**
 * The first state of a new profile. The grade comes from the profile editor and is handed to the
 * game at the first session (as in Dragon Valley); a 3rd grader unless `defaults.grade` says.
 */
export function initialProfileState(defaults: {
  dailyGoal: number;
  race: boolean;
  grade?: Grade;
}): ProfileState {
  return {
    day: null,
    firstDay: null,
    sessions: 0,
    daysPracticed: 0,
    onboarding: { firstFriend: null, placement: 'pending' },
    items: {},
    levels: {},
    monsters: {},
    friends: {},
    coins: 0,
    coinsEarned: 0,
    cosmetics: { schema: 1, owned: [], claims: [], equipped: [] },
    grotto: Array.from({ length: GROTTO_SPOTS }, () => null),
    stickers: {},
    daily: null,
    history: [],
    race: { best: 0, plays: 0 },
    questsClaimed: 0,
    bestStreak: 0,
    splashed: 0,
    story: { beats: {}, pending: null, queue: [], done: [] },
    run: null,
    round: null,
    roundCounter: 0,
    settings: {
      dailyGoal: defaults.dailyGoal,
      race: defaults.race,
      unlockAhead: [],
      grade: defaults.grade ?? DEFAULT_GRADE,
    },
    finale: { day: null },
  };
}
