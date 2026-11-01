/**
 * Small, pure readings of the game view for screens: where a level sits, which friend the grotto
 * features and how far it is from growing, what the "Dnešní výprava" button does, where results
 * lead, and how the day began. No rules live here: every decision the game makes is already in
 * the view (contract views.ts); these only choose how to show it.
 */
import type {
  FriendStage,
  FriendView,
  GameAction,
  GameView,
  LevelCard,
  RegionView,
} from '../../rules/contract';
import type { DayBaseline } from '../persistence/day';

export function findRegion(view: GameView, regionId: string): RegionView | undefined {
  return view.hub.regions.find((region) => region.id === regionId);
}

export function findLevel(
  view: GameView,
  levelId: string,
): { readonly region: RegionView; readonly level: LevelCard } | undefined {
  for (const region of view.hub.regions) {
    const level = region.levels.find((candidate) => candidate.id === levelId);
    if (level) return { region, level };
  }
  return undefined;
}

export function findFriend(view: GameView, friendId: string): FriendView | undefined {
  return view.friends.find((friend) => friend.id === friendId);
}

/** The friend the grotto shows big: the first friend while it is there, else the first one. */
export function featuredFriend(view: GameView): FriendView | undefined {
  const first = view.onboarding.firstFriend;
  return view.friends.find((friend) => friend.id === first) ?? view.friends[0];
}

export interface Growth {
  /** The stage the friend grows into next. */
  readonly next: FriendStage;
  /** Items of the friend's set at the needed mastery, and how many the next stage needs. */
  readonly have: number;
  readonly need: number;
  /** The monster that must be freed first, if any. */
  readonly monster: string | null;
}

/** How far a friend is from its next stage, from the rules' exact counts; null when crowned. */
export function growthOf(friend: FriendView): Growth | null {
  const next = friend.next;
  if (!next) return null;
  const need = Math.max(1, next.need);
  return { next: next.stage, have: Math.min(next.have, need), need, monster: next.monster };
}

/** What "Dnešní výprava" does now (docs/design.md §4.2), as the action to send, or a place. */
export type Adventure =
  | { readonly kind: 'action'; readonly action: GameAction }
  | { readonly kind: 'story' }
  | { readonly kind: 'first-friend' }
  | { readonly kind: 'map' };

/**
 * The daily adventure's next step. A level already under way continues at its next activity
 * instead of starting over; a minigame step replays one game of a finished level.
 */
export function adventureFor(view: GameView): Adventure {
  const next = view.hub.next;
  switch (next.kind) {
    case 'story':
      return { kind: 'story' };
    case 'first-friend':
      return { kind: 'first-friend' };
    case 'placement':
      return { kind: 'action', action: { type: 'startActivity', activity: { kind: 'placement' } } };
    case 'snack':
      return {
        kind: 'action',
        action: { type: 'startActivity', activity: { kind: 'snack', friend: next.friend } },
      };
    case 'level': {
      const run = view.run;
      if (run !== null && run.level === next.level && run.result === null) {
        return {
          kind: 'action',
          action: { type: 'startActivity', activity: { kind: 'level', index: run.next } },
        };
      }
      return { kind: 'action', action: { type: 'startLevel', level: next.level } };
    }
    case 'minigame':
      return {
        kind: 'action',
        action: { type: 'startLevel', level: next.level, activity: next.activity },
      };
    case 'chest':
      return { kind: 'action', action: { type: 'openChest' } };
    case 'free-play':
      return { kind: 'map' };
  }
}

export type ResultsNext =
  { readonly kind: 'activity'; readonly index: number } | { readonly kind: 'done' };

/** After a finished round: the level's next activity, or back to the grotto. */
export function resultsNext(view: GameView): ResultsNext {
  const done: ResultsNext = { kind: 'done' };
  const { round, run } = view;
  if (!round || round.status !== 'complete' || round.source.kind !== 'level') return done;
  if (round.endReason === 'quit' || round.endReason === 'time-limit') return done;
  if (!run || run.result !== null || run.next >= run.activities.length) return done;
  return { kind: 'activity', index: run.next };
}

/**
 * The day the game is on once today's session has started (`today` is the local date): the rules
 * never go back a day, so a save from a device whose clock ran ahead keeps its own day.
 */
export function gameDay(view: Pick<GameView, 'day'>, today: string): string {
  return view.day !== null && view.day > today ? view.day : today;
}

/**
 * How the day began, for the diary card: each friend's stage. (Words learned today come from the
 * view itself, `daily.learned`, so no items are noted.)
 */
export function dayBaseline(view: GameView): DayBaseline {
  return {
    lit: [],
    stages: Object.fromEntries(view.friends.map((friend) => [friend.id, friend.stage])),
  };
}
