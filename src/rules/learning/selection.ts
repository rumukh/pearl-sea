/**
 * Item selection: which item a problem round serves next (the mix, design §6.3).
 *
 * Items are sorted into three tiers on the child's current day:
 * - **due**: items answered right before whose review day has come (spaced review, most overdue
 *   first);
 * - **known**: items at Leitner box 2+ that are not due;
 * - **learning**: new items and items in box 0-1.
 *
 * Each draw first decides, from the `problems` stream, whether to serve a learning item. The
 * learning share starts at `100 - mix.knownShare` and follows recent success (`recentSuccess`:
 * the last `mix.window` answers, across days): above `mix.successTarget` it grows, below it
 * shrinks, within `mix.minLearningShare` … `mix.maxLearningShare`. Otherwise a due review is
 * served, else a known item, else a learning item. Inside a tier, items not served in this round
 * yet come first (known items: also not practised today).
 *
 * **No repeats** (`mix.noRepeatWithin`): an item whose word was served in the last problems is
 * skipped while anything else is available, a word's items counting as one (a sentence's as one,
 * a letter's as one), and a sound-alike partner of the last word is never served next (být right
 * after bít), so the pair is told apart by meaning, not by memory of the last answer.
 *
 * Below the success band (recent success under `LOW_SUCCESS`) the mix protects the child's
 * success: a due item missed last time counts as a learning item (`mixTier`), and due reviews and
 * learning draws serve the likeliest successes first (`likely`). Svačinka does so already below
 * the mix's target (`belowTarget`): most of a child's answers are its reviews once the levels
 * pile up, and the most overdue first would hold success at the band's lower edge.
 *
 * The review guarantee comes before both orders: a known item (box 2+) that has waited
 * `STARVING_DAYS` past its review day is `starving` and is the next review wherever reviews are
 * served (`pickReview`).
 *
 * Learning draws prefer the **focus egg**: the chosen first egg while it is an egg, else the
 * oldest owned egg, whose items the round can serve and that were never answered right. Practice
 * warms the egg, so the first Krmení hatches the chosen egg (design §4.1).
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import type { Friend, ItemState } from '../contract';
import { soundRefWord } from '../contract';
import { isDue } from './items';
import { itemsOf, perPack, sortText } from './index-cache';
import { wordKey } from './item-info';
import type { Data, Index, ReadState } from '../types';

export type ItemTier = 'due' | 'known' | 'learning';

/** Answers before success starts to guide the mix. */
const MIN_SAMPLE = 5;

/** Known items are at Leitner box 2 and up. */
export const KNOWN_BOX = 2;

/**
 * Days past its review day after which a known item is starving and is reviewed before anything
 * else, so no known item waits more than about a week (docs/testing.md §4).
 */
export const STARVING_DAYS = 4;

/**
 * The lower edge of the success band (70-85 %, design §6.3). Below it the game protects the
 * child's success: the mix serves likely successes first, snacks are smaller, reviews and
 * re-asks are asked by choice; and while today's success is below it the daily adventure holds
 * new levels after the day's first.
 */
export const LOW_SUCCESS = 70;

/** Integer division rounded toward zero (no floating-point fractions in rules). */
export function quotient(a: number, b: number): number {
  return (a - (a % b)) / b;
}

export function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/**
 * The child's last `mix.window` answers, across days (the day records in `history`, today's
 * last). A day's answers count at that day's success rate: the records keep no order within a day.
 */
function recentAnswers(state: ReadState, data: Data): { answers: number; correct: number } {
  const window = data.balance.mix.window;
  let answers = 0;
  let correct = 0;
  for (let i = state.history.length - 1; i >= 0 && answers < window; i--) {
    const day = state.history[i]!;
    if (day.answers === 0) continue;
    const take = Math.min(day.answers, window - answers);
    correct += quotient(day.correct * take, day.answers);
    answers += take;
  }
  return { answers, correct };
}

