/**
 * One child's game session and the command controller: strict durable checkpoints, retrying
 * the exact failed write (never the action), stale-view guards, pause and continuation,
 * validated restore with recovery, backups and content activation at a boundary.
 */
import { MemorySaveStorage } from '@aegis/browser/save';
import { describe, expect, it, vi } from 'vitest';
import {
  CommandRejectedError,
  createCommandController,
  SAVE_PATIENCE_MS,
  StaleCommandError,
  taken,
} from '../../../src/app/controller/commands';
import { rebind } from '../../../src/app/persistence/backup';
import { gamePolicy, openGameSession, packFor } from '../../../src/app/persistence/game-session';
import { ContentUnavailable, RecoveryRequired } from '../../../src/app/persistence/recovery';
import {
  COUNT_GAME,
  COUNT_GAME_V2,
  COUNT_V1,
  FlakyStorage,
  PROFILE_A,
  PROFILE_B,
  SlowStorage,
} from './fixtures';

const noErrors = (error: unknown): void => {
  throw error;
};

describe('game session', () => {
  it('starts a new game with nothing saved, then saves each commit durably', async () => {
    const storage = new MemorySaveStorage();
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    expect(session.indicator()).toEqual({ kind: 'none' });
    expect(await session.storedText()).toBeUndefined();
    const commands = createCommandController(session.host, noErrors);
    const receipt = await commands.capture()({ type: 'tick', turns: 1 });
    expect(receipt.durable).toBe(true);
    expect(session.indicator()).toEqual({ kind: 'saved' });
    commands.dispose();
    await session.close();

    const reopened = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    expect(reopened.host.getView()).toEqual({ count: 1, ticks: 1, content: 'v1' });
    expect(reopened.host.getStatus().durableRevision).toBe(reopened.host.getStatus().revision);
    expect(reopened.indicator()).toEqual({ kind: 'saved' });
    await reopened.close();
  });

  it('keeps each child in their own save', async () => {
    const storage = new MemorySaveStorage();
    const a = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    await createCommandController(a.host, noErrors).capture()({ type: 'tick', turns: 2 });
    await a.close();
    const b = await openGameSession(storage, COUNT_GAME, PROFILE_B);
    expect(b.host.getView().count).toBe(0);
    await b.close();
  });

  it('retries the exact failed write and continues the accepted action without repeating it', async () => {
    const storage = new FlakyStorage();
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, noErrors);
    storage.failures = 1;
    const failed = await commands
      .capture()({ type: 'tick', turns: 2 })
      .catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(CommandRejectedError);
    expect((failed as CommandRejectedError).accepted).toBe(true);
    expect(session.host.getView()).toMatchObject({ count: 1, ticks: 1 });
    expect(session.host.getStatus().pendingAction).not.toBeNull();
    expect(session.indicator()).toEqual({ kind: 'failed', code: 'storage' });

    const blocked = await commands
      .capture()({ type: 'note' })
      .catch((error: unknown) => error);
    expect((blocked as CommandRejectedError).error.code).toBe('checkpoint-blocked');

    await commands.retry();
    expect(session.host.getView()).toMatchObject({ count: 2, ticks: 1 });
    expect(session.host.getStatus().pendingAction).toBeNull();
    expect(session.indicator()).toEqual({ kind: 'saved' });
    commands.dispose();
    await session.close();

    const reopened = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    expect(reopened.host.getView()).toMatchObject({ count: 2, ticks: 1 });
    await reopened.close();
  });

  it('counts an action the game took as done for moving on, while refusals still reject', async () => {
    const storage = new FlakyStorage();
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, () => undefined);
    storage.failures = 1;
    await expect(taken(commands.capture()({ type: 'tick', turns: 1 }))).resolves.toBeUndefined();
    await expect(taken(commands.capture()({ type: 'note' }))).rejects.toBeInstanceOf(
      CommandRejectedError,
    );
    commands.dispose();
    await session.close();
  });

  it('refuses controls captured before a newer view', async () => {
    const session = await openGameSession(new MemorySaveStorage(), COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, noErrors);
    const stale = commands.capture();
    await commands.capture()({ type: 'note' });
    await expect(stale({ type: 'note' })).rejects.toBeInstanceOf(StaleCommandError);
    commands.dispose();
    await expect(commands.capture()({ type: 'note' })).rejects.toBeInstanceOf(StaleCommandError);
    await session.close();
  });

  it('passes every commit on from one host listener, and reads the view without copying', async () => {
    const session = await openGameSession(new MemorySaveStorage(), COUNT_GAME, PROFILE_A);
    const subscribe = vi.spyOn(session.host, 'subscribe');
    const subscribeCommits = vi.spyOn(session.host, 'subscribeCommits');
    const getView = vi.spyOn(session.host, 'getView');
    const commands = createCommandController(session.host, noErrors, (listener) =>
      session.subscribe((change) => listener(change.reason)),
    );
    const changes: { count: number; reason: string; events: string[] }[] = [];
    const unsubscribe = session.subscribe((change) =>
      changes.push({
        count: change.view.count,
        reason: change.reason,
        events: change.events.map((event) => event.type),
      }),
    );
    const before = session.view();
    expect(before).toEqual({ count: 0, ticks: 0, content: 'v1' });
    const stale = commands.capture();
    await commands.capture()({ type: 'tick', turns: 1 });
    expect(changes).toEqual([{ count: 1, reason: 'commit', events: ['counted'] }]);
    const after = session.view();
    expect(after).toEqual({ count: 1, ticks: 1, content: 'v1' });
    expect(session.view(), 'the same view until the next commit').toBe(after);
    expect(before, 'an earlier view is never changed').toEqual({
      count: 0,
      ticks: 0,
      content: 'v1',
    });
    await expect(
      stale({ type: 'note' }),
      'the fan-out keeps the stale-view guard',
    ).rejects.toBeInstanceOf(StaleCommandError);
    expect(subscribe, 'no view listener on the host').not.toHaveBeenCalled();
    expect(subscribeCommits, 'no commit listener besides the session own').not.toHaveBeenCalled();
    expect(getView, 'no copy of the view per read').not.toHaveBeenCalled();
    unsubscribe();
    await commands.capture()({ type: 'note' });
    expect(changes, 'an unsubscribed listener hears nothing more').toHaveLength(1);
    commands.dispose();
    await session.close();
  });

  it('runs every listener even when one fails, and the game goes on', async () => {
    const session = await openGameSession(new MemorySaveStorage(), COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, () => undefined);
    const heard: number[] = [];
    session.subscribe(() => {
      throw new Error('a broken screen');
    });
    session.subscribe((change) => heard.push(change.view.count));
    const receipt = await commands.capture()({ type: 'tick', turns: 1 });
    expect(receipt.accepted).toBe(true);
    expect(heard).toEqual([1]);
    expect(session.view().count).toBe(1);
    commands.dispose();
    await session.close();
  });

  it('shows a sent action once it is saved, or once taken when the save is slow', async () => {
    const storage = new SlowStorage();
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, noErrors);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      storage.held = true;
      let shown = false;
      const sending = commands
        .captureSend()({ type: 'tick', turns: 1 })
        .then(() => (shown = true));
      // Taken at once, but the slow save holds it back for the patience only.
      await vi.advanceTimersByTimeAsync(SAVE_PATIENCE_MS - 1);
      expect(shown).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await sending;
      expect(shown).toBe(true);
    } finally {
      vi.useRealTimers();
    }
    // Committed and shown, not yet durable: the save status says so.
    expect(session.host.getView().count).toBe(1);
    expect(session.host.getStatus().durableRevision).not.toBe(session.host.getStatus().revision);
    expect(session.indicator().kind).toBe('saving');

    // The next action waits for that save instead of being refused as busy.
    let second = false;
    const next = commands
      .captureSend()({ type: 'tick', turns: 1 })
      .then(() => (second = true));
    await Promise.resolve();
    expect(second).toBe(false);
    storage.release();
    await next;
    expect(session.host.getView().count).toBe(2);
    await commands.capture()({ type: 'note' });
    expect(session.indicator()).toEqual({ kind: 'saved' });
    commands.dispose();
    await session.close();
  });

  it('holds a sent action whose save failed at once, and lets Retry store it', async () => {
    const storage = new FlakyStorage();
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, noErrors);
    storage.failures = 1;
    // The game took the action, but nothing is praised for what is not stored.
    const held = await commands
      .captureSend()({ type: 'tick', turns: 1 })
      .catch((error: unknown) => error);
    expect(held).toBeInstanceOf(CommandRejectedError);
    expect((held as CommandRejectedError).accepted).toBe(true);
    expect(session.host.getView().count).toBe(1);
    expect(session.indicator().kind).toBe('failed');
    const blocked = await commands
      .captureSend()({ type: 'note' })
      .catch((error: unknown) => error);
    expect((blocked as CommandRejectedError).error.code).toBe('checkpoint-blocked');
    await commands.retry();
    expect(session.indicator()).toEqual({ kind: 'saved' });
    await commands.captureSend()({ type: 'note' });
    commands.dispose();
    await session.close();
  });

  it('pauses between turns and continues the accepted action on resume', async () => {
    const session = await openGameSession(new MemorySaveStorage(), COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, noErrors);
    let paused = false;
    const unsubscribe = session.host.subscribeCommits(() => {
      if (!paused) {
        paused = true;
        session.host.pause('visibility');
      }
    });
    const receipt = await commands.capture()({ type: 'tick', turns: 3 });
    unsubscribe();
    expect(receipt.pending).toBe(true);
    expect(session.host.getView().count).toBe(1);
    const refused = await commands
      .capture()({ type: 'note' })
      .catch((error: unknown) => error);
    expect((refused as CommandRejectedError).error.code).toBe('paused');
    await commands.resume('visibility');
    expect(session.host.getView()).toMatchObject({ count: 3, ticks: 1 });
    expect(session.host.getStatus().pendingAction).toBeNull();
    commands.dispose();
    await session.close();
  });
});

