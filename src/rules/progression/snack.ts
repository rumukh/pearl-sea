/**
 * Svačinka (design §5.15): feed hungry friends, one or all of them. A friend is hungry when at
 * least `balance.hungry.minDue` of its items Svačinka can serve are due. Feeding every friend
 * (`friend: null`) also empties Osmička's basket: due items no hatched friend eats
 * (`basketItems`). The snack serves due items first (`pickReview`: starving items, then the most
 * overdue or, while recent success is low, the likeliest successes), with a first taste
 * (`firstTastes`: a taught item never answered) at every other problem, up to
 * `TASTES_PER_SNACK`, then the friends' weakest known items. It has 6 to 10 problems with auto
 * input; 4 to 6 while recent success is low. A snack of the basket alone (no friend is hungry) is
 * never longer than the basket and its first tastes.
 */
import { clamp, lowSuccess } from '../learning/selection';
import { basketItems, dueItems, firstTastes, hungryFriends, snackItems } from './friends';
import { TASTES_PER_SNACK, playableSkills, poolOf, startProblemRound } from './problems';
import type { Ctx, Data, Index, ReadState } from '../types';

export const SNACK_MIN = 6;
export const SNACK_MAX = 10;
/** Snack size while recent success is below `LOW_SUCCESS`. */
export const SNACK_MIN_LOW = 4;
export const SNACK_MAX_LOW = 6;
/** The round state keeps at most this many skills. */
const MAX_ROUND_SKILLS = 64;

/** Problems in a snack: one per due item or first taste, within the snack's size. */
export function snackTarget(due: number, low = false): number {
  return low ? clamp(due, SNACK_MIN_LOW, SNACK_MAX_LOW) : clamp(due, SNACK_MIN, SNACK_MAX);
}

/** The friends a snack feeds: the named hungry friend, or every hungry friend. */
function fed(state: ReadState, data: Data, friend: string | null): string[] {
  const hungry = hungryFriends(state, data);
  return friend === null ? hungry : hungry.filter((id) => id === friend);
}

/**
 * The problem skills of the fed friends, at most `MAX_ROUND_SKILLS` (the round keeps a bounded
 * list): those with the most due items first.
 */
function snackSkills(state: ReadState, data: Data, friends: readonly string[]): string[] {
  const skills = data.friends.filter((f) => friends.includes(f.id)).flatMap((f) => [...f.skills]);
  const playable = playableSkills(data, [...new Set(skills)]);
  if (playable.length <= MAX_ROUND_SKILLS) return playable;
  const due = (skill: string) => dueItems(state, poolOf(data, [skill]));
  return playable
    .map((skill, order) => ({ skill, order, due: due(skill) }))
    .sort((a, b) => b.due - a.due || a.order - b.order)
    .slice(0, MAX_ROUND_SKILLS)
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.skill);
}

/** Why Svačinka cannot start, or `null`. */
export function snackProblem(
  state: ReadState,
  data: Data,
  index: Index,
  friend: string | null,
): { code: string; message: string } | null {
  if (friend !== null && state.friends[friend] === undefined) {
    return { code: 'unknown-friend', message: 'No such friend.' };
  }
  const friends = fed(state, data, friend);
  const basket = friend === null ? basketItems(state, data, index).length : 0;
  if (basket === 0 && (friends.length === 0 || snackSkills(state, data, friends).length === 0)) {
    return { code: 'not-hungry', message: 'No friend is hungry right now.' };
  }
  return null;
}

export function startSnack(ctx: Ctx, index: Index, friend: string | null): void {
  const data = ctx.content.data;
  const friends = fed(ctx.state, data, friend);
  const skills = snackSkills(ctx.state, data, friends);
  const basket = friend === null ? basketItems(ctx.state, data, index) : [];
  const due =
    data.friends
      .filter((f) => friends.includes(f.id))
      .reduce((sum, f) => sum + dueItems(ctx.state, snackItems(f, data)), 0) + basket.length;
  // Room for the first tastes as well, so that they do not crowd out the due items.
  const tastes = Math.min(TASTES_PER_SNACK, firstTastes(ctx.state, data, index, friend).length);
  const target = snackTarget(due + tastes, lowSuccess(ctx.state, data));
  startProblemRound(ctx, index, {
    activity: 'snack',
    source: { kind: 'snack', friend },
    skills,
    input: 'auto',
    // The friends' items can always be served again; the basket and the tastes run out.
    target: skills.length > 0 ? target : Math.max(1, Math.min(target, basket.length + tastes)),
    battle: null,
  });
}