/** Success (percent) over the last `mix.window` answers, or `null` before `MIN_SAMPLE` answers. */
export function recentSuccess(state: ReadState, data: Data): number | null {
  const { answers, correct } = recentAnswers(state, data);
  return answers < MIN_SAMPLE ? null : quotient(correct * 100, answers);
}

/** Today's success (percent), or `null` before `MIN_SAMPLE` answers today. */
export function todaySuccess(state: ReadState): number | null {
  const daily = state.daily;
  if (daily === null || daily.day !== state.day || daily.answers < MIN_SAMPLE) return null;
  return quotient(daily.correct * 100, daily.answers);
}

/** Whether today's success is below `LOW_SUCCESS`: the daily adventure then holds new levels. */
export function lowToday(state: ReadState): boolean {
  const today = todaySuccess(state);
  return today !== null && today < LOW_SUCCESS;
}

/** Whether recent success is below `LOW_SUCCESS`: the game then protects the child's success. */
export function lowSuccess(state: ReadState, data: Data): boolean {
  const success = recentSuccess(state, data);
  return success !== null && success < LOW_SUCCESS;
}

/**
 * Whether recent success is below the mix's target (`mix.successTarget`): Svačinka then serves
 * the likeliest successes first (design §6.3), so a long review backlog does not hold the child at
 * the band's lower edge.
 */
export function belowTarget(state: ReadState, data: Data): boolean {
  const success = recentSuccess(state, data);
  return success !== null && success < data.balance.mix.successTarget;
}

/** Whether the last answer to the item was a miss. */
export function missedLast(record: DeepReadonly<ItemState> | undefined): boolean {
  return record !== undefined && record.recent[record.recent.length - 1] === 'miss';
}

/** Whether the last two answers to the item were misses: it is taught before it is asked. */
export function missedTwice(record: DeepReadonly<ItemState> | undefined): boolean {
  const recent = record?.recent ?? [];
  return (
    recent.length >= 2 &&
    recent[recent.length - 1] === 'miss' &&
    recent[recent.length - 2] === 'miss'
  );
}

/** The tier of an item on `day`. */
export function itemTier(state: ReadState, item: string, day: number): ItemTier {
  const record = state.items[item];
  if (isDue(record, day)) return 'due';
  return record !== undefined && record.box >= KNOWN_BOX ? 'known' : 'learning';
}

/**
 * The item's tier in the mix: its `itemTier`, except that while the child's success is
 * protected (`protect`) a due item missed last time is a learning item rather than a likely
 * success.
 */
export function mixTier(state: ReadState, item: string, day: number, protect: boolean): ItemTier {
  const tier = itemTier(state, item, day);
  return protect && tier === 'due' && missedLast(state.items[item]) ? 'learning' : tier;
}

/** The share (percent) of draws that serve a learning item, from recent success. */
export function learningShare(state: ReadState, data: Data): number {
  const { knownShare, successTarget, minLearningShare, maxLearningShare, window } =
    data.balance.mix;
  const base = 100 - knownShare;
  const { answers, correct } = recentAnswers(state, data);
  if (answers < MIN_SAMPLE) return clamp(base, minLearningShare, maxLearningShare);
  const accuracy = quotient(correct * 100, answers);
  const shift = quotient((accuracy - successTarget) * answers, window);
  return clamp(base + shift, minLearningShare, maxLearningShare);
}

/** Owned friends still in the egg: the chosen first egg first, then the oldest (content order). */
export function eggsByAge(state: ReadState, data: Data): DeepReadonly<Friend>[] {
  const first = state.onboarding.firstFriend;
  return data.friends
    .map((friend, order) => ({ friend, order, owned: state.friends[friend.id] }))
    .filter((entry) => entry.owned !== undefined && entry.owned.stage === 'egg')
    .sort(
      (a, b) =>
        Number(b.friend.id === first) - Number(a.friend.id === first) ||
        a.owned!.obtainedDay - b.owned!.obtainedDay ||
        a.order - b.order,
    )
    .map((entry) => entry.friend);
}

/**
 * The focus egg's items among `pool` that were never answered right (those are what warms an egg:
 * hatching needs items answered right at least once), from the oldest owned egg that still has
 * some; `null` when no egg can be warmed by this round.
 */
