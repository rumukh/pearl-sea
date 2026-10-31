/**
 * A child's stored data as a whole (src/app/persistence/profile-data.ts): backups carry the game
 * and preferences exactly as stored and validated, loading one into another child rebinds and
 * re-validates it, and erasing touches exactly the records it names. Proven on the counting game
 * (fixtures.ts), so it holds for any game definition.
 */
import { MemorySaveStorage } from '@aegis/browser/save';
import { describe, expect, it } from 'vitest';
import { createCommandController } from '../../../src/app/controller/commands';
import { BackupError, readBackup } from '../../../src/app/persistence/backup';
import { dayRecord, DayStore } from '../../../src/app/persistence/day';
import type { Diver } from '../../../src/app/persistence/family';
import { gamePolicy, openGameSession } from '../../../src/app/persistence/game-session';
import {
  eraseDiverData,
  eraseProgress,
  exportDiver,
  gameRecords,
  importDiver,
} from '../../../src/app/persistence/profile-data';
import type { ProfileData } from '../../../src/app/persistence/profile-data';
import { preferencesRecord } from '../../../src/app/persistence/preferences';
import { recordPolicy } from '../../../src/app/persistence/records';
import { PreferencesStore } from '../../../src/app/persistence/stores';
import { COUNT_GAME, PROFILE_A } from './fixtures';

const EMA: Diver = { id: 'profile-1', name: 'Ema', avatar: 'diver-2', address: 'girl' };
const TOM: Diver = { id: 'profile-2', name: 'Tom', avatar: 'diver-3', address: 'boy' };

function data(storage: MemorySaveStorage, closed: string[] = []): ProfileData {
  return {
    storage,
    games: gameRecords(COUNT_GAME),
    closeIfOpen: async (id) => {
      closed.push(id);
    },
  };
}

async function play(storage: MemorySaveStorage, ticks: number): Promise<void> {
  const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
  const commands = createCommandController(session.host, (error) => {
    throw error;
  });
  for (let index = 0; index < ticks; index++) {
    await commands.capture()({ type: 'tick', turns: 1 });
  }
  commands.dispose();
  await session.close();
}

/** A child's preferences, opened as the shell opens them before any change. */
async function preferences(storage: MemorySaveStorage, id: string): Promise<PreferencesStore> {
  const store = new PreferencesStore(storage, id);
  await store.open();
  return store;
}

/** A child's day record, opened as the shell opens it. */
async function day(storage: MemorySaveStorage, id: string): Promise<DayStore> {
  const store = new DayStore(storage, id);
  await store.open();
  return store;
}

async function countOf(storage: MemorySaveStorage, id: string): Promise<number> {
  const session = await openGameSession(storage, COUNT_GAME, {
    id,
    seed: `pearl-sea:${id}`,
  });
  const count = session.view().count;
  await session.close();
  return count;
}

describe('backups of one child', () => {
  it('carry the stored game and preferences and load into another child', async () => {
    const storage = new MemorySaveStorage();
    await play(storage, 2);
    await (
      await preferences(storage, EMA.id)
    ).change((draft) => {
      draft.readAloud = false;
    });
    const text = await exportDiver(data(storage), EMA);
    const backup = readBackup(text);
    expect(backup.diver).toEqual({ name: 'Ema', avatar: 'diver-2', address: 'girl' });
    expect(backup.game).toMatchObject({ profileId: 'profile-1', gameId: 'count-game' });

    const closed: string[] = [];
    await (await day(storage, TOM.id)).begin('2026-10-31', () => ({ lit: [], stages: {} }));
    await importDiver(data(storage, closed), TOM, backup);
    expect(closed, 'the child’s open game is closed first').toEqual(['profile-2']);
    expect(await countOf(storage, TOM.id)).toBe(2);
    expect((await new PreferencesStore(storage, TOM.id).open()).readAloud).toBe(false);
    expect(
      (await storage.read(recordPolicy(dayRecord(TOM.id)))).current,
      'the day baseline of the replaced game is gone',
    ).toBeUndefined();
    expect(await countOf(storage, EMA.id), 'the source child is untouched').toBe(2);
  });

  it('replace a save that cannot be opened through its recovery, validated the same way', async () => {
    const storage = new MemorySaveStorage();
    await play(storage, 1);
    const backup = readBackup(await exportDiver(data(storage), EMA));
    const policy = gamePolicy(COUNT_GAME, TOM.id);
    await storage.compareAndSwap(policy, 0, { revision: 1, payload: '{"broken": true' });
    await importDiver(data(storage), TOM, backup);
    expect(await countOf(storage, TOM.id)).toBe(1);
  });

  it('back up preferences only while the shell has no game definition', async () => {
    const storage = new MemorySaveStorage();
    await play(storage, 1);
    await (
      await preferences(storage, EMA.id)
    ).change((draft) => {
      draft.autoRead = true;
    });
    const withoutGames: ProfileData = { storage, games: null, closeIfOpen: async () => undefined };
    const backup = readBackup(await exportDiver(withoutGames, EMA));
    expect(backup.game).toBeNull();
    expect(backup.preferences).toMatchObject({ profileId: 'profile-1' });
    await importDiver(withoutGames, TOM, backup);
    expect((await new PreferencesStore(storage, TOM.id).open()).autoRead).toBe(true);

    const withGame = readBackup(await exportDiver(data(storage), EMA));
    const refused = await importDiver(withoutGames, TOM, withGame).catch((error) => error);
    expect(refused).toBeInstanceOf(BackupError);
    expect((refused as BackupError).code).toBe('unsupported');
  });
});

describe('erasing', () => {
  it('erases a child’s progress and day but keeps their settings', async () => {
    const storage = new MemorySaveStorage();
    await play(storage, 3);
    await (
      await preferences(storage, EMA.id)
    ).change((draft) => {
      draft.readAloud = false;
    });
    await (await day(storage, EMA.id)).begin('2026-10-31', () => ({ lit: [], stages: {} }));
    await eraseProgress(data(storage), EMA.id);
    expect(await countOf(storage, EMA.id)).toBe(0);
    expect((await new PreferencesStore(storage, EMA.id).open()).readAloud).toBe(false);
    expect((await storage.read(recordPolicy(dayRecord(EMA.id)))).current).toBeUndefined();
  });

  it('erases everything of a child who is removed, and nothing of anyone else', async () => {
    const storage = new MemorySaveStorage();
    await play(storage, 1);
    await (
      await preferences(storage, EMA.id)
    ).change((draft) => {
      draft.readAloud = false;
    });
    await (
      await preferences(storage, TOM.id)
    ).change((draft) => {
      draft.autoRead = true;
    });
    await eraseDiverData(data(storage), EMA.id);
    expect((await storage.read(gamePolicy(COUNT_GAME, EMA.id))).current).toBeUndefined();
    expect((await storage.read(recordPolicy(preferencesRecord(EMA.id)))).current).toBeUndefined();
    expect((await new PreferencesStore(storage, TOM.id).open()).autoRead).toBe(true);
  });
});
