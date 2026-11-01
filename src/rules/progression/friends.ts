/**
 * Sea friends: mastery sets, growth and hunger (design §6.5).
 *
 * A friend's mastery set is the union of its skills' items. It grows through the stages of
 * `balance.growth` (baby, grown, crowned) when the share of its set at the rule's mastery level
 * reaches the rule's share and, where the rule says so, its monster is freed. Stages never go
 * down. A hatched friend is hungry when at least `balance.hungry.minDue` of its items that
 * Svačinka can serve are due: feeding hungry friends is the spaced review. Due items no hatched
 * friend eats wait in Osmička's basket (`basketItems`), which Svačinka serves too.
 *
 * Items only boards train (the necklace's `abc:`, Pexeso's `pair:`, the shell's `seg:`) are never
 * served as single problems: they count for growth and show as pearls, and the daily adventure
 * reviews them by replaying a board (view.ts).
 */
import type { DeepReadonly } from '@aegis/runtime';
import { EVENTS, FRIEND_STAGES } from '../contract';
import type { Friend, FriendStage, GrowthRule } from '../contract';
import { servableIndex } from '../learning/generate';
import { itemIndex, itemsOf, perPack, sortText } from '../learning/index-cache';
import { atLeast, isDue } from '../learning/items';
import { starving } from '../learning/selection';
import { isComplete, percentOf } from './levels';
import type { Ctx, Data, Index, ReadState } from '../types';

export { itemsOf };

export function shareAt(
  state: ReadState,
  data: Data,
  items: readonly string[],
  level: GrowthRule['mastery'],
): number {
  if (items.length === 0) return 100;
  const count = items.filter((item) => atLeast(state.items[item], level, data.balance)).length;
  return percentOf(count, items.length);
}

/** Each friend's mastery set and the part of it Svačinka can serve, once per pack. */
const friendSets: (data: Data) => ReadonlyMap<string, { all: string[]; snack: string[] }> = perPack(
  (data) => {
    const index = itemIndex(data);
    const servable = servableItems(data);
    return new Map(
      data.friends.map((friend) => {
        const all = itemsOf(friend.skills, index);
        return [friend.id, { all, snack: all.filter((item) => servable.has(item)) }];
      }),
    );
  },
);

/** A friend's mastery set: the items of its skills. */
export function friendItems(friend: DeepReadonly<Friend>, index: Index): string[] {
  return itemsOf(friend.skills, index);
}

/** A friend's mastery set from the pack's cache (the same as `friendItems`). */
export function friendSet(data: Data, friend: DeepReadonly<Friend>): string[] {
  return friendSets(data).get(friend.id)?.all ?? [];
}

function ruleMet(
  state: ReadState,
  data: Data,
  friend: DeepReadonly<Friend>,
  rule: DeepReadonly<GrowthRule>,
  index: Index,
): boolean {
  if (shareAt(state, data, friendSet(data, friend), rule.mastery) < rule.share) return false;
  return !rule.monster || friend.monster === null || state.monsters[friend.monster] !== undefined;
}

/** The highest stage whose rule and all earlier rules are met. */
export function earnedStage(
  state: ReadState,
  data: Data,
  friend: DeepReadonly<Friend>,
  index: Index,
): FriendStage {
  let stage: FriendStage = 'egg';
  for (const rule of data.balance.growth) {
    if (!ruleMet(state, data, friend, rule, index)) break;
    stage = rule.stage;
  }
  return stage;
}

/** Grow every owned friend whose earned stage is above its current one (never shrink). */
export function applyGrowth(ctx: Ctx, index: Index): void {
  const day = ctx.state.day ?? 0;
  for (const friend of ctx.content.data.friends) {
    const owned = ctx.state.friends[friend.id];
    if (!owned) continue;
    const earned = earnedStage(ctx.state, ctx.content.data, friend, index);
    const from = FRIEND_STAGES.indexOf(owned.stage);
    const to = FRIEND_STAGES.indexOf(earned);
    if (to <= from) continue;
    owned.stage = earned;
    owned.stageDay = day;
    if (from === 0) ctx.emit(EVENTS.friendHatched, { friend: friend.id });
    if (to > 1) ctx.emit(EVENTS.friendGrew, { friend: friend.id, stage: earned });
    if (earned === 'crowned') ctx.emit(EVENTS.friendCrowned, { friend: friend.id });
  }
}

