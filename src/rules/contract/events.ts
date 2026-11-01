/**
 * Event vocabulary. Rules emit these as transient runtime events with each commit; the shell turns
 * them into one-shot sounds, animations and announcements (S4 maps events to S5's sound IDs), and
 * tests assert on them by name. Events are never replayed: after a restore the shell rebuilds the
 * screen from the view, not from past events.
 *
 * Names are `<subject>.<verb>`. Payloads are small JSON objects of IDs and numbers.
 */
import type { FriendStage, MasteryLevel } from './ids';
import type { Grade, MinigameActivityKind, ProblemActivityKind, ResponseBucket } from './kinds';
import type { Grant } from './content';

export const EVENTS = {
  // Session and answers
  sessionStarted: 'session.started',
  roundStarted: 'round.started',
  answerCorrect: 'answer.correct',
  answerIncorrect: 'answer.incorrect',
  itemPromoted: 'item.promoted',
  reaskScheduled: 'reask.scheduled',
  hintShown: 'hint.shown',
  // Progression
  roundCompleted: 'round.completed',
  levelCompleted: 'level.completed',
  regionUnlocked: 'region.unlocked',
  placementCompleted: 'placement.completed',
  gradeCompleted: 'grade.completed',
  // Monsters and Inkoustíci
  inkWashed: 'ink.washed',
  inkSplashed: 'ink.splashed',
  armWashed: 'arm.washed',
  monsterFreed: 'monster.freed',
  monsterJoked: 'monster.joked',
  inkoustikAmbushed: 'inkoustik.ambushed',
  inkoustikSplashed: 'inkoustik.splashed',
  // Friends and the Great Shell
  eggReceived: 'egg.received',
  friendHatched: 'friend.hatched',
  friendGrew: 'friend.grew',
  friendCrowned: 'friend.crowned',
  friendDressed: 'friend.dressed',
  grottoDecorated: 'grotto.decorated',
  pearlPolished: 'pearl.polished',
  // Economy, collections and story
  coinsEarned: 'coins.earned',
  itemPurchased: 'item.purchased',
  stickerEarned: 'sticker.earned',
  questCompleted: 'quest.completed',
  questClaimed: 'quest.claimed',
  dailyGoalReached: 'daily.goal-reached',
  chestOpened: 'chest.opened',
  storyAdvanced: 'story.advanced',
  finaleCompleted: 'finale.completed',
  minigameCompleted: 'minigame.completed',
  raceFinished: 'race.finished',
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];

export const EVENT_TYPES: readonly EventType[] = Object.values(EVENTS);

export type CoinReason =
  'answer' | 'streak' | 'stars' | 'monster' | 'ambush' | 'quest' | 'chest' | 'placement' | 'story';

/** Payload of each event type. */
export interface EventPayloads {
  'session.started': { day: string; newDay: boolean };
  'round.started': { round: string; activity: ProblemActivityKind | MinigameActivityKind };
  'answer.correct': { item: string; bucket: Exclude<ResponseBucket, 'miss'>; streak: number };
  'answer.incorrect': { item: string };
  'item.promoted': { item: string; box: number };
  'reask.scheduled': { item: string; dueTurn: number };
  'hint.shown': { item: string };
  'round.completed': { round: string; answered: number; correct: number; fast: number };
  'level.completed': { level: string; stars: number; firstTime: boolean };
  'region.unlocked': { region: string };
  'placement.completed': { placed: string[] };
  /** A grade's finale monster was freed (Ledana: the 3rd grade's sea): its certificate. */
  'grade.completed': { grade: Grade };
  /** A right answer in a battle fired a bubble and washed ink off. */
  'ink.washed': { monster: string; washed: number; target: number };
  /** The monster splashed harmless ink blots on the screen (the child wipes them with a tap). */
  'ink.splashed': { monster: string; blots: number };
  /** One arm of a many-armed monster is clean (Krakatice). */
  'arm.washed': { monster: string; arm: number; arms: number };
  'monster.freed': { monster: string };
  /**
   * The monster tells a joke (a catalog key): at the start of a battle, after every 5th right answer
   * and when it is washed clean. A one-shot: BattleView.jokeKey redraws the bubble after a reload.
   */
  'monster.joked': { monster: string; joke: string };
  'inkoustik.ambushed': { inkoustik: string; item: string };
  'inkoustik.splashed': { inkoustik: string; coins: number };
  'egg.received': { friend: string };
  'friend.hatched': { friend: string };
  'friend.grew': { friend: string; stage: FriendStage };
  'friend.crowned': { friend: string };
  'friend.dressed': { friend: string; slot: string; item: string | null };
  'grotto.decorated': { spot: number; item: string | null };
  /** An item's pearl in the Great Shell reached a new mastery level. */
  'pearl.polished': { item: string; level: MasteryLevel };
  'coins.earned': { amount: number; reason: CoinReason };
  'item.purchased': { item: string; price: number };
  'sticker.earned': { sticker: string };
  'quest.completed': { quest: string };
  'quest.claimed': { quest: string; coins: number };
  'daily.goal-reached': { day: string };
  'chest.opened': { grant: Grant };
  'story.advanced': { beat: string; node: string; finished: boolean };
  'finale.completed': Record<string, never>;
  'minigame.completed': { round: string; board: number };
  'race.finished': { score: number; best: number; record: boolean };
}

/** A typed event, as found in `RuntimeCommit.events` (with `rule` set by the runtime). */
export type GameEvent = { [T in EventType]: { type: T; data: EventPayloads[T] } }[EventType];