export function focusItems(
  state: ReadState,
  data: Data,
  index: Index,
  pool: readonly string[],
): string[] | null {
  const available = new Set(pool);
  for (const egg of eggsByAge(state, data)) {
    const items = itemsOf(egg.skills, index).filter(
      (item) => available.has(item) && (state.items[item]?.correct ?? 0) === 0,
    );
    if (items.length > 0) return items;
  }
  return null;
}

/** The word IDs that are a sound-alike partner of each word (být → bít), from the lexicon. */
const soundPartners: (data: Data) => ReadonlyMap<string, readonly string[]> = perPack((data) => {
  const partners = new Map<string, string[]>();
  for (const [a, b] of data.lexicon.relations.soundAlikes) {
    const [x, y] = [soundRefWord(a), soundRefWord(b)];
    partners.set(x, [...(partners.get(x) ?? []), y]);
    partners.set(y, [...(partners.get(y) ?? []), x]);
  }
  return partners;
});

/**
 * The word keys not to serve next: the words of the last `window` items served (none when
 * `window` is 0) and the sound-alike partners of the last one.
 */
export function blockedKeys(data: Data, recent: readonly string[], window: number): Set<string> {
  const blocked = new Set<string>();
  if (window > 0) for (const item of recent.slice(-window)) blocked.add(wordKey(data, item));
  const last = recent[recent.length - 1];
  if (last !== undefined) {
    const key = wordKey(data, last);
    if (key.startsWith('w:')) {
      for (const partner of soundPartners(data).get(key.slice(2)) ?? []) {
        blocked.add(`w:${partner}`);
      }
    }
  }
  return blocked;
}

/** `pool` without the blocked words, or the whole pool when nothing else is left. */
export function withoutBlocked(
  data: Data,
  pool: readonly string[],
  blocked: ReadonlySet<string>,
): string[] {
  if (blocked.size === 0) return [...pool];
  const free = pool.filter((item) => !blocked.has(wordKey(data, item)));
  return free.length > 0 ? free : [...pool];
}

/** The first non-empty subset of `items` passing a test, in order of preference, else all. */
export function prefer<T>(items: readonly T[], ...tests: ((item: T) => boolean)[]): T[] {
  for (const test of tests) {
    const subset = items.filter(test);
    if (subset.length > 0) return subset;
  }
  return [...items];
}

/** Due items, most overdue first; a random one among the most overdue. */
export function pickDue(
  state: ReadState,
  due: readonly string[],
  random: RandomStream,
): string | null {
  if (due.length === 0) return null;
  let earliest = Number.MAX_SAFE_INTEGER;
  for (const item of due) earliest = Math.min(earliest, state.items[item]!.due);
  return random.pick(due.filter((item) => state.items[item]!.due === earliest));
}

/** The items practised most recently (the latest `lastDay`). */
function mostRecent(state: ReadState, items: readonly string[]): string[] {
  let latest = -1;
  for (const item of items) latest = Math.max(latest, state.items[item]!.lastDay);
  return items.filter((item) => state.items[item]!.lastDay === latest);
}

/**
 * The likeliest successes among `items`: those answered right last time, the most recently
 * practised first; else new items; else the most recently practised (missed last time).
 */
export function likely(state: ReadState, items: readonly string[]): string[] {
  const seen = items.filter((item) => state.items[item] !== undefined);
  const right = seen.filter((item) => !missedLast(state.items[item]));
  if (right.length > 0) return mostRecent(state, right);
  const fresh = items.filter((item) => state.items[item] === undefined);
  return fresh.length > 0 ? fresh : mostRecent(state, seen);
}

/** One of the likeliest successes among `items` (`likely`), or `null` when there are none. */
export function pickLikely(
  state: ReadState,
  items: readonly string[],
  random: RandomStream,
): string | null {
  return items.length === 0 ? null : random.pick(likely(state, items));
}