export function dueItems(state: ReadState, items: readonly string[]): number {
  const day = state.day ?? 0;
  return items.filter((item) => isDue(state.items[item], day)).length;
}

/** Items some problem skill of the pack can serve (Svačinka, reviews, re-asks). */
export const servableItems: (data: Data) => ReadonlySet<string> = perPack(
  (data) => new Set([...servableIndex(data).values()].flat()),
);

/** A friend's items Svačinka can serve. */
export function snackItems(friend: DeepReadonly<Friend>, data: Data): string[] {
  return friendSets(data).get(friend.id)?.snack ?? [];
}

/**
 * Osmička's basket (design §5.15): due items that no hatched friend eats and that a problem
 * skill can serve, sorted. Standard Czech, the 3rd grade's sentences until the Klauni hatch, the
 * items of eggs. Svačinka for every friend serves them too, so they are reviewed like the rest.
 */
export function basketItems(state: ReadState, data: Data, index: Index): string[] {
  const day = state.day ?? 0;
  const eaten = new Set<string>();
  for (const friend of data.friends) {
    const owned = state.friends[friend.id];
    if (owned === undefined || owned.stage === 'egg') continue;
    for (const item of friendSet(data, friend)) eaten.add(item);
  }
  const servable = servableItems(data);
  return Object.keys(state.items)
    .filter((item) => !eaten.has(item) && servable.has(item) && isDue(state.items[item], day))
    .sort(sortText);
}

/**
 * Whether a known item Svačinka can serve is starving (`starving`): the review guarantee then
 * puts Svačinka before anything new (design §6.3).
 */
export function anyStarving(state: ReadState, data: Data): boolean {
  const day = state.day ?? 0;
  const servable = servableItems(data);
  return Object.keys(state.items).some(
    (item) => starving(state.items[item], day) && servable.has(item),
  );
}

/**
 * The items the child was taught: those of a finished level's skills (design §5.15). Svačinka
 * serves no item the child has neither met nor been taught.
 */
export function taughtItems(state: ReadState, data: Data, index: Index): Set<string> {
  return new Set(
    data.levels
      .filter((level) => isComplete(state, level.id))
      .flatMap((level) => level.activities.flatMap((activity) => activity.skills))
      .flatMap((skill) => index.get(skill) ?? []),
  );
}

/**
 * First tastes (design §5.15): the items of the child's friends that it was taught
 * (`taughtItems`) but never answered, in the order Svačinka introduces them. A level's round
 * draws new items at random, so some can be missed and would never come up again: Svačinka serves
 * them. Eggs come first, the chosen first egg before the others and then the oldest first (they
 * warm them; a 4th grader's lagoon egg hatches so); then the hatched friends', the oldest first
 * (content order on the same day). With `friend`, only that friend's. Only items a problem skill
 * can serve.
 */
export function firstTastes(
  state: ReadState,
  data: Data,
  index: Index,
  friend: string | null,
  taught: ReadonlySet<string> = taughtItems(state, data, index),
): string[] {
  const servable = servableItems(data);
  const first = state.onboarding.firstFriend;
  const owners = data.friends
    .map((f, order) => ({ f, order, owned: state.friends[f.id] }))
    .filter(({ f, owned }) => owned !== undefined && (friend === null || f.id === friend))
    .sort(
      (a, b) =>
        Number(b.owned!.stage === 'egg') - Number(a.owned!.stage === 'egg') ||
        Number(b.owned!.stage === 'egg' && b.f.id === first) -
          Number(a.owned!.stage === 'egg' && a.f.id === first) ||
        a.owned!.obtainedDay - b.owned!.obtainedDay ||
        a.order - b.order,
    );
  const tastes = owners
    .flatMap(({ f }) => friendSet(data, f))
    .filter((item) => state.items[item] === undefined && taught.has(item) && servable.has(item));
  return [...new Set(tastes)];
}

/** Owned, hatched friends with enough due items that Svačinka can serve. */
export function hungryFriends(state: ReadState, data: Data): string[] {
  return data.friends
    .filter((friend) => {
      const owned = state.friends[friend.id];
      return (
        owned !== undefined &&
        owned.stage !== 'egg' &&
        dueItems(state, snackItems(friend, data)) >= data.balance.hungry.minDue
      );
    })
    .map((friend) => friend.id);
}
