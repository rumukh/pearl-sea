/**
 * The Perlové moře game as the shell's persistence layer sees it: the rules adapter, the
 * validated content pack and the save namespace. Every child's game session is a runtime host of
 * this definition (`persistence/game-session.ts`). The adapter is S2's `pearlSeaAdapter`, reached
 * through `game/rules.ts`, the one place that names it.
 */
import type { SaveMigration } from '@aegis/browser/save';
import type { ContentPack, RuntimeAdapter, RuntimeSnapshot } from '@aegis/runtime';
import { GAME_ID, migrateSnapshot, STATE_VERSION } from '../../rules/contract';
import type { ContentData, GameAction, GameView, ProfileState } from '../../rules/contract';
import type { GameDefinition, GameSession } from '../persistence/game-session';

export type PearlSeaAdapter = RuntimeAdapter<ProfileState, GameAction, GameView, ContentData>;
export type PearlSeaGame = GameDefinition<ProfileState, GameAction, GameView, ContentData>;
export type PearlSeaSession = GameSession<ProfileState, GameAction, GameView, ContentData>;
export type PearlSeaPack = ContentPack<ContentData>;

/** Save upgrades, one per older state version (`migrateSnapshot`, docs/contract.md §7.6). */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = Array.from(
  { length: STATE_VERSION - 1 },
  (_, index) => ({
    from: index + 1,
    to: index + 2,
    migrate: (state: unknown) => migrateSnapshot(state as RuntimeSnapshot, index + 2),
  }),
);

/**
 * The game for the newest pack: `history` holds older shipped packs at hand, and `loadHistory`
 * fetches one a save pins (`content/history.ts`).
 */
export function pearlSeaGame(
  adapter: PearlSeaAdapter,
  content: PearlSeaPack,
  history: readonly PearlSeaPack[] = [],
  loadHistory?: (revision: string) => Promise<PearlSeaPack>,
): PearlSeaGame {
  return {
    gameId: GAME_ID,
    adapter,
    content,
    history,
    migrations: SAVE_MIGRATIONS,
    ...(loadHistory ? { loadHistory } : {}),
  };
}