/** Whether a known item (box `KNOWN_BOX`+) has waited `STARVING_DAYS` or more past its review. */
export function starving(record: DeepReadonly<ItemState> | undefined, day: number): boolean {
  return (
    record !== undefined &&
    record.box >= KNOWN_BOX &&
    isDue(record, day) &&
    day - record.due >= STARVING_DAYS
  );
}

/**
 * The next of the `due` items to review: a starving item first (the most overdue), whatever the
 * child's success; else the most overdue, or with `likelyFirst` (success protected) the likeliest
 * success. `null` when nothing is due.
 */
export function pickReview(
  state: ReadState,
  due: readonly string[],
  random: RandomStream,
  likelyFirst: boolean,
): string | null {
  const day = state.day ?? 0;
  const starved = due.filter((item) => starving(state.items[item], day));
  if (starved.length > 0) return pickDue(state, starved, random);
  return likelyFirst ? pickLikely(state, due, random) : pickDue(state, due, random);
}

/**
 * A learning item: the focus egg's first, items not served in this round before others, then
 * new and weak items in equal measure; with `likelyFirst` (recent success below target), the
 * likeliest successes instead (`likely`).
 */
export function pickLearning(
  state: ReadState,
  learning: readonly string[],
  focus: readonly string[] | null,
  random: RandomStream,
  served: readonly string[] = [],
  likelyFirst = false,
): string | null {
  if (learning.length === 0) return null;
  const focused = focus === null ? [] : learning.filter((item) => focus.includes(item));
  const from = prefer(focused.length > 0 ? focused : learning, (item) => !served.includes(item));
  if (likelyFirst) return random.pick(likely(state, from));
  const fresh = from.filter((item) => state.items[item] === undefined);
  const weak = from.filter((item) => state.items[item] !== undefined);
  if (fresh.length > 0 && weak.length > 0) return random.pick(random.bool() ? fresh : weak);
  return random.pick(fresh.length > 0 ? fresh : weak);
}

/**
 * A known item not served in this round yet, one not practised today if possible; `null` when
 * every known item was already served (the draw then moves on rather than repeat one).
 */
export function pickKnown(
  state: ReadState,
  known: readonly string[],
  random: RandomStream,
  served: readonly string[] = [],
): string | null {
  const day = state.day ?? 0;
  const fresh = known.filter((item) => !served.includes(item));
  if (fresh.length === 0) return null;
  return random.pick(prefer(fresh, (item) => state.items[item]!.lastDay < day));
}

/**
 * The next item of a mixed round from `pool` (the round's servable items), skipping blocked words
 * while others are available and preferring items not `served` in this round yet. `null` when the
 * pool is empty (the round then has nothing left to serve).
 */
export function pickMixed(options: {
  state: ReadState;
  data: Data;
  pool: readonly string[];
  blocked: ReadonlySet<string>;
  served?: readonly string[];
  focus: readonly string[] | null;
  random: RandomStream;
}): string | null {
  const { state, data, random } = options;
  const served = options.served ?? [];
  const day = state.day ?? 0;
  const candidates = withoutBlocked(data, options.pool, options.blocked);
  if (candidates.length === 0) return null;
  const tiers: Record<ItemTier, string[]> = { due: [], known: [], learning: [] };
  const protect = lowSuccess(state, data);
  for (const item of candidates) tiers[mixTier(state, item, day, protect)].push(item);
  const learningFirst = random.int(0, 100) < learningShare(state, data);
  if (learningFirst) {
    const item = pickLearning(state, tiers.learning, options.focus, random, served, protect);
    if (item !== null) return item;
  }
  return (
    pickReview(state, tiers.due, random, protect) ??
    pickKnown(state, tiers.known, random, served) ??
    pickLearning(state, tiers.learning, options.focus, random, served, protect) ??
    random.pick(prefer(candidates, (item) => !served.includes(item)))
  );
}

