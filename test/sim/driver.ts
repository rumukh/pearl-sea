/**
 * The learner simulation: a synthetic child (learners.ts) plays the real rules headlessly through
 * the runtime host, one simulated day after another. Each day it starts a session and follows
 * the daily adventure (`hub.next`, docs/design.md §4.2): story, the first egg, the placement
 * check, Svačinka, the next level, a minigame or review replay, the treasure chest. With nothing
 * new it feeds hungry friends, replays its weakest level or races. A session lasts about 15
 * minutes (`answersPerDay` answers); the child finishes the round it is in, claims finished
 * quests, opens the chest, then buys the cheapest cosmetic it can afford and puts it on a friend.
 * Story beats take their first offered choice.
 *
 * Problems are answered by the learner model; boards are played by the trace harness
 * (test/traces/support.ts), clumsily for a clumsy learner. Each step is one plain `dispatch`
 * (the command traces' bookkeeping would double the cost of a simulated month).
 *
 * The report records, per day, what a parent would see (answers, success, speed, coins by reason,
 * stickers, eggs, hatches and growth, levels and monsters, quests, the goal, the chest) and how
 * overdue the oldest due known item was when the session began.
 */
import type { ContentPack } from '@aegis/runtime';
import { dayNumber, isMinigameKind, isoDay } from '../../src/rules/contract';
import type {
  ContentData,
  FriendStage,
  GameAction,
  Grade,
  MasteryLevel,
  ProblemRoundView,
  ProfileState,
} from '../../src/rules/contract';
import { isBoardGenerator, itemIndex, itemsOf } from '../../src/rules/learning/index-cache';
import { MASTERY_RANK, masteryLevel } from '../../src/rules/learning/items';
import { Player, loadPack, oracle, wrongAnswer } from '../traces/support';
import { friendSet } from '../../src/rules/progression/friends';
import { GrowthProbes } from './growth';
import type { GrowthVariant } from './growth';
import { LEARNERS, Learner } from './learners';
import type { LearnerName } from './learners';

/** The simulation starts on a Monday (2 November 2026). */
export const FIRST_DAY = '2026-11-02';

/** A known item: Leitner box 2 and up (the review guarantee covers those). */
export const KNOWN_BOX = 2;

export interface DayReport {
  /** 0-based day of the simulation. */
  index: number;
  day: string;
  played: boolean;
  answers: number;
  correct: number;
  fast: number;
  /** Total answering time, in milliseconds: a proxy for the session's length. */
  answerMs: number;
  coins: number;
  coinsBy: Record<string, number>;
  stickers: string[];
  eggs: string[];
  hatched: string[];
  /** `friend:stage` for every growth step past hatching. */
  grew: string[];
  /** Levels completed for the first time, and monsters freed. */
  levels: string[];
  monsters: string[];
  /** Pearls that turned silver or gold today (the Great Shell's progress, like a lit pane). */
  pearls: number;
  /** Board rounds started (necklace, Pexeso, nets, shell, family): time the answers do not count. */
  boardRounds: number;
  /** Cosmetics bought, and those owned at the end of the day. */
  bought: string[];
  cosmeticsOwned: number;
  quests: number;
  goalReached: boolean;
  chestOpened: boolean;
  ambushes: number;
  /** Known items whose review day had come when the session began, and the longest wait. */
  dueAtStart: number;
  maxOverdueAtStart: number;
  /** The three most overdue of them (`item:days`). */
  overdueAtStart: string[];
  /** Commits the day took (a cost measure). */
  commits: number;
  /** Answers and right answers by the round's activity (feeding, ink-sentence, snack, battle …). */
  byActivity: Record<string, { answers: number; correct: number }>;
}

