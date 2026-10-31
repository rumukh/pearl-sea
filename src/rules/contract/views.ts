/**
 * The view: a JSON projection of the state for the shell, recomputed by the rules on every commit
 * and the only thing screens render from (plus the commit's events for one-shots). Everything a
 * screen needs is precomputed here, so the shell holds no game logic: map status, stars, the
 * current problem and its step, feedback, friends and their expressions, the Great Shell's
 * pearls, monster battles, U Mrože, the album, the daily quests and the grown-ups' statistics.
 *
 * Text is never rendered here: `*Key` fields are catalog keys, problems are structured
 * (problems.ts), words carry their Czech text from the lexicon, and days are ISO dates.
 */
import type { JsonValue } from '@aegis/runtime';
import type { FriendExpression, FriendStage, MasteryLevel, SeaMap } from './ids';
import type {
  Grade,
  InputMode,
  MinigameActivityKind,
  ProblemActivityKind,
  ResolvedInputMode,
  Strand,
} from './kinds';
import type { MonsterMood, QuestGoal } from './content';
import type { BoardView } from './minigames';
import type { Problem, ProblemStep } from './problems';
import type { Feedback, RoundEndReason, RoundSource, RuleSettings, WearableSlot } from './state';
import type { CosmeticSlot } from './ids';

/** What the shell should show when it has no other navigation intent. */
export type Screen = 'story' | 'hub' | 'round' | 'results';

export interface GameView {
  revision: number;
  turn: number;
  /** The session's local date, `null` before the first session. */
  day: string | null;
  screen: Screen;
  coins: number;
  settings: RuleSettings;
  onboarding: {
    firstFriend: string | null;
    /** The eggs Osmička offers when no friend was chosen yet, else empty. */
    choices: string[];
    placement: 'pending' | 'done' | 'skipped';
  };
  story: StoryView | null;
  hub: HubView;
  run: RunView | null;
  round: RoundView | null;
  friends: FriendView[];
  shell: ShellView;
  gallery: GalleryView;
  grotto: GrottoView;
  market: MarketView;
  album: AlbumView;
  daily: DailyView | null;
  grownUps: GrownUpsView;
}

// ------------------------------------------------------------------------------ story

export interface StoryView {
  beat: string;
  skippable: boolean;
  node: string;
  /** Art ID of the scene. */
  scene: string;
  /** Catalog key of the line; read aloud by the shell. */
  text: string;
  revision: number;
  choices: { id: string; text: string; enabled: boolean }[];
  finished: boolean;
}

// ------------------------------------------------------------------------------ hub / map

export type LevelStatus = 'locked' | 'open' | 'completed';

export interface LevelCard {
  id: string;
  titleKey: string;
  order: number;
  kind: 'lesson' | 'monster';
  status: LevelStatus;
  stars: number;
  placed: boolean;
  /** The level the map should make glow (the next suggestion). */
  glowing: boolean;
}

export interface RegionView {
  id: string;
  titleKey: string;
  order: number;
  map: SeaMap;
  grade: Grade;
  unlocked: boolean;
  monster: {
    id: string;
    nameKey: string;
    mood: MonsterMood;
    freed: boolean;
    arms: number;
  } | null;
  levels: LevelCard[];
}

/** The daily adventure's next step, in priority order (docs/design.md §4). */
export type NextStep =
  | { kind: 'story'; beat: string }
  | { kind: 'first-friend' }
  | { kind: 'placement' }
  | { kind: 'snack'; friend: string | null }
  | { kind: 'level'; level: string }
  | { kind: 'minigame'; level: string; activity: number }
  | { kind: 'chest' }
  | { kind: 'free-play' };

export interface HubView {
  regions: RegionView[];
  next: NextStep;
  /** Friends with due items ("hungry for a snack"). */
  hungry: string[];
  race: { available: boolean; best: number };
  /** Grade certificates earned (the 3rd grade's sea done). */
  certificates: Grade[];
}

// ------------------------------------------------------------------------------ rounds

export interface RunView {
  level: string;
  next: number;
  activities: { index: number; kind: ProblemActivityKind | MinigameActivityKind; done: boolean }[];
  result: { stars: number; accuracy: number; firstTime: boolean } | null;
}

export interface ProblemView {
  index: number;
  item: string;
  problem: Problem;
  input: ResolvedInputMode;
  step: ProblemStep;
  /** Steps of the problem (gaps, or find and fix). */
  steps: number;
  reask: boolean;
  hinted: boolean;
  teach: boolean;
  /** The Inkoustík smudging this problem, or `null`. */
  ambush: string | null;
}

export interface BattleView {
  monster: string;
  nameKey: string;
  /** Ink left, as washed of target (the shell draws the meter). */
  washed: number;
  target: number;
  arms: number;
  /** Arms already clean (washed * arms / target, rounded down). */
  armsWashed: number;
  /** The current joke (catalog key), or `null`. */
  jokeKey: string | null;
  /** Ink blots splashed so far: the shell shows new ones for the child to wipe away. */
  splashes: number;
}

