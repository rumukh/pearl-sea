/**
 * A child's stored data as a whole: backup files, loading a backup into a child, erasing
 * progress, and removing everything when the child is removed. These work on storage directly,
 * for any child, not only the one playing.
 *
 * The game save is reached through `GameRecords`: what the shell needs to back up, restore and
 * erase a child's game without playing it. It is made from the game definition
 * (`gameRecords`); a shell without one (no rules yet) backs up and restores preferences only,
 * and refuses a backup that carries a game it could not check.
 */
import { importSave, migrateSave } from '@aegis/browser/save';
import type { SavePolicy, SaveStorage } from '@aegis/browser/save';
import type { RuntimeSnapshot } from '@aegis/runtime';
import { profileSeed } from '../../rules/contract';
import type { ProfileId } from '../../rules/contract';
import { BackupError, createBackup, rebind } from './backup';
import type { BackupFile } from './backup';
import { dayRecord } from './day';
import type { Diver } from './family';
import { gamePolicy, openGameSession } from './game-session';
import type { GameDefinition } from './game-session';
import { preferencesRecord } from './preferences';
import { recordPolicy } from './records';
import { eraseRecord, RecoveryRequired } from './recovery';
import { PreferencesStore } from './stores';

export interface GameRecords {
  /** The save policy of a child's game record. */
  policy(profileId: ProfileId): SavePolicy<RuntimeSnapshot, null>;
  /** Throws unless `text` is a game envelope this build can read (migrations included). */
  check(text: string, profileId: ProfileId): void;
  /** Validate a game envelope like a fresh load (rules included), then store it durably. */
  install(storage: SaveStorage, profileId: ProfileId, text: string): Promise<void>;
}

export function gameRecords<S, A, V, C>(game: GameDefinition<S, A, V, C>): GameRecords {
  return {
    policy: (profileId) => gamePolicy(game, profileId),
    check(text, profileId) {
      migrateSave(text, gamePolicy(game, profileId), game.migrations ?? []);
    },
    async install(storage, profileId, text) {
      try {
        const session = await openGameSession(storage, game, {
          id: profileId,
          seed: profileSeed(profileId),
        });
        try {
          await session.importEnvelope(text);
        } finally {
          await session.close();
        }
      } catch (error) {
        // A save that cannot be opened is replaced through its recovery, validated the same way.
        if (!(error instanceof RecoveryRequired) || !error.actions.available) throw error;
        await error.actions.replace(text);
      }
    },
  };
}

export interface ProfileData {
  readonly storage: SaveStorage;
  /** The game's records, or null while the shell has no game definition. */
  readonly games: GameRecords | null;
  /** Close the child's open game first, so nothing writes over what is replaced. */
  closeIfOpen(profileId: ProfileId): Promise<void>;
}

function policies(profileId: string) {
  return {
    preferences: recordPolicy(preferencesRecord(profileId)),
    day: recordPolicy(dayRecord(profileId)),
  };
}

/** The acknowledged stored records of a child, as one backup file. */
export async function exportDiver(data: ProfileData, diver: Diver): Promise<string> {
  const { preferences } = policies(diver.id);
  const gameText = data.games
    ? (await data.storage.read(data.games.policy(diver.id))).current?.payload
    : undefined;
  const preferencesText = (await data.storage.read(preferences)).current?.payload;
  // Both payloads are re-validated, so a backup never carries a record we could not load.
  if (gameText !== undefined) data.games?.check(gameText, diver.id);
  if (preferencesText !== undefined) importSave(preferencesText, preferences);
  return createBackup(diver, gameText, preferencesText);
}

/**
 * Replace a child's game and preferences with a backup's. Each envelope is rebound to this child
 * and validated like a fresh load (game rules included) before it is stored.
 */
export async function importDiver(
  data: ProfileData,
  diver: Diver,
  backup: BackupFile,
): Promise<void> {
  if (backup.game !== null && !data.games) throw new BackupError('unsupported');
  await data.closeIfOpen(diver.id);
  const { preferences: policy, day } = policies(diver.id);
  if (backup.game !== null && data.games) {
    // The day's baseline belongs to the game it was taken from.
    await eraseRecord(data.storage, day).catch(() => undefined);
    await data.games.install(data.storage, diver.id, rebind(backup.game, diver.id));
  }
  if (backup.preferences !== null) {
    const text = rebind(backup.preferences, diver.id);
    const candidate = importSave(text, policy);
    const store = new PreferencesStore(data.storage, diver.id);
    try {
      await store.open();
    } catch (error) {
      if (!(error instanceof RecoveryRequired) || !error.actions.available) throw error;
      await error.actions.replace(text);
      return;
    }
    await store.replace(candidate.state);
  }
}

/** Erase a child's game progress (the settings stay). */
export async function eraseProgress(data: ProfileData, profileId: ProfileId): Promise<void> {
  await data.closeIfOpen(profileId);
  if (data.games) await eraseRecord(data.storage, data.games.policy(profileId));
  await eraseRecord(data.storage, policies(profileId).day).catch(() => undefined);
}

/** Erase everything stored for a child: game, preferences and the diary's day. */
export async function eraseDiverData(data: ProfileData, profileId: ProfileId): Promise<void> {
  await data.closeIfOpen(profileId);
  const { preferences, day } = policies(profileId);
  if (data.games) await eraseRecord(data.storage, data.games.policy(profileId));
  await eraseRecord(data.storage, preferences);
  await eraseRecord(data.storage, day).catch(() => undefined);
}