export interface SimulationReport {
  learner: LearnerName;
  seed: string;
  daysSimulated: number;
  content: {
    revision: string;
    levels: string[];
    monsters: string[];
    regions: { id: string; lessons: string[]; monster: string | null }[];
    /** Each friend with the monster whose freeing lets it grow up. */
    friends: { id: string; monster: string | null }[];
    cosmetics: number;
    /** The finale monster's level, if the pack has one. */
    finale: string | null;
  };
  days: DayReport[];
  /** Rejected steps: a simulation of a valid child has none. */
  failures: string[];
  /** Day index each friend first reached each stage (its egg: the day it arrived). */
  stages: Record<string, Partial<Record<FriendStage, number>>>;
  finalStages: Record<string, FriendStage>;
  /** Each owned friend at the end: stage, mastery shares (percent), items, due and unseen items. */
  friends: Record<
    string,
    {
      stage: string;
      seen: number;
      bronze: number;
      silver: number;
      gold: number;
      items: number;
      due: number;
      /** Items of its set the child never answered. */
      unseen: string[];
    }
  >;
  stars: Record<string, number>;
  levelDays: Record<string, number>;
  monsterDays: Record<string, number>;
  eggDays: Record<string, number>;
  finaleDay: number | null;
  coins: number;
  stickers: number;
  /** Known items past their review day at the end, most overdue first. */
  overdue: { item: string; days: number }[];
  /** Answered items by mastery at the end (the Great Shell's pearls). */
  mastery: Record<MasteryLevel, number>;
  /** Items no board trains (answered by problems only) at silver and at gold at the end. */
  problemOnly: { items: number; silver: number; gold: number; goldItems: string[] };
  /** Per growth variant (`growthVariants`): friend → stage → the first day it was reached. */
  growthVariants: Record<string, Record<string, Partial<Record<FriendStage, number>>>>;
}

/** The trace harness with plain dispatch steps, answering as the learner decides. */
class SimPlayer extends Player {
  private simSteps = 0;
  /** Answers and right answers so far, by the round's activity. */
  readonly tally: Record<string, { answers: number; correct: number }> = {};
  /** The simulation's day index, for the answer log. */
  dayIndex = 0;

  constructor(
    readonly learner: Learner,
    seed: string,
    pack: ContentPack<ContentData>,
    private readonly onAnswer?: (answer: AnswerRecord) => void,
  ) {
    super(
      { right: () => true, elapsedMs: () => 2000, clumsy: learner.profile.clumsy },
      seed,
      undefined,
      pack,
    );
  }

  override async act(action: GameAction): Promise<boolean> {
    // A simulated month is long: let the test runner's messages through now and then.
    if (++this.simSteps % 20 === 0) await new Promise((resolve) => setImmediate(resolve));
    const outcome = await this.host.dispatch(action);
    if (!outcome.ok) {
      this.failures.push(`${action.type}: ${outcome.error.code}`);
      return false;
    }
    return true;
  }

  override async answer(): Promise<boolean> {
    const round = this.view().round;
    if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) return false;
    this.answered += 1;
    const record = this.onAnswer
      ? (this.state() as ProfileState).items[round.problem.item]
      : undefined;
    const { right, elapsedMs, recall } = this.learner.respond(round);
    this.onAnswer?.({
      day: this.dayIndex,
      activity: round.activity,
      input: round.problem.input,
      item: round.problem.item,
      box: record?.box ?? -1,
      overdue: record ? this.learner.day - record.due : 0,
      recall,
      right,
      elapsedMs,
    });
    const problem = round.problem;
    const value = right
      ? oracle(this.data, problem.problem, problem.step)
      : wrongAnswer(this.data, round as ProblemRoundView);
    const type = round.activity === 'placement' ? 'placementAnswer' : 'answer';
    const counts = (this.tally[round.activity] ??= { answers: 0, correct: 0 });
    counts.answers += 1;
    if (right) counts.correct += 1;
    return this.act({ type, value, elapsedMs });
  }
}

async function resolveStory(player: Player): Promise<void> {
  for (let guard = 0; guard < 30; guard++) {
    const story = player.view().story;
    if (story === null) return;
    const choice = story.choices.find((c) => c.enabled);
    if (!(await player.choose(choice ? choice.id : null))) return;
  }
}