export interface ProblemRoundView {
  id: string;
  type: 'problems';
  activity: ProblemActivityKind;
  source: RoundSource;
  input: InputMode;
  status: 'active' | 'complete';
  endReason: RoundEndReason | null;
  progress: { answered: number; target: number | null; correct: number; streak: number };
  problem: ProblemView | null;
  feedback: Feedback | null;
  coins: number;
  /** The friend being fed or cheering, and its expression hint. */
  friend: { id: string; expression: FriendExpression } | null;
  battle: BattleView | null;
  placement: { step: number; steps: number; placed: string[] } | null;
}

export interface MinigameRoundView {
  id: string;
  type: 'minigame';
  activity: MinigameActivityKind;
  source: RoundSource;
  status: 'active' | 'complete';
  endReason: RoundEndReason | null;
  board: number;
  boards: number;
  /** `projectMinigame` output for the current board; `revision` is what moves must carry. */
  minigame: { definition: string; status: string; revision: number; view: JsonValue };
  /** The current board as a typed view (minigames.ts); render from this. */
  current: BoardView;
  coins: number;
}

export type RoundView = ProblemRoundView | MinigameRoundView;

// ------------------------------------------------------------------------------ friends, shell, monsters

export interface FriendView {
  id: string;
  nameKey: string;
  mnemonicKey: string;
  region: string;
  stage: FriendStage;
  expression: FriendExpression;
  /** Share of the mastery set at each level or better, in percent. */
  mastery: { seen: number; bronze: number; silver: number; gold: number; items: number };
  hungry: boolean;
  dueItems: number;
  outfit: Record<WearableSlot, string | null>;
  /** The next stage and its requirement, or `null` when crowned. */
  next: {
    stage: FriendStage;
    share: number;
    mastery: 'seen' | 'bronze' | 'silver' | 'gold';
    have: number;
    need: number;
    monster: string | null;
  } | null;
}

/** One skill's pearls in the Great Shell (Velká lastura). */
export interface ShellSkill {
  skill: string;
  titleKey: string;
  items: number;
  counts: Record<MasteryLevel, number>;
  /** Known items due again: pearls that "need polishing". */
  dull: number;
}

/** The Great Shell: mastery as pearls, by strand and skill (Dragon Valley's Magic Window reborn). */
export interface ShellView {
  strands: { strand: Strand; skills: ShellSkill[] }[];
  counts: Record<MasteryLevel, number>;
  /** The last pearls polished (newest first, at most 12), for the shell's sparkle. */
  recent: { item: string; level: MasteryLevel }[];
}

/** Freed monsters in the friends' gallery. */
export interface GalleryView {
  monsters: { id: string; nameKey: string; freed: boolean; day: string | null }[];
}

export interface GrottoView {
  spots: (string | null)[];
}

// ------------------------------------------------------------------------------ economy

export interface MarketItem {
  id: string;
  slot: CosmeticSlot;
  assetId: string;
  nameKey: string;
  price: number;
  owned: boolean;
  affordable: boolean;
  available: boolean;
}

export interface MarketView {
  items: MarketItem[];
}

export interface AlbumView {
  pages: {
    region: string;
    stickers: {
      id: string;
      nameKey: string;
      icon: string;
      color: string;
      frame: string;
      earned: boolean;
      day: string | null;
    }[];
  }[];
  earned: number;
  total: number;
}

export interface QuestView {
  id: string;
  template: string;
  titleKey: string;
  goal: QuestGoal;
  target: number;
  progress: number;
  done: boolean;
  claimed: boolean;
  coins: number;
}

export interface DailyView {
  day: string;
  goal: number;
  correct: number;
  answers: number;
  reached: boolean;
  quests: QuestView[];
  chest: 'locked' | 'ready' | 'opened';
  /** Monday..Sunday of the current week: practised that day. A habit view, not a streak. */
  week: boolean[];
  /** After the goal: the friends are sleepy (play may continue). */
  sleepy: boolean;
  /** Words learned today, for the diary card ("Dnešní nové perly: mlýn, slyšet!"). */
  learned: { word: string; text: string }[];
}

// ------------------------------------------------------------------------------ grown-ups' area

export interface GrownUpsView {
  /** Per objective: accuracy and mastery over the items of the levels that teach it. */
  objectives: {
    objective: string;
    titleKey: string;
    grade: Grade;
    accuracy: number;
    mastered: number;
    items: number;
  }[];
  skills: { skill: string; titleKey: string; accuracy: number; mastered: number; items: number }[];
  /** The hardest items (lowest accuracy, then lowest box), at most 10, with their word. */
  hardest: { item: string; word: string | null; text: string; accuracy: number; box: number }[];
  /** The last 60 practised days, oldest first. */
  trend: { day: string; answers: number; correct: number; fast: number }[];
  daysPracticed: number;
  answers: number;
}
