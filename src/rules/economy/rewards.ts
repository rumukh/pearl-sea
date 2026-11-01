/**
 * Coins, eggs, cosmetics, stickers and the treasure chest.
 *
 * Cosmetic ownership uses `@aegis/narrative` idempotent grants: every grant has a stable claim
 * identity (`buy:<item>`, `level:<level>:<item>`, `chest:<day>`, `story:<reward>`), so replaying a
 * grant never duplicates an item or its coins. Outfits are per friend in `FriendState.outfit`.
 */
import { grantCosmetic } from '@aegis/narrative';
import type { CosmeticItem } from '@aegis/narrative';
import type { DeepReadonly } from '@aegis/runtime';
import { EVENTS, FRIEND_STAGES, weekday } from '../contract';
import type { CoinReason, Grant, StickerCriteria } from '../contract';
import { itemIndex } from '../learning/index-cache';
import { atLeast } from '../learning/items';
import { isComplete } from '../progression/levels';
import type { Ctx, Data, ReadState } from '../types';

export function earnCoins(ctx: Ctx, amount: number, reason: CoinReason): void {
  if (amount <= 0) return;
  ctx.state.coins += amount;
  ctx.state.coinsEarned += amount;
  ctx.emit(EVENTS.coinsEarned, { amount, reason });
}

/** Give a friend's egg once (an owned friend is never given again). */
export function grantEgg(ctx: Ctx, friend: string): void {
  if (ctx.state.friends[friend]) return;
  if (!ctx.content.data.friends.some((f) => f.id === friend)) return;
  const day = ctx.state.day ?? 0;
  ctx.state.friends[friend] = {
    stage: 'egg',
    obtainedDay: day,
    stageDay: day,
    outfit: { head: null, eyes: null, neck: null },
  };
  ctx.emit(EVENTS.eggReceived, { friend });
}

export function cosmeticCatalog(data: Data): CosmeticItem[] {
  return data.cosmetics.map((c) => ({ id: c.id, slot: c.slot, assetId: c.assetId }));
}

/** Grant a cosmetic once per claim identity. Returns false if the claim was already used. */
export function grantItem(ctx: Ctx, item: string, claim: string): boolean {
  if (ctx.state.cosmetics.claims.some((c) => c.id === claim)) return false;
  ctx.state.cosmetics = grantCosmetic(
    cosmeticCatalog(ctx.content.data),
    ctx.state.cosmetics,
    claim,
    item,
  );
  return true;
}

export function applyGrant(
  ctx: Ctx,
  grant: DeepReadonly<Grant>,
  claim: string,
  reason: CoinReason,
): void {
  if (grant.kind === 'egg') grantEgg(ctx, grant.friend);
  else if (grant.kind === 'coins') earnCoins(ctx, grant.amount, reason);
  else grantItem(ctx, grant.item, claim);
}

function stageAtLeast(stage: string, wanted: string): boolean {
  return (
    FRIEND_STAGES.indexOf(stage as (typeof FRIEND_STAGES)[number]) >=
    FRIEND_STAGES.indexOf(wanted as (typeof FRIEND_STAGES)[number])
  );
}