/** Play the active round to its end, answering problems and playing boards. */
async function playRound(player: Player): Promise<void> {
  for (let guard = 0; guard < 400; guard++) {
    await resolveStory(player);
    const round = player.view().round;
    if (round === null || round.status !== 'active') return;
    if (round.type === 'problems') {
      if (!(await player.answer())) return;
    } else {
      const before = player.hashes.length;
      await player.playBoard();
      if (player.hashes.length === before) return;
    }
  }
}

async function closeRound(player: Player): Promise<void> {
  await resolveStory(player);
  if (player.view().round !== null) await player.act({ type: 'endRound', reason: 'done' });
  await resolveStory(player);
}

/** Start a level (or one activity of it) and play the run to its end. */
async function playRun(player: Player, start: GameAction): Promise<void> {
  if (!(await player.act(start))) return;
  for (let guard = 0; guard < 12; guard++) {
    await playRound(player);
    await closeRound(player);
    const run = player.view().run;
    if (run === null || run.result !== null || run.next >= run.activities.length) return;
    const index = run.next;
    if (!(await player.act({ type: 'startActivity', activity: { kind: 'level', index } }))) return;
  }
}

async function tidyUp(player: Player): Promise<void> {
  for (const quest of player.view().daily?.quests ?? []) {
    if (quest.done && !quest.claimed) await player.act({ type: 'claimQuest', quest: quest.id });
  }
  if (player.view().daily?.chest === 'ready') await player.act({ type: 'openChest' });
}

/** At the end of a session the child visits U Mrože: the cheapest item, worn at once. */
async function shop(player: Player): Promise<string | null> {
  const item = player
    .view()
    .market.items.filter((i) => i.available && !i.owned && i.affordable)
    .sort((a, b) => a.price - b.price || (a.id < b.id ? -1 : 1))[0];
  if (item === undefined || !(await player.act({ type: 'buy', item: item.id }))) return null;
  const slot = item.slot;
  if (slot === 'grotto') {
    const spot = player.view().grotto.spots.indexOf(null);
    if (spot >= 0) await player.act({ type: 'decorate', spot, item: item.id });
  } else {
    const friend = player.view().friends.find((f) => f.stage !== 'egg' && f.outfit[slot] === null);
    if (friend !== undefined) {
      await player.act({ type: 'equip', friend: friend.id, slot, item: item.id });
    }
  }
  return item.id;
}

/** Free play: hungry friends first, then the weakest finished level, then the race. */
async function freePlay(player: Player, budgetLeft: number): Promise<boolean> {
  const view = player.view();
  if (view.hub.hungry.length > 0) {
    if (await player.act({ type: 'startActivity', activity: { kind: 'snack', friend: null } })) {
      await playRound(player);
      await closeRound(player);
      return true;
    }
  }
  const replay = view.hub.regions
    .filter((r) => r.unlocked)
    .flatMap((r) => r.levels)
    .filter((l) => l.status === 'completed' && l.stars < 3)
    .sort((a, b) => a.stars - b.stars || a.order - b.order)[0];
  if (replay !== undefined) {
    await playRun(player, { type: 'startLevel', level: replay.id });
    return true;
  }
  if (view.hub.race.available && budgetLeft > 0) {
    if (await player.act({ type: 'startActivity', activity: { kind: 'race' } })) {
      for (let n = 0; n < budgetLeft && player.view().round?.status === 'active'; n++) {
        if (!(await player.answer())) break;
      }
      if (player.view().round?.status === 'active') {
        await player.act({ type: 'endRound', reason: 'time-up' });
      }
      await closeRound(player);
      return true;
    }
  }
  return false;
}

