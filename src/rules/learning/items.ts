/**
 * Spaced retrieval for one item: response buckets, Leitner moves and mastery levels (pearls).
 *
 * Leitner boxes 0..5 (0 = never seen). Right and fast or ok: up one box. Right but slow: stay.
 * Miss: back to box 1, invisibly. The item is due `balance.leitner.intervals[box]` days later.
 *
 * Two notions are kept apart, as in Dragon Valley. The **box** schedules: due days, the mix's
 * tiers, `known` (box 2+), the review guarantee and the input all read the box, never a level.
 * The **mastery level** is what the child sees (the pearls of the Great Shell) and what friends
 * grow by: the better of the box's level (`boxLevel`: box 0-1 cloudy, 2 bronze, 3-4 silver, gold
 * = box `goldBox` with `goldFast` fast answers among the last `goldOfLast`) and the effort path's
 * (`effortLevel`: bronze or silver after right answers on enough well-spaced days,
 * `balance.mastery.effort`). Gold is fluency alone.
 */
import type { DeepReadonly } from '@aegis/runtime';
import type {
  Balance,
  DayNumber,
  ItemState,
  MasteryLevel,
  ResolvedInputMode,
  ResponseBucket,
} from '../contract';

type ReadBalance = DeepReadonly<Balance>;

/** Letters of a text as the child types them (code points of the NFC text). */
export function letterCount(text: string): number {
  return [...text.normalize('NFC')].length;
}

/**
 * Sort a response into a bucket. Typing gets `typed.perExtraLetterMs` per letter beyond the first
 * of the answer (`letters`), and a problem shown with a sentence its reading time
 * (`allowanceMs`: the sentence's words × `response.perSentenceWordMs`), on both limits.
 */
export function responseBucket(
  correct: boolean,
  elapsedMs: number,
  input: ResolvedInputMode,
  letters: number,
  balance: ReadBalance,
  allowanceMs = 0,
): ResponseBucket {
  if (!correct) return 'miss';
  const limits = balance.response[input];
  const extra =
    (input === 'typed' ? Math.max(0, letters - 1) * balance.response.typed.perExtraLetterMs : 0) +
    allowanceMs;
  if (elapsedMs <= limits.fastMs + extra) return 'fast';
  if (elapsedMs <= limits.okMs + extra) return 'ok';
  return 'slow';
}

