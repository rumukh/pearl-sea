/**
 * Growth variants: other rules for a sea friend's baby, grown and crowned stages, evaluated during a
 * simulation alongside the shipped `balance.growth` (check (a): the time to `grown`, design §6.5).
 * Growth past hatching never feeds back into play (the rules read a friend's stage only for its egg,
 * hunger after hatching, the view and stickers; no quest or beat waits on `grown`), so the stage
 * days a variant records are exactly the ones it would give on the same run, and one run compares
 * several candidates.
 *
 * A variant is data, gates like `balance.growth` (`{ stage, share, mastery, monster }`): a share of
 * the friend's set at a mastery level (`seen`: answered right once), and whether its monster must be
 * freed. Mastery is the rules' own (`atLeast`), so the content's effort path counts in every variant.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { FRIEND_STAGES } from '../../src/rules/contract';
import type { ContentData, FriendStage, ItemState } from '../../src/rules/contract';
import { atLeast } from '../../src/rules/learning/items';
import { friendSet } from '../../src/rules/progression/friends';
import { percentOf } from '../../src/rules/progression/levels';

export interface GrowthGate {
  stage: Exclude<FriendStage, 'egg'>;
  /** Share (percent) of the friend's set at `mastery` or better. */
  share: number;
  mastery: 'seen' | 'bronze' | 'silver' | 'gold';
  /** Whether the friend's monster must be freed. */
  monster: boolean;
}

export interface GrowthVariant {
  id: string;
  /** The gates in stage order, like `balance.growth`. */
  gates: GrowthGate[];
  /**
   * The effort path's numbers to judge mastery by instead of the pack's (`balance.mastery.effort`):
   * mastery never feeds back into play (scheduling reads only the box).
   */
  effort?: { bronzeDays?: number; silverDays?: number; gapDays?: number };
}

/** The state a variant reads: the items, the monsters freed and the owned friends. */
export interface GrowthState {
  items: Readonly<Record<string, DeepReadonly<ItemState>>>;
  monsters: Readonly<Record<string, unknown>>;
  friends: Readonly<Record<string, { stage: FriendStage }>>;
}

type Data = DeepReadonly<ContentData>;

/** The stage a variant gives a friend: the last gate met with every gate before it. */
export function variantStage(
  variant: GrowthVariant,
  friend: DeepReadonly<ContentData['friends'][number]>,
  state: GrowthState,
  data: Data,
): FriendStage {
  const set = friendSet(data, friend);
  const effort = data.balance.mastery.effort;
  const balance =
    variant.effort === undefined || effort === undefined
      ? data.balance
      : {
          ...data.balance,
          mastery: { ...data.balance.mastery, effort: { ...effort, ...variant.effort } },
        };
  let stage: FriendStage = 'egg';
  for (const gate of variant.gates) {
    const met = set.filter((item) => atLeast(state.items[item], gate.mastery, balance));
    if (set.length > 0 && percentOf(met.length, set.length) < gate.share) break;
    if (gate.monster && friend.monster !== null && state.monsters[friend.monster] === undefined) {
      break;
    }
    stage = gate.stage;
  }
  return stage;
}

/**
 * Follows a run: after each simulated day, records per variant and owned friend the first day
 * index it reached each stage. Stages never go down, as in the game.
 */
export class GrowthProbes {
  /** Variant id → friend id → stage → first day index. */
  readonly days: Record<string, Record<string, Partial<Record<FriendStage, number>>>> = {};
  private readonly reached = new Map<string, number>();

  constructor(
    private readonly data: Data,
    private readonly variants: readonly GrowthVariant[],
  ) {
    for (const variant of variants) this.days[variant.id] = {};
  }

  update(state: GrowthState, dayIndex: number): void {
    for (const variant of this.variants) {
      for (const friend of this.data.friends) {
        if (state.friends[friend.id] === undefined) continue;
        const key = `${variant.id}:${friend.id}`;
        const before = this.reached.get(key) ?? -1;
        if (before === FRIEND_STAGES.length - 1) continue;
        const rank = FRIEND_STAGES.indexOf(variantStage(variant, friend, state, this.data));
        if (rank <= before) continue;
        const record = (this.days[variant.id]![friend.id] ??= {});
        for (let r = Math.max(0, before + 1); r <= rank; r++) record[FRIEND_STAGES[r]!] = dayIndex;
        this.reached.set(key, rank);
      }
    }
  }
}