async function playSession(player: Player, budget: number, egg: string | null): Promise<string[]> {
  const start = player.answered;
  for (let guard = 0; guard < 80; guard++) {
    await resolveStory(player);
    await tidyUp(player);
    const left = budget - (player.answered - start);
    if (left <= 0) break;
    const before = player.hashes.length;
    const view = player.view();
    const run = view.run;
    if (view.round !== null && view.round.status === 'active') {
      await playRound(player);
      await closeRound(player);
    } else if (view.round !== null) {
      await closeRound(player);
    } else if (run !== null && run.result === null && run.next < run.activities.length) {
      await playRun(player, {
        type: 'startActivity',
        activity: { kind: 'level', index: run.next },
      });
    } else {
      const next = view.hub.next;
      if (next.kind === 'first-friend') {
        const choice = egg ?? view.onboarding.choices[0];
        if (choice !== undefined) await player.act({ type: 'chooseFirstFriend', friend: choice });
      } else if (next.kind === 'placement' || next.kind === 'snack') {
        const activity =
          next.kind === 'placement'
            ? { kind: 'placement' as const }
            : { kind: 'snack' as const, friend: next.friend };
        if (await player.act({ type: 'startActivity', activity })) {
          await playRound(player);
          await closeRound(player);
        }
      } else if (next.kind === 'level') {
        await playRun(player, { type: 'startLevel', level: next.level });
      } else if (next.kind === 'minigame') {
        await playRun(player, { type: 'startLevel', level: next.level, activity: next.activity });
      } else if (next.kind === 'chest') {
        await player.act({ type: 'openChest' });
      } else if (next.kind === 'free-play') {
        if (!(await freePlay(player, left))) break;
      }
    }
    if (player.hashes.length === before) break;
  }
  await resolveStory(player);
  await tidyUp(player);
  const bought = await shop(player);
  return bought === null ? [] : [bought];
}

/** The items some board trains: the items of every board skill (necklace, Pexeso, nets, shell, family). */
export function boardItems(data: ContentData): Set<string> {
  const index = itemIndex(data);
  return new Set(
    itemsOf(
      data.skills.filter((skill) => isBoardGenerator(skill.generator)).map((skill) => skill.id),
      index,
    ),
  );
}

/** Whether a monster level frees the finale monster. */
function finaleMonster(data: ContentData, levelId: string): boolean {
  const level = data.levels.find((l) => l.id === levelId);
  const region = data.regions.find((r) => r.id === level?.region);
  return data.monsters.some((m) => m.id === region?.monster && m.finale === true);
}

/** The known items whose review day `day` has reached, most overdue first. */
export function overdueKnown(
  items: Readonly<Record<string, { readonly box: number; readonly due: number }>>,
  day: number,
): { item: string; days: number }[] {
  return Object.entries(items)
    .filter(([, record]) => record.box >= KNOWN_BOX && record.due <= day)
    .map(([item, record]) => ({ item, days: day - record.due }))
    .sort((a, b) => b.days - a.days || (a.item < b.item ? -1 : 1));
}

export function emptyDay(index: number, day: string, played: boolean): DayReport {
  return {
    index,
    day,
    played,
    answers: 0,
    correct: 0,
    fast: 0,
    answerMs: 0,
    coins: 0,
    coinsBy: {},
    stickers: [],
    eggs: [],
    hatched: [],
    grew: [],
    levels: [],
    monsters: [],
    pearls: 0,
    boardRounds: 0,
    bought: [],
    cosmeticsOwned: 0,
    quests: 0,
    goalReached: false,
    chestOpened: false,
    ambushes: 0,
    dueAtStart: 0,
    maxOverdueAtStart: 0,
    overdueAtStart: [],
    commits: 0,
    byActivity: {},
  };
}

export interface SimulateOptions {
  seed?: string;
  days?: number;
  /** The child's school grade, set before the first session (default 3). */
  grade?: Grade;
  /** The first egg the child chooses (default: the first offered). */
  egg?: string;
  pack?: ContentPack<ContentData>;
  /** Answers per session instead of the learner's own (a short run for the Vitest gate). */
  answersPerDay?: number;
  /** Other growth rules to follow alongside the shipped ones (growth.ts; check (a)). */
  growthVariants?: readonly GrowthVariant[];
  /** Called after every simulated day (progress reporting in the script). */
  onDay?: (day: DayReport) => void;
  /** Called for every answer (the script's `--answers` log). */
  onAnswer?: (answer: AnswerRecord) => void;
}