/** The worse of two buckets (a miss is worst): one item credited for two steps. */
export function worseBucket(a: ResponseBucket, b: ResponseBucket): ResponseBucket {
  const order: readonly ResponseBucket[] = ['fast', 'ok', 'slow', 'miss'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

/**
 * The item after one response on `day`. With the effort path (`balance.mastery.effort`), a right
 * answer at any speed also counts the day in `rightDays` when it is the item's first counted day
 * or at least `gapDays` after the last counted one (`lastCountedDay`, not the last right day):
 * right on days 0, 1, 2, 5 and 6 with a gap of 2 counts days 0, 2 and 5. Without the path nothing
 * is counted, and a record that has counts keeps them.
 */
export function updateItem(
  item: DeepReadonly<ItemState> | undefined,
  bucket: ResponseBucket,
  day: DayNumber,
  balance: ReadBalance,
): ItemState {
  const box = item?.box ?? 0;
  const nextBox = bucket === 'miss' ? 1 : bucket === 'slow' ? box : Math.min(5, box + 1);
  const next: ItemState = {
    box: nextBox,
    due: day + (balance.leitner.intervals[nextBox] ?? 0),
    seen: (item?.seen ?? 0) + 1,
    correct: (item?.correct ?? 0) + (bucket === 'miss' ? 0 : 1),
    recent: [...(item?.recent ?? []), bucket].slice(-3),
    lastDay: day,
  };
  if (item?.rightDays !== undefined && item.lastCountedDay !== undefined) {
    next.rightDays = item.rightDays;
    next.lastCountedDay = item.lastCountedDay;
  }
  const effort = balance.mastery.effort;
  const last = next.lastCountedDay;
  if (
    effort !== undefined &&
    bucket !== 'miss' &&
    (last === undefined || day - last >= effort.gapDays)
  ) {
    next.rightDays = (next.rightDays ?? 0) + 1;
    next.lastCountedDay = day;
  }
  return next;
}

/** The level the Leitner box alone gives: box 0-1 cloudy, 2 bronze, 3-4 silver, gold when fluent. */
export function boxLevel(
  item: DeepReadonly<ItemState> | undefined,
  balance: ReadBalance,
): MasteryLevel {
  if (!item || item.box <= 1) return 'cloudy';
  if (item.box === 2) return 'bronze';
  const fast = item.recent.slice(-balance.mastery.goldOfLast).filter((b) => b === 'fast').length;
  return item.box >= balance.mastery.goldBox && fast >= balance.mastery.goldFast
    ? 'gold'
    : 'silver';
}

/**
 * The level the effort path gives (`balance.mastery.effort`): silver after right answers on
 * `silverDays` counted days, bronze after `bronzeDays`, else cloudy. Never gold; cloudy without
 * the path.
 */
export function effortLevel(
  item: DeepReadonly<ItemState> | undefined,
  balance: ReadBalance,
): 'cloudy' | 'bronze' | 'silver' {
  const effort = balance.mastery.effort;
  const days = item?.rightDays ?? 0;
  if (effort === undefined) return 'cloudy';
  if (days >= effort.silverDays) return 'silver';
  return days >= effort.bronzeDays ? 'bronze' : 'cloudy';
}

export const MASTERY_RANK: readonly MasteryLevel[] = ['cloudy', 'bronze', 'silver', 'gold'];

/**
 * The mastery level the child sees and friends grow by: the better of `boxLevel` and
 * `effortLevel`. Scheduling never reads it (it reads the box).
 */
export function masteryLevel(
  item: DeepReadonly<ItemState> | undefined,
  balance: ReadBalance,
): MasteryLevel {
  const byBox = boxLevel(item, balance);
  const byEffort = effortLevel(item, balance);
  return MASTERY_RANK.indexOf(byEffort) > MASTERY_RANK.indexOf(byBox) ? byEffort : byBox;
}

const ORDER: readonly ('seen' | MasteryLevel)[] = ['cloudy', 'seen', 'bronze', 'silver', 'gold'];

/** True when the item is at `level` or better (`seen` = answered right at least once). */
export function atLeast(
  item: DeepReadonly<ItemState> | undefined,
  level: 'seen' | 'bronze' | 'silver' | 'gold',
  balance: ReadBalance,
): boolean {
  if (level === 'seen') return (item?.correct ?? 0) > 0;
  return ORDER.indexOf(masteryLevel(item, balance)) >= ORDER.indexOf(level);
}

/**
 * A known item (answered right before) whose review day has come and that was not already
 * practised today: an item seen today is never "due" again the same day, so a friend is not
 * hungry minutes after it hatched and a pearl needs polishing only from a later day on.
 */
export function isDue(item: DeepReadonly<ItemState> | undefined, day: DayNumber): boolean {
  return item !== undefined && item.correct > 0 && item.due <= day && item.lastDay < day;
}

/**
 * The mastery level an item reached today, or `null` when its last answer (on `day`) raised no
 * level. The state keeps no history, so this is read from the record: the box path's step up
 * shows in the box and the last bucket, the effort path's in `lastCountedDay`. It feeds the
 * Great Shell's sparkle and the diary card ("Dnešní nové perly"), never scheduling.
 */
export function polishedToday(
  item: DeepReadonly<ItemState> | undefined,
  day: DayNumber,
  balance: ReadBalance,
): MasteryLevel | null {
  if (item === undefined || item.lastDay !== day || item.correct === 0) return null;
  const level = masteryLevel(item, balance);
  if (level === 'cloudy') return null;
  const last = item.recent[item.recent.length - 1];
  const promoted = last === 'fast' || last === 'ok';
  const byBox = MASTERY_RANK.indexOf(boxLevel(item, balance));
  const byEffort = MASTERY_RANK.indexOf(effortLevel(item, balance));
  // The box path steps up a level by a promotion into box 2 or 3, or to gold by a fast answer.
  const boxStep =
    promoted &&
    ((byBox === 1 && item.box === 2) ||
      (byBox === 2 && item.box === 3) ||
      (byBox === 3 && last === 'fast'));
  const effort = balance.mastery.effort;
  const effortStep =
    effort !== undefined &&
    item.lastCountedDay === day &&
    (item.rightDays === effort.bronzeDays || item.rightDays === effort.silverDays);
  const before = Math.max(byBox - (boxStep ? 1 : 0), byEffort - (effortStep ? 1 : 0));
  return MASTERY_RANK.indexOf(level) > before ? level : null;
}
