/**
 * Test fixtures: a tiny counting game with a multi-turn command and two content revisions, and
 * storage whose writes can be made to fail or wait. Only public SDK exports are used, so the
 * game-session layer is proven without the domain rules.
 */
import { MemorySaveStorage } from '@aegis/browser/save';
import type { SaveKey, StoredSave } from '@aegis/browser/save';
import { schema, success } from '@aegis/runtime';
import type { ContentPack, RuntimeAdapter, Schema } from '@aegis/runtime';
import type { GameDefinition } from '../../../src/app/persistence/game-session';
import { profileSeed } from '../../../src/rules/contract';

export interface CountState {
  count: number;
  ticks: number;
}
export type CountAction = { type: 'tick'; turns: number } | { type: 'note' };
export interface CountContent {
  step: number;
}
export interface CountView {
  count: number;
  ticks: number;
  content: string;
}

const int = (min: number, max: number): Schema<number> =>
  schema.number({ integer: true, min, max });

export const countAdapter: RuntimeAdapter<CountState, CountAction, CountView, CountContent> = {
  id: 'count',
  stateVersion: 1,
  state: schema.object({ count: int(0, 1_000_000), ticks: int(0, 1_000_000) }),
  action: schema.union(
    schema.object({ type: schema.literal('tick'), turns: int(1, 3) }),
    schema.object({ type: schema.literal('note') }),
  ),
  content: { schemaVersion: 1, schema: schema.object({ step: int(1, 100) }) },
  eventPhases: ['play'],
  initialize: () => ({ count: 0, ticks: 0 }),
  resolve(action) {
    return action.type === 'tick'
      ? success({ rule: 'tick', payload: null, turns: action.turns })
      : success({ rule: 'note', payload: null, turns: 0 });
  },
  commands: [
    {
      id: 'tick',
      payload: schema.literal(null),
      progress: schema.literal(null),
      start(context) {
        context.state.ticks += 1;
      },
      turn(context) {
        context.state.count += context.content.data.step;
        context.emit('counted', { count: context.state.count });
      },
    },
    {
      id: 'note',
      payload: schema.literal(null),
      progress: schema.literal(null),
      start(context) {
        context.emit('noted', null);
      },
    },
  ],
  view: (read) => ({
    count: read.state.count,
    ticks: read.state.ticks,
    content: read.content.revision,
  }),
  canActivateContent: () => true,
  activateContent(context) {
    context.emit('content.activated', null);
  },
};

export const COUNT_V1: ContentPack<CountContent> = {
  id: 'count',
  revision: 'v1',
  schemaVersion: 1,
  data: { step: 1 },
};
export const COUNT_V2: ContentPack<CountContent> = {
  id: 'count',
  revision: 'v2',
  schemaVersion: 1,
  data: { step: 10 },
};

export const COUNT_GAME: GameDefinition<CountState, CountAction, CountView, CountContent> = {
  gameId: 'count-game',
  adapter: countAdapter,
  content: COUNT_V1,
};

export const COUNT_GAME_V2: GameDefinition<CountState, CountAction, CountView, CountContent> = {
  gameId: 'count-game',
  adapter: countAdapter,
  content: COUNT_V2,
  history: [COUNT_V1],
};

/** Memory storage whose next `failures` writes reject, as a full disk would. */
export class FlakyStorage extends MemorySaveStorage {
  failures = 0;
  writes = 0;
  override async compareAndSwap(key: SaveKey, expected: number, next: StoredSave): Promise<void> {
    if (this.failures > 0) {
      this.failures--;
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    this.writes++;
    return super.compareAndSwap(key, expected, next);
  }
}

/** Storage whose writes wait until the test lets them through (a slow disk). */
export class SlowStorage extends MemorySaveStorage {
  held = false;
  private waiting: (() => void)[] = [];
  override async compareAndSwap(key: SaveKey, expected: number, next: StoredSave): Promise<void> {
    if (this.held) await new Promise<void>((resolve) => this.waiting.push(resolve));
    return super.compareAndSwap(key, expected, next);
  }
  /** Lets every waiting write finish. */
  release(): void {
    this.held = false;
    for (const resolve of this.waiting.splice(0)) resolve();
  }
  /** How many writes are waiting for `release`. */
  get waitingWrites(): number {
    return this.waiting.length;
  }
}

export const PROFILE_A = { id: 'profile-1', seed: profileSeed('profile-1') } as const;
export const PROFILE_B = { id: 'profile-2', seed: profileSeed('profile-2') } as const;
