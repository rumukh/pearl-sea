/**
 * Small records (family, preferences): stored through the SDK save service, re-read after a
 * failed write, quick changes applied in turn from the last saved state, and explicit recovery
 * when a stored record cannot be opened.
 */
import { MemorySaveStorage } from '@aegis/browser/save';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_FAMILY, FAMILY_RECORD } from '../../../src/app/persistence/family';
import type { Diver } from '../../../src/app/persistence/family';
import { DEFAULT_PREFERENCES } from '../../../src/app/persistence/preferences';
import { RecordStore, recordPolicy } from '../../../src/app/persistence/records';
import { eraseRecord, RecoveryRequired } from '../../../src/app/persistence/recovery';
import { FamilyStore, PreferencesStore } from '../../../src/app/persistence/stores';
import { FlakyStorage, SlowStorage } from './fixtures';

const EMA: Diver = { id: 'profile-1', name: 'Ema', avatar: 'diver-1', address: 'girl' };

describe('family store', () => {
  it('stores children and opens them again from storage', async () => {
    const storage = new MemorySaveStorage();
    const family = new FamilyStore(storage);
    await family.open();
    const ema = await family.add({ name: 'Ema', avatar: 'diver-3', address: 'girl', grade: 3 });
    expect(ema).toMatchObject({ ok: true, value: { id: 'profile-1', name: 'Ema', grade: 3 } });
    await family.update('profile-1', { name: 'Emička', avatar: 'diver-4', address: 'girl' });
    await family.setPendingGrade('profile-1', null);
    await family.setGrownUpsLanguage('en');
    const again = new FamilyStore(storage);
    expect(await again.open()).toEqual({
      profiles: [{ id: 'profile-1', name: 'Emička', avatar: 'diver-4', address: 'girl' }],
      grownUpsLanguage: 'en',
    });
  });

  it('reports validation problems without writing', async () => {
    const storage = new MemorySaveStorage();
    const family = new FamilyStore(storage);
    await family.open();
    expect(await family.add({ name: '   ', avatar: 'diver-1', address: 'neutral' })).toEqual({
      ok: false,
      problem: 'empty',
    });
    await family.setGrownUpsLanguage('cs');
    expect(
      (await storage.read(recordPolicy(FAMILY_RECORD))).current,
      'choosing the language it already has writes nothing',
    ).toBeUndefined();
  });

  it('keeps the stored state after a failed write, and the next write works', async () => {
    const storage = new FlakyStorage();
    const family = new FamilyStore(storage);
    await family.open();
    await family.add({ name: 'Ema', avatar: 'diver-1', address: 'girl' });
    storage.failures = 1;
    await expect(family.add({ name: 'Tom', avatar: 'diver-2', address: 'boy' })).rejects.toThrow();
    expect(family.state().profiles.map((diver) => diver.name)).toEqual(['Ema']);
    storage.failures = 1;
    await expect(family.setGrownUpsLanguage('en')).rejects.toThrow();
    expect(family.state().grownUpsLanguage).toBe('cs');
    expect(await family.add({ name: 'Tom', avatar: 'diver-2', address: 'boy' })).toMatchObject({
      ok: true,
    });
    expect(family.state().profiles.map((diver) => diver.name)).toEqual(['Ema', 'Tom']);
  });

  it('erases a removed child’s records before dropping them from the list', async () => {
    const storage = new MemorySaveStorage();
    const family = new FamilyStore(storage);
    await family.open();
    await family.add({ name: 'Ema', avatar: 'diver-1', address: 'girl' });
    const order: string[] = [];
    await family.remove('profile-1', async () => {
      order.push(`erase while listed: ${family.state().profiles.length}`);
    });
    expect(order).toEqual(['erase while listed: 1']);
    expect(family.state().profiles).toEqual([]);
  });

  it('tells listeners about every change', async () => {
    const family = new FamilyStore(new MemorySaveStorage());
    const heard: string[] = [];
    family.subscribe((state) => heard.push(state.grownUpsLanguage));
    await family.open();
    await family.setGrownUpsLanguage('en');
    expect(heard).toEqual(['cs', 'en']);
  });

  it('applies quick changes in turn, each from the last saved state', async () => {
    const storage = new SlowStorage();
    const family = new FamilyStore(storage);
    await family.open();
    storage.held = true;
    const ema = family.add({ name: 'Ema', avatar: 'diver-1', address: 'girl' });
    const tom = family.add({ name: 'Tom', avatar: 'diver-2', address: 'boy' });
    const english = family.setGrownUpsLanguage('en');
    const czech = family.setGrownUpsLanguage('cs');
    await vi.waitFor(() => expect(storage.waitingWrites).toBe(1));
    expect(family.state(), 'nothing counts before the disk has it').toEqual(EMPTY_FAMILY);
    storage.release();
    expect(await ema).toMatchObject({ ok: true, value: { id: 'profile-1', name: 'Ema' } });
    expect(await tom).toMatchObject({ ok: true, value: { id: 'profile-2', name: 'Tom' } });
    await english;
    await czech;
    const stored = await new FamilyStore(storage).open();
    expect(stored.profiles.map((diver) => diver.name)).toEqual(['Ema', 'Tom']);
    expect(stored.grownUpsLanguage, 'the last choice wins').toBe('cs');
    expect(family.state()).toEqual(stored);
  });
});

