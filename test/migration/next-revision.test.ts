/**
 * Saves across processes and content revisions (docs/testing.md, "Saves and migration").
 *
 * A save made mid-round restores in a new process and goes on exactly as the original would
 * (same commits, the pending re-ask included). A save made on the current content continues on
 * the next revision (here: the lagoon fixture plus a second cave lesson, under the next minor
 * revision): a new process restores the save with its exact pack, stages the next revision and
 * activates it at a safe boundary, never mid-round, and the adapter carries every bit of progress
 * forward. Old saves keep selecting their own revision, and a revision is never reused for other
 * content.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRuntimeHost } from '@aegis/runtime';
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import { pearlSeaAdapter } from '../../src/rules/adapter';
import type { ContentData } from '../../src/rules/contract';
import { lagoonPack } from '../fixtures/rules/packs';
import { PERFECT, Player } from '../traces/support';

vi.setConfig({ testTimeout: 300_000 });

const current = lagoonPack();
const [major, minor] = current.revision.split('.').map(Number);
const NEXT = `${major}.${minor! + 1}.0`;

/** The next revision: a second lesson in Měsíční jeskyně, before its monster. */
function next(): ContentPack<ContentData> {
  const pack = JSON.parse(JSON.stringify(current)) as ContentPack<ContentData>;
  const levels = pack.data.levels;
  const first = levels.find((l) => l.id === 'moon-caves.1')!;
  const monster = levels.find((l) => l.id === 'moon-caves.monster')!;
  monster.order = 3;
  monster.unlock = { after: ['moon-caves.2'] };
  levels.splice(levels.indexOf(monster), 0, {
    ...JSON.parse(JSON.stringify(first)),
    id: 'moon-caves.2',
    order: 2,
    titleKey: 'level.moon-caves.2',
    unlock: { after: ['moon-caves.1'] },
    rewards: { coins: [2, 4, 6], eggs: [], cosmetics: [] },
    activities: [first.activities[2]!],
  });
  return { ...pack, revision: NEXT };
}

const host = (content: ContentPack<ContentData>) =>
  createRuntimeHost({ adapter: pearlSeaAdapter, content, seed: 'migration' });

/** A child's save on the current content: the first two lagoon lessons played. */
async function saveOnCurrent(): Promise<{ snapshot: RuntimeSnapshot; player: Player }> {
  const player = new Player(PERFECT, 'migration', undefined, current);
  let snapshot: RuntimeSnapshot | null = null;
  player.host.subscribeCommits((commit) => {
    snapshot = commit.snapshot;
  });
  await player.act({ type: 'startSession', day: '2026-11-02' });
  await player.choose(null);
  await player.settleStory();
  await player.act({ type: 'chooseFirstFriend', friend: 'krab-tvrdak' });
  await player.playLevel('sunny-lagoon.1');
  await player.playLevel('sunny-lagoon.2');
  expect(player.failures).toEqual([]);
  return { snapshot: snapshot!, player };
}

describe('a save made mid-round', () => {
  it('restores in a new process and goes on exactly as the original', async () => {
    const style = { ...PERFECT, right: (n: number) => n !== 2 };
    const original = new Player(style, 'mid-round', undefined, current);
    let snapshot: RuntimeSnapshot | null = null;
    original.host.subscribeCommits((commit) => {
      snapshot = commit.snapshot;
    });
    await original.act({ type: 'startSession', day: '2026-11-02' });
    await original.choose(null);
    await original.settleStory();
    await original.act({ type: 'chooseFirstFriend', friend: 'meduzka-mekulka' });
    await original.act({ type: 'startLevel', level: 'sunny-lagoon.1' });
    await original.settleStory();
    await original.playRound();
    await original.act({ type: 'endRound', reason: 'done' });
    await original.act({ type: 'startActivity', activity: { kind: 'level', index: 1 } });
    await original.playRound();
    await original.act({ type: 'endRound', reason: 'done' });
    await original.act({ type: 'startActivity', activity: { kind: 'level', index: 2 } });
    // Two answers into Krmení, the second one wrong: a re-ask is pending.
    await original.answer();
    await original.answer();
    expect(original.count('reask.scheduled')).toBe(1);
    const saved = snapshot!;

    const restored = host(current);
    expect((await restored.restore(saved)).ok).toBe(true);
    expect(restored.getView(), 'the restored game is the saved game').toEqual(original.view());
    expect(restored.inspect().jobs, 'the re-ask job survives the save').toEqual(
      original.host.inspect().jobs,
    );

    // The same next steps give the same commits in both processes.
    const replay = new Player(style, 'mid-round', undefined, current);
    expect((await replay.host.restore(saved)).ok).toBe(true);
    replay.answered = original.answered;
    replay.turn = original.turn;
    const from = original.hashes.length;
    for (let i = 0; i < 6; i++) {
      await original.answer();
      await replay.answer();
    }
    expect(replay.failures).toEqual([]);
    expect(replay.hashes).toEqual(original.hashes.slice(from));
    expect(replay.served.some((s) => s.reask)).toBe(true);
    await Promise.all([original.dispose(), replay.dispose(), restored.dispose()]);
  });
});