describe('restore and recovery', () => {
  async function savedGame(storage: MemorySaveStorage) {
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    await createCommandController(session.host, noErrors).capture()({ type: 'tick', turns: 1 });
    await session.close();
    return storage.read(gamePolicy(COUNT_GAME, PROFILE_A.id));
  }

  it('asks for recovery instead of starting over when the save breaks the game rules', async () => {
    const storage = new MemorySaveStorage();
    const history = await savedGame(storage);
    const policy = gamePolicy(COUNT_GAME, PROFILE_A.id);
    const envelope = JSON.parse(history.current!.payload);
    envelope.state.world.resources['aegis.runtime.state'].count = -1;
    const tampered = JSON.stringify(envelope);
    await storage.compareAndSwap(policy, history.current!.revision, {
      revision: history.current!.revision + 1,
      payload: tampered,
    });
    const error = await openGameSession(storage, COUNT_GAME, PROFILE_A).catch((cause) => cause);
    expect(error).toBeInstanceOf(RecoveryRequired);
    expect((error as RecoveryRequired).kind).toBe('game');
    expect((error as RecoveryRequired).actions.original).toBe(tampered);
    await expect((error as RecoveryRequired).actions.replace(tampered)).rejects.toThrow();
    await (error as RecoveryRequired).actions.replace(
      (error as RecoveryRequired).actions.previous!,
    );
    const recovered = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    expect(recovered.host.getView().count).toBe(1);
    await recovered.close();
  });

  it('refuses a save from content this build does not have', async () => {
    const storage = new MemorySaveStorage();
    const history = await savedGame(storage);
    const policy = gamePolicy(COUNT_GAME, PROFILE_A.id);
    const envelope = JSON.parse(history.current!.payload);
    envelope.contentRevision = 'v9';
    await storage.compareAndSwap(policy, history.current!.revision, {
      revision: history.current!.revision + 1,
      payload: JSON.stringify(envelope),
    });
    const error = await openGameSession(storage, COUNT_GAME, PROFILE_A).catch((cause) => cause);
    expect(error).toBeInstanceOf(RecoveryRequired);
    expect((error as RecoveryRequired).code).toBe('incompatible');
  });

  it('fetches only a pack the build could have shipped, and only that pack', async () => {
    const asked: string[] = [];
    const game = {
      ...COUNT_GAME,
      content: { ...COUNT_V1, revision: 'v3' },
      loadHistory: async (revision: string) => {
        asked.push(revision);
        if (revision === 'v1') return COUNT_V1;
        if (revision === 'v2') return { ...COUNT_V1, revision: 'v1' };
        throw new Error('not shipped');
      },
    };
    await expect(packFor(game, 'v1')).resolves.toBe(COUNT_V1);
    await expect(packFor(game, 'v2'), 'a file that is another pack').rejects.toBeInstanceOf(
      ContentUnavailable,
    );
    await expect(packFor(game, 'v0')).rejects.toBeInstanceOf(ContentUnavailable);
    await expect(packFor(game, '../secret')).rejects.toBeInstanceOf(ContentUnavailable);
    expect(asked, 'a revision that cannot name a file is never fetched').toEqual([
      'v1',
      'v2',
      'v0',
    ]);
  });

  it('restores an old save on its own content and moves it to the newest at a boundary', async () => {
    const storage = new MemorySaveStorage();
    await savedGame(storage);
    const upgraded = await openGameSession(storage, COUNT_GAME_V2, PROFILE_A);
    expect(upgraded.host.getView()).toEqual({ count: 1, ticks: 1, content: 'v1' });
    expect(upgraded.content().revision).toBe('v1');
    expect(await upgraded.activateLatestContent()).toBe(true);
    expect(upgraded.host.getView().content).toBe('v2');
    expect(upgraded.view().content, 'the activation commit reaches the session view').toBe('v2');
    expect(upgraded.content().revision).toBe('v2');
    expect(upgraded.indicator()).toEqual({ kind: 'saved' });
    expect(await upgraded.activateLatestContent()).toBe(false);
    await createCommandController(upgraded.host, noErrors).capture()({ type: 'tick', turns: 1 });
    expect(upgraded.host.getView().count).toBe(11);
    await upgraded.close();
    const reopened = await openGameSession(storage, COUNT_GAME_V2, PROFILE_A);
    expect(reopened.host.getView()).toEqual({ count: 11, ticks: 2, content: 'v2' });
    await reopened.close();
  });

  it('moves a saved game to another child through a validated backup', async () => {
    const storage = new MemorySaveStorage();
    await savedGame(storage);
    const source = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    const exported = await source.storedText();
    await source.close();
    expect(exported).toBeDefined();

    const target = await openGameSession(storage, COUNT_GAME, PROFILE_B);
    const changes: string[] = [];
    target.subscribe((change) => changes.push(`${change.reason}:${change.view.count}`));
    await expect(target.importEnvelope(exported!)).rejects.toThrow();
    await target.importEnvelope(rebind(JSON.parse(exported!), PROFILE_B.id));
    expect(target.host.getView().count).toBe(1);
    expect(target.view(), 'the restored view is the latest').toEqual(target.host.getView());
    expect(changes, 'a restore is passed on too').toEqual(['restore:1']);
    expect(target.indicator()).toEqual({ kind: 'saved' });
    await target.close();
    const reopened = await openGameSession(storage, COUNT_GAME, PROFILE_B);
    expect(reopened.host.getView().count).toBe(1);
    await reopened.close();
  });
});