/**
 * Svačinka: starving items first (the review guarantee), then at every other problem a first
 * taste (`tastes`: items the child was taught but never answered, in order), up to
 * `tastesPerSnack` in a snack; the first of them (the 2nd problem) comes even before starving
 * items, unless the child's success is protected (`likelyFirst`). Then due items (the most
 * overdue, or while protected the likeliest successes), then the weakest known items (lowest box)
 * not served in this snack yet, then anything in the pool. `null` when the pool is empty: a snack
 * of Osmička's basket alone empties it as it goes.
 */
export function pickSnack(options: {
  state: ReadState;
  data: Data;
  pool: readonly string[];
  blocked: ReadonlySet<string>;
  served?: readonly string[];
  random: RandomStream;
  likelyFirst?: boolean;
  tastes?: readonly string[];
  tastesPerSnack?: number;
}): string | null {
  const { state, random } = options;
  const served = options.served ?? [];
  const day = state.day ?? 0;
  const candidates = withoutBlocked(options.data, options.pool, options.blocked);
  if (candidates.length === 0) return null;
  const due = candidates.filter((item) => isDue(state.items[item], day));
  const starved = due.filter((item) => starving(state.items[item], day));
  const slot = served.length % 2 === 1 && served.length < 2 * (options.tastesPerSnack ?? 0);
  const taste = slot
    ? (options.tastes ?? []).find((item) => candidates.includes(item) && !served.includes(item))
    : undefined;
  // A snack's first taste comes even before starving items, unless the child's success is
  // protected: a long review backlog must not hold every new item back for weeks.
  const firstTaste = served.length === 1 && !(options.likelyFirst ?? false);
  if (taste !== undefined && (firstTaste || starved.length === 0)) return taste;
  if (starved.length > 0) return pickDue(state, starved, random)!;
  const picked = pickReview(state, due, random, options.likelyFirst ?? false);
  if (picked !== null) return picked;
  const known = prefer(
    candidates.filter((item) => (state.items[item]?.correct ?? 0) > 0),
    (item) => !served.includes(item),
  );
  if (known.length > 0) {
    let lowest = 6;
    for (const item of known) lowest = Math.min(lowest, state.items[item]!.box);
    return random.pick(known.filter((item) => state.items[item]!.box === lowest));
  }
  return random.pick(prefer(candidates, (item) => !served.includes(item)));
}

/**
 * Placement: an item of the step's skill not asked yet in this round, new items first; with
 * `focus` (every other problem of a step), the chosen egg's items first, so a child who knows
 * them warms the egg already in the check. `null` when the pool is empty.
 */
export function pickPlacement(options: {
  state: ReadState;
  data: Data;
  pool: readonly string[];
  blocked: ReadonlySet<string>;
  served: readonly string[];
  random: RandomStream;
  focus?: readonly string[] | null;
}): string | null {
  const { state, random, focus } = options;
  const candidates = withoutBlocked(options.data, options.pool, options.blocked);
  if (candidates.length === 0) return null;
  const fresh = candidates.filter(
    (item) => state.items[item] === undefined && !options.served.includes(item),
  );
  const from = fresh.length > 0 ? fresh : candidates;
  const focused = focus ? from.filter((item) => focus.includes(item)) : [];
  return random.pick(focused.length > 0 ? focused : from);
}

/**
 * The race: items answered right before, not served in this race yet, else anything. `null` when
 * the pool is empty.
 */
export function pickRace(options: {
  state: ReadState;
  data: Data;
  pool: readonly string[];
  blocked: ReadonlySet<string>;
  served: readonly string[];
  random: RandomStream;
}): string | null {
  const { state, served, random } = options;
  const candidates = withoutBlocked(options.data, options.pool, options.blocked);
  if (candidates.length === 0) return null;
  return random.pick(
    prefer(
      candidates,
      (item) => (state.items[item]?.box ?? 0) >= KNOWN_BOX && !served.includes(item),
      (item) => (state.items[item]?.correct ?? 0) > 0 && !served.includes(item),
      (item) => (state.items[item]?.correct ?? 0) > 0,
    ),
  );
}

/** Sorted unique items. */
export function uniqueSorted(items: Iterable<string>): string[] {
  return [...new Set(items)].sort(sortText);
}