/** One answer as the rules and the child saw it (the script's `--answers` log). */
export interface AnswerRecord {
  /** The simulation's day index (0 = the first day). */
  day: number;
  activity: string;
  input: string;
  item: string;
  /** The item's Leitner box before the answer (-1: never served before). */
  box: number;
  /** Days past its review day (negative: not due yet). */
  overdue: number;
  /** How well the item came to mind (0-100). */
  recall: number;
  right: boolean;
  elapsedMs: number;
}

type Payload = Record<string, unknown>;

/** Simulate `name` playing for `days` days and report what happened. */
export async function simulate(
  name: LearnerName,
  options: SimulateOptions = {},
): Promise<SimulationReport> {
  const seed = options.seed ?? 'simulation';
  const pack = options.pack ?? loadPack();
  const data = pack.data;
  const profile = LEARNERS[name];
  const learner = new Learner(profile, data, seed);
  const player = new SimPlayer(learner, seed, pack, options.onAnswer);
  const days = options.days ?? 28;
  const budget = options.answersPerDay ?? profile.answersPerDay;
  const report: SimulationReport = {
    learner: name,
    seed,
    daysSimulated: days,
    content: {
      revision: pack.revision,
      levels: data.levels.map((l) => l.id),
      monsters: data.levels.filter((l) => l.kind === 'monster').map((l) => l.id),
      regions: [...data.regions]
        .sort((a, b) => a.order - b.order)
        .map((region) => ({
          id: region.id,
          lessons: data.levels
            .filter((l) => l.region === region.id && l.kind === 'lesson')
            .map((l) => l.id),
          monster:
            data.levels.find((l) => l.region === region.id && l.kind === 'monster')?.id ?? null,
        })),
      friends: data.friends.map((f) => ({ id: f.id, monster: f.monster })),
      cosmetics: data.cosmetics.length,
      finale:
        data.levels.find((l) => l.kind === 'monster' && finaleMonster(data, l.id))?.id ?? null,
    },
    days: [],
    failures: player.failures,
    stages: {},
    finalStages: {},
    friends: {},
    stars: {},
    levelDays: {},
    monsterDays: {},
    eggDays: {},
    finaleDay: null,
    coins: 0,
    stickers: 0,
    overdue: [],
    mastery: { cloudy: 0, bronze: 0, silver: 0, gold: 0 },
    problemOnly: { items: 0, silver: 0, gold: 0, goldItems: [] },
    growthVariants: {},
  };
  const probes =
    options.growthVariants === undefined ? null : new GrowthProbes(data, options.growthVariants);
  if (options.grade !== undefined) {
    await player.act({ type: 'setSetting', setting: { key: 'grade', value: options.grade } });
  }
  const first = dayNumber(FIRST_DAY)!;
  for (let index = 0; index < days; index++) {
    const day = isoDay(first + index);
    learner.day = first + index;
    player.dayIndex = index;
    if (!profile.playsOn(index)) {
      report.days.push(emptyDay(index, day, false));
      options.onDay?.(report.days.at(-1)!);
      continue;
    }
    const entry = emptyDay(index, day, true);
    const eventsFrom = player.events.length;
    const commitsFrom = player.hashes.length;
    const state = player.state() as ProfileState;
    const due = overdueKnown(state.items, first + index);
    entry.dueAtStart = due.length;
    entry.maxOverdueAtStart = due[0]?.days ?? 0;
    entry.overdueAtStart = due.slice(0, 3).map((d) => `${d.item}:${d.days}`);
    const msBefore = learner.elapsedMs;
    const tallyBefore = structuredClone(player.tally);
    const shining = (items: ProfileState['items']) =>
      new Set(
        Object.entries(items)
          .filter(([, record]) => MASTERY_RANK.indexOf(masteryLevel(record, data.balance)) >= 2)
          .map(([item, record]) => `${item}:${masteryLevel(record, data.balance)}`),
      );
    const shiningBefore = shining(state.items);
    await player.act({ type: 'startSession', day });
    entry.bought = await playSession(player, budget, options.egg ?? null);
    entry.answerMs = learner.elapsedMs - msBefore;
    entry.commits = player.hashes.length - commitsFrom;
    for (const [activity, counts] of Object.entries(player.tally)) {
      const before = tallyBefore[activity] ?? { answers: 0, correct: 0 };
      if (counts.answers === before.answers) continue;
      entry.byActivity[activity] = {
        answers: counts.answers - before.answers,
        correct: counts.correct - before.correct,
      };
    }
    for (const event of player.events.slice(eventsFrom)) {
      const payload = event.data as Payload;
      switch (event.type) {
        case 'answer.correct':
          entry.answers += 1;
          entry.correct += 1;
          if (payload['bucket'] === 'fast') entry.fast += 1;
          break;
        case 'answer.incorrect':
          entry.answers += 1;
          break;
        case 'coins.earned': {
          const amount = payload['amount'] as number;
          const reason = payload['reason'] as string;
          entry.coins += amount;
          entry.coinsBy[reason] = (entry.coinsBy[reason] ?? 0) + amount;
          break;
        }
        case 'sticker.earned':
          entry.stickers.push(payload['sticker'] as string);
          break;
        case 'egg.received': {
          const friend = payload['friend'] as string;
          entry.eggs.push(friend);
          report.eggDays[friend] ??= index;
          (report.stages[friend] ??= {}).egg ??= index;
          break;
        }
        case 'friend.hatched': {
          const friend = payload['friend'] as string;
          entry.hatched.push(friend);
          (report.stages[friend] ??= {}).baby ??= index;
          break;
        }
        case 'friend.grew': {
          const friend = payload['friend'] as string;
          const stage = payload['stage'] as FriendStage;
          entry.grew.push(`${friend}:${stage}`);
          (report.stages[friend] ??= {})[stage] ??= index;
          break;
        }
        case 'level.completed':
          if (payload['firstTime'] === true) {
            const level = payload['level'] as string;
            entry.levels.push(level);
            report.levelDays[level] ??= index;
          }
          break;
        case 'monster.freed': {
          const monster = payload['monster'] as string;
          entry.monsters.push(monster);
          report.monsterDays[monster] ??= index;
          break;
        }
        case 'quest.claimed':
          entry.quests += 1;
          break;
        case 'daily.goal-reached':
          entry.goalReached = true;
          break;
        case 'chest.opened':
          entry.chestOpened = true;
          break;
        case 'inkoustik.ambushed':
          entry.ambushes += 1;
          break;
        case 'round.started':
          if (isMinigameKind(payload['activity'] as string)) entry.boardRounds += 1;
          break;
        case 'finale.completed':
          report.finaleDay ??= index;
          break;
      }
    }
    const after = player.state() as ProfileState;
    entry.cosmeticsOwned = after.cosmetics.owned.length;
    entry.pearls = [...shining(after.items)].filter((key) => !shiningBefore.has(key)).length;
    probes?.update(after, index);
    report.days.push(entry);
    options.onDay?.(entry);
  }
  const final = player.state() as ProfileState;
  const view = player.view();
  if (probes !== null) report.growthVariants = probes.days;
  for (const friend of view.friends) {
    const record = data.friends.find((f) => f.id === friend.id);
    report.finalStages[friend.id] = friend.stage;
    report.friends[friend.id] = {
      stage: friend.stage,
      ...friend.mastery,
      due: friend.dueItems,
      unseen: record
        ? friendSet(data, record).filter((item) => final.items[item] === undefined)
        : [],
    };
  }
  for (const [level, progress] of Object.entries(final.levels))
    report.stars[level] = progress.stars;
  report.coins = final.coins;
  report.stickers = Object.keys(final.stickers).length;
  report.overdue = overdueKnown(final.items, first + days).slice(0, 20);
  const boardTrained = boardItems(data);
  for (const [item, record] of Object.entries(final.items)) {
    const level = masteryLevel(record, data.balance);
    report.mastery[level] += 1;
    if (boardTrained.has(item)) continue;
    report.problemOnly.items += 1;
    if (level === 'silver') report.problemOnly.silver += 1;
    if (level === 'gold') {
      report.problemOnly.gold += 1;
      if (report.problemOnly.goldItems.length < 10) report.problemOnly.goldItems.push(item);
    }
  }
  await player.dispose();
  return report;
}