describe('preferences store', () => {
  it('starts from the defaults and persists each change, per child', async () => {
    const storage = new MemorySaveStorage();
    const store = new PreferencesStore(storage, 'profile-1');
    expect(await store.open()).toEqual(DEFAULT_PREFERENCES);
    await store.change((draft) => {
      draft.readAloud = false;
    });
    const reopened = new PreferencesStore(storage, 'profile-1');
    expect((await reopened.open()).readAloud).toBe(false);
    expect((await new PreferencesStore(storage, 'profile-2').open()).readAloud).toBe(true);
  });

  it('keeps every one of several quick changes, in order', async () => {
    const storage = new SlowStorage();
    const store = new PreferencesStore(storage, 'profile-1');
    await store.open();
    storage.held = true;
    const changes = [
      store.change((draft) => {
        draft.readAloud = false;
      }),
      store.change((draft) => {
        draft.autoRead = true;
      }),
      store.change((draft) => {
        draft.timeLimit = 20;
      }),
      store.change((draft) => {
        draft.timeLimit = 30;
      }),
    ];
    await vi.waitFor(() => expect(storage.waitingWrites).toBe(1));
    storage.release();
    await Promise.all(changes);
    const stored = await new PreferencesStore(storage, 'profile-1').open();
    expect(stored).toMatchObject({ readAloud: false, autoRead: true, timeLimit: 30 });
    expect(store.current()).toEqual(stored);
  });

  it('runs the next change after one that failed, from what storage holds', async () => {
    const storage = new FlakyStorage();
    const store = new PreferencesStore(storage, 'profile-1');
    await store.open();
    storage.failures = 1;
    const failed = store.change((draft) => {
      draft.readAloud = false;
    });
    const next = store.change((draft) => {
      draft.autoRead = true;
    });
    await expect(failed).rejects.toThrow();
    expect(await next).toMatchObject({ readAloud: true, autoRead: true });
    expect(await new PreferencesStore(storage, 'profile-1').open()).toMatchObject({
      readAloud: true,
      autoRead: true,
    });
  });
});

describe('record recovery', () => {
  it('turns a corrupt record into explicit recovery that keeps the original bytes', async () => {
    const storage = new MemorySaveStorage();
    const store = new RecordStore(storage, FAMILY_RECORD);
    await store.load();
    await store.save({ profiles: [], grownUpsLanguage: 'cs' });
    await store.save({ profiles: [EMA], grownUpsLanguage: 'cs' });
    const policy = recordPolicy(FAMILY_RECORD);
    const history = await storage.read(policy);
    const corrupt = history.current!.payload.replace('"diver-1"', '"diver-99"');
    expect(corrupt).not.toBe(history.current!.payload);
    await storage.compareAndSwap(policy, history.current!.revision, {
      revision: history.current!.revision + 1,
      payload: corrupt,
    });

    const error = await new RecordStore(storage, FAMILY_RECORD).load().catch((cause) => cause);
    expect(error).toBeInstanceOf(RecoveryRequired);
    const recovery = error as RecoveryRequired;
    expect(recovery.kind).toBe('family');
    expect(recovery.actions.available).toBe(true);
    expect(recovery.actions.original).toBe(corrupt);
    expect(recovery.actions.previous).toBeDefined();

    await expect(recovery.actions.replace('{"not":"a save"}')).rejects.toThrow();
    await recovery.actions.replace(recovery.actions.previous!);
    expect(await new RecordStore(storage, FAMILY_RECORD).load()).toEqual({
      profiles: [EMA],
      grownUpsLanguage: 'cs',
    });
  });

  it('resets a record only through the explicit action, leaving a revision tombstone', async () => {
    const storage = new MemorySaveStorage();
    const policy = recordPolicy(FAMILY_RECORD);
    await storage.compareAndSwap(policy, 0, { revision: 1, payload: '{"broken": true' });
    const error = (await new RecordStore(storage, FAMILY_RECORD)
      .load()
      .catch((cause) => cause)) as RecoveryRequired;
    expect(error).toBeInstanceOf(RecoveryRequired);
    expect(error.code).toBe('invalid-data');
    await error.actions.reset();
    expect(await storage.read(policy)).toEqual({ revision: 2 });
    expect(await new RecordStore(storage, FAMILY_RECORD).load()).toBeUndefined();
  });

  it('erases a record without loading it, and leaves an absent record alone', async () => {
    const storage = new MemorySaveStorage();
    const policy = recordPolicy(FAMILY_RECORD);
    await eraseRecord(storage, policy);
    expect(await storage.read(policy)).toEqual({});
    const store = new RecordStore(storage, FAMILY_RECORD);
    await store.load();
    await store.save({ profiles: [], grownUpsLanguage: 'cs' });
    await eraseRecord(storage, policy);
    expect((await storage.read(policy)).current).toBeUndefined();
  });

  it('reports unreadable storage as unavailable recovery with no destructive actions', async () => {
    const storage = new MemorySaveStorage();
    storage.read = async () => {
      throw new DOMException('Storage is disabled.', 'SecurityError');
    };
    const error = (await new RecordStore(storage, FAMILY_RECORD)
      .load()
      .catch((cause) => cause)) as RecoveryRequired;
    expect(error).toBeInstanceOf(RecoveryRequired);
    expect(error.actions.available).toBe(false);
    expect(error.code).toBe('SecurityError');
    await expect(error.actions.reset()).rejects.toThrow();
  });
});