export function criterionMet(
  state: ReadState,
  data: Data,
  criteria: DeepReadonly<StickerCriteria>,
  skillItems: (skill: string) => readonly string[],
): boolean {
  switch (criteria.kind) {
    case 'level-complete':
      return (
        isComplete(state, criteria.level) &&
        (state.levels[criteria.level]?.stars ?? 0) >= criteria.stars
      );
    case 'monster-freed':
      return state.monsters[criteria.monster] !== undefined;
    case 'friend-stage':
      return Object.entries(state.friends).some(
        ([id, friend]) =>
          (criteria.friend === null || criteria.friend === id) &&
          stageAtLeast(friend.stage, criteria.stage),
      );
    case 'friends-stage': {
      const reached = data.friends.filter((f) => {
        const owned = state.friends[f.id];
        return owned !== undefined && stageAtLeast(owned.stage, criteria.stage);
      }).length;
      return reached >= (criteria.count ?? Math.max(1, data.friends.length));
    }
    case 'items-mastered':
      return (
        Object.values(state.items).filter((item) => atLeast(item, criteria.level, data.balance))
          .length >= criteria.count
      );
    case 'skill-mastered': {
      const items = skillItems(criteria.skill);
      if (items.length === 0) return false;
      const good = items.filter((item) =>
        atLeast(state.items[item], criteria.level, data.balance),
      ).length;
      return good * 100 >= criteria.share * items.length;
    }
    case 'streak':
      return state.bestStreak >= criteria.count;
    case 'days-practiced':
      return state.daysPracticed >= criteria.count;
    case 'week-days': {
      const today = state.day ?? 0;
      const monday = today - weekday(today);
      return (
        state.history.filter((d) => d.day >= monday && d.day <= today).length >= criteria.count
      );
    }
    case 'coins-earned':
      return state.coinsEarned >= criteria.count;
    case 'cosmetics-owned':
      return state.cosmetics.owned.length >= criteria.count;
    case 'friends-dressed':
      return (
        Object.values(state.friends).filter((friend) =>
          Object.values(friend.outfit).some((item) => item !== null),
        ).length >= criteria.count
      );
    case 'race-best':
      return state.race.best >= criteria.count;
    case 'quests-claimed':
      return state.questsClaimed >= criteria.count;
    case 'inkoustici-splashed':
      return state.splashed >= criteria.count;
    case 'placement-done':
      return state.onboarding.placement === 'done';
    case 'finale':
      return state.finale.day !== null;
  }
}

/** Award every sticker whose criteria are now met. */
export function awardStickers(ctx: Ctx): void {
  const day = ctx.state.day ?? 0;
  const data = ctx.content.data;
  const skillItems = (skill: string) => itemIndex(data).get(skill) ?? [];
  for (const sticker of data.stickers) {
    if (ctx.state.stickers[sticker.id]) continue;
    if (criterionMet(ctx.state, data, sticker.criteria, skillItems)) {
      ctx.state.stickers[sticker.id] = { day };
      ctx.emit(EVENTS.stickerEarned, { sticker: sticker.id });
    }
  }
}

/** Cosmetics U Mrože shows: unlocked by progress. */
export function availableCosmetics(state: ReadState, data: Data): string[] {
  return data.cosmetics
    .filter((c) => c.unlock === null || isComplete(state, c.unlock))
    .map((c) => c.id);
}

/**
 * Open the treasure chest: a weighted draw from the `rewards` stream between an available
 * cosmetic the child does not own yet and coins. Always rewards something.
 */
export function openChest(ctx: Ctx): void {
  const data = ctx.content.data;
  const random = ctx.random('rewards');
  const unowned = availableCosmetics(ctx.state, data).filter(
    (id) => !ctx.state.cosmetics.owned.includes(id),
  );
  const { cosmeticWeight, coinsWeight, coinsMin, coinsMax } = data.balance.chest;
  const total = (unowned.length > 0 ? cosmeticWeight : 0) + coinsWeight;
  const roll = total > 0 ? random.int(0, total) : 0;
  const day = ctx.state.day ?? 0;
  let grant: Grant;
  if (unowned.length > 0 && roll < cosmeticWeight) {
    const item = random.pick(unowned);
    grantItem(ctx, item, `chest:${day}`);
    grant = { kind: 'cosmetic', item };
  } else {
    grant = { kind: 'coins', amount: Math.max(1, random.int(coinsMin, coinsMax + 1)) };
    earnCoins(ctx, grant.amount, 'chest');
  }
  if (ctx.state.daily) ctx.state.daily.chest = 'opened';
  ctx.emit(EVENTS.chestOpened, { grant });
}