describe('activating the next content revision on a save', () => {
  it('restores the save in a new process, then switches to the next revision at a safe boundary', async () => {
    const { snapshot, player } = await saveOnCurrent();
    expect(snapshot.content.revision).toBe(current.revision);
    const before = player.state();

    const later = host(current);
    expect((await later.restore(snapshot)).ok).toBe(true);
    expect(later.getView(), 'the restored game is the saved game').toEqual(player.view());
    expect(later.stageContent(next()).ok).toBe(true);

    expect((await later.dispatch({ type: 'startLevel', level: 'sunny-lagoon.1' })).ok).toBe(true);
    const midRound = await later.activateContent(next(), 'boundary');
    expect(midRound.ok ? 'activated' : midRound.error.code, 'never mid-round').toBe(
      'unsafe-boundary',
    );

    expect((await later.dispatch({ type: 'endRound', reason: 'quit' })).ok).toBe(true);
    const progress = later.inspect().state;
    let activated: RuntimeSnapshot | null = null;
    later.subscribeCommits((commit) => {
      activated = commit.snapshot;
    });
    expect((await later.activateContent(next(), 'boundary')).ok).toBe(true);
    expect(activated!.content.revision).toBe(NEXT);
    expect(later.inspect().state, 'the adapter carries all progress forward').toEqual(progress);
    expect(progress.levels).toEqual(before.levels);
    expect([progress.coins, progress.friends, progress.stickers, progress.items]).toEqual([
      before.coins,
      before.friends,
      before.stickers,
      before.items,
    ]);

    const regions = later.getView().hub.regions;
    expect(regions.find((r) => r.id === 'moon-caves')!.levels.map((l) => l.id)).toEqual([
      'moon-caves.1',
      'moon-caves.2',
      'moon-caves.monster',
    ]);
    const statuses = (view: typeof regions) =>
      view.find((r) => r.id === 'sunny-lagoon')!.levels.map((l) => l.status);
    expect(statuses(regions)).toEqual(statuses(player.view().hub.regions));
    expect((await later.dispatch({ type: 'startLevel', level: 'sunny-lagoon.3' })).ok).toBe(true);

    await player.dispose();
    await later.dispose();
  });

  it('keeps old saves on their own revision, and never reuses a revision for new content', async () => {
    const { snapshot, player } = await saveOnCurrent();
    const later = host(next());
    const missing = await later.restore(snapshot);
    expect(missing.ok ? 'restored' : missing.error.code, 'needs its exact pack').toBe(
      'incompatible-save',
    );
    expect(later.stageContent(current).ok).toBe(true);
    expect((await later.restore(snapshot)).ok, 'with its pack installed it restores').toBe(true);
    expect(later.inspect().content.revision).toBe(current.revision);

    const changed = next();
    changed.data.levels.find((l) => l.id === 'moon-caves.2')!.activities[0]!.count = 12;
    const reused = later.stageContent(changed);
    expect(reused.ok ? 'staged' : reused.error.code).toBe('content-revision-reused');
    await player.dispose();
    await later.dispose();
  });
});
