/**
 * Stored records, written and read the way the shell keeps them: payloads come from the app's own
 * record and checkpoint code over the SDK's memory storage, then go into the page's IndexedDB
 * under the SDK's layout (database `pearl-sea`, store `saves`, one key per game and profile).
 */
import { MemorySaveStorage, saveKey, SaveService } from '@aegis/browser/save';
import type { SaveKey } from '@aegis/browser/save';
import type { RuntimeSnapshot } from '@aegis/runtime';
import type { Page } from '@playwright/test';
import type { PearlSeaGame } from '../../../src/app/game/definition';
import { FAMILY_RECORD } from '../../../src/app/persistence/family';
import type { FamilyState } from '../../../src/app/persistence/family';
import { checkpointMetadata, gamePolicy } from '../../../src/app/persistence/game-session';
import { recordPolicy, RecordStore } from '../../../src/app/persistence/records';
import { SAVE_DATABASE } from '../../../src/rules/contract';

/** Where the family record lives. */
export const FAMILY_KEY: SaveKey = {
  gameId: FAMILY_RECORD.gameId,
  profileId: FAMILY_RECORD.profileId,
};

/** The stored payload the shell itself would write for a family record. */
export async function familyPayload(state: FamilyState): Promise<string> {
  const storage = new MemorySaveStorage();
  const store = new RecordStore(storage, FAMILY_RECORD);
  await store.load();
  await store.save(state);
  return (await storage.read(recordPolicy(FAMILY_RECORD))).current!.payload;
}

/** The stored payload of a child's game at `snapshot`, as the game's checkpoint writes it. */
export async function gamePayload(
  game: PearlSeaGame,
  profileId: string,
  snapshot: RuntimeSnapshot,
): Promise<string> {
  const storage = new MemorySaveStorage();
  const policy = gamePolicy(game, profileId);
  const saves = new SaveService(storage, policy);
  await saves.load();
  await saves.save({ ...checkpointMetadata(game, profileId, snapshot), state: snapshot });
  return (await storage.read(policy)).current!.payload;
}

/** Put a stored payload into this game's database, as the SDK keeps it. */
export async function storeRecord(page: Page, key: SaveKey, payload: string): Promise<void> {
  await page.evaluate(
    async ({ database, key, payload }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('saves');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('saves', 'readwrite');
          transaction.objectStore('saves').put({ current: { revision: 1, payload } }, key);
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    },
    { database: SAVE_DATABASE, key: saveKey(key), payload },
  );
}

/** The payload stored now under `key`, or `null` when there is none. */
export async function readRecord(page: Page, key: SaveKey): Promise<string | null> {
  return page.evaluate(
    async ({ database, key }) =>
      new Promise<string | null>((resolve, reject) => {
        const request = indexedDB.open(database);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('saves')) {
            db.close();
            resolve(null);
            return;
          }
          const read = db.transaction('saves', 'readonly').objectStore('saves').get(key);
          read.onsuccess = () => {
            db.close();
            const value = read.result as { current?: { payload?: string } } | undefined;
            resolve(value?.current?.payload ?? null);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
      }),
    { database: SAVE_DATABASE, key: saveKey(key) },
  );
}
