/**
 * Crediting an item: one retrieval, from a graded answer step or a minigame move. Moves the
 * Leitner box and reports promotions and newly polished pearls (a higher mastery level) as events.
 */
import { EVENTS } from '../contract';
import type { ResponseBucket } from '../contract';
import { MASTERY_RANK, masteryLevel, updateItem } from './items';
import type { Ctx } from '../types';

/** Record one response to `item` on the current day. */
export function creditItem(ctx: Ctx, item: string, bucket: ResponseBucket): void {
  const balance = ctx.content.data.balance;
  const day = ctx.state.day ?? 0;
  const before = ctx.state.items[item];
  const after = updateItem(before, bucket, day, balance);
  ctx.state.items[item] = after;
  if (bucket !== 'miss' && after.box > (before?.box ?? 0)) {
    ctx.emit(EVENTS.itemPromoted, { item, box: after.box });
  }
  const from = MASTERY_RANK.indexOf(masteryLevel(before, balance));
  const to = MASTERY_RANK.indexOf(masteryLevel(after, balance));
  if (to > from) ctx.emit(EVENTS.pearlPolished, { item, level: MASTERY_RANK[to]! });
}
