/**
 * The runtime adapter's legality and its small commands: every illegal action is rejected with
 * its named code and changes nothing (the runtime keeps the state and the turn), and the economy's
 * commands (buy, equip, decorate, the daily quests and the treasure chest, settings) do what the
 * design says (§8, §9.1, contract §10).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RuntimeSnapshot } from '@aegis/runtime';
import type { GameAction } from '../../../src/rules/contract';
import { PERFECT, Player } from '../../traces/support';
import { playerFrom, saveAfter } from '../progression/saves';

vi.setConfig({ testTimeout: 120_000 });

let afterOne: RuntimeSnapshot;
beforeAll(async () => {
  afterOne = await saveAfter(['sunny-lagoon.1']);
});

async function expectRejected(player: Player, action: GameAction, code: string) {
  const before = player.host.hash();
  expect(await player.reject(action, code), `${action.type} → ${code}`).toBe(true);
  expect(player.host.hash(), 'a rejection changes nothing').toBe(before);
}

describe('before and at the start', () => {
  it('rejects play before a session, bad days and wrong eggs', async () => {
    const player = new Player(PERFECT, 'legality');
    await expectRejected(player, { type: 'startLevel', level: 'sunny-lagoon.1' }, 'no-session');
    await expectRejected(player, { type: 'startSession', day: '2026-02-30' }, 'invalid-day');
    // Every setting may be set before the first session: the grown-ups may set up a child who has
    // not played yet. Out-of-range values are still refused.
    expect(await player.act({ type: 'setSetting', setting: { key: 'grade', value: 3 } })).toBe(
      true,
    );
    expect(await player.act({ type: 'setSetting', setting: { key: 'dailyGoal', value: 10 } })).toBe(
      true,
    );
    expect(await player.act({ type: 'setSetting', setting: { key: 'race', value: false } })).toBe(
      true,
    );
    await expectRejected(
      player,
      { type: 'setSetting', setting: { key: 'dailyGoal', value: 1000 } },
      'invalid-setting',
    );
    expect(player.state().settings).toMatchObject({ grade: 3, dailyGoal: 10, race: false });
    expect(player.state().day).toBeNull();
    await player.act({ type: 'startSession', day: '2026-11-02' });
    expect(player.state().daily?.goal, 'the first day takes the goal set before it').toBe(10);
    await player.act({ type: 'setSetting', setting: { key: 'race', value: true } });
    expect(player.view().story?.skippable).toBe(true);
    await player.choose(null);
    // The first-egg beat cannot be skipped: no level until it is read.
    expect(player.view().story?.skippable).toBe(false);
    await expectRejected(player, { type: 'startLevel', level: 'sunny-lagoon.1' }, 'story-pending');
    await player.settleStory();
    await expectRejected(
      player,
      { type: 'chooseFirstFriend', friend: 'rak-korinek' },
      'not-a-first-friend',
    );
    await expectRejected(
      player,
      { type: 'chooseFirstFriend', friend: 'nobody' },
      'not-a-first-friend',
    );
    expect(await player.act({ type: 'chooseFirstFriend', friend: 'zelva-obojka' })).toBe(true);
    await expectRejected(
      player,
      { type: 'chooseFirstFriend', friend: 'krab-tvrdak' },
      'friend-chosen',
    );
    expect(player.data_('egg.received')).toEqual([{ friend: 'zelva-obojka' }]);
    await player.dispose();
  });
});

describe('levels, activities and answers', () => {
  it('rejects locked or unknown levels, out-of-order activities and answers with nothing asked', async () => {
    const player = await playerFrom(afterOne);
    await expectRejected(player, { type: 'startLevel', level: 'atlantis.1' }, 'unknown-level');
    await expectRejected(player, { type: 'startLevel', level: 'sunny-lagoon.3' }, 'locked-level');
    await expectRejected(
      player,
      { type: 'startLevel', level: 'sunny-lagoon.2', activity: 0 },
      'locked-activity',
    );
    await expectRejected(
      player,
      { type: 'startActivity', activity: { kind: 'level', index: 0 } },
      'no-level',
    );
    await expectRejected(
      player,
      { type: 'answer', value: { kind: 'text', value: 'y' }, elapsedMs: 900 },
      'no-problem',
    );
    await expectRejected(player, { type: 'hint' }, 'no-problem');
    await expectRejected(player, { type: 'endRound', reason: 'quit' }, 'no-round');
    await expectRejected(
      player,
      { type: 'startActivity', activity: { kind: 'race' } },
      'race-locked',
    );
    expect(await player.act({ type: 'startLevel', level: 'sunny-lagoon.2' })).toBe(true);
    await player.settleStory();
    await expectRejected(player, { type: 'startLevel', level: 'sunny-lagoon.1' }, 'round-active');
    await expectRejected(
      player,
      { type: 'startActivity', activity: { kind: 'level', index: 1 } },
      'round-active',
    );
    await expectRejected(
      player,
      { type: 'placementAnswer', value: { kind: 'text', value: 'a' }, elapsedMs: 900 },
      'wrong-action',
    );
    await expectRejected(player, { type: 'endRound', reason: 'done' }, 'round-active');
    await expectRejected(player, { type: 'endRound', reason: 'time-up' }, 'not-timed');
    await expectRejected(
      player,
      { type: 'minigameMove', revision: 0, move: { type: 'submit' } },
      'no-board',
    );
    // A finished level replays single activities.
    expect(await player.act({ type: 'endRound', reason: 'quit' })).toBe(true);
    await expectRejected(player, { type: 'endRound', reason: 'quit' }, 'no-round');
    expect(await player.act({ type: 'startLevel', level: 'sunny-lagoon.1', activity: 1 })).toBe(
      true,
    );
    expect(player.view().round?.activity).toBe('fishing-nets');
    await expectRejected(
      player,
      { type: 'minigameMove', revision: 999, move: { type: 'submit' } },
      'stale-move',
    );
    const round = player.view().round!;
    const revision = round.type === 'minigame' ? round.minigame.revision : 0;
    await expectRejected(
      player,
      { type: 'minigameMove', revision, move: { type: 'net', fish: 'no-such-fish', net: 0 } },
      'invalid-move',
    );
    // A finished round waits for the child to close it: it cannot be quit any more.
    await player.playRound();
    expect(player.view().round?.status).toBe('complete');
    await expectRejected(player, { type: 'endRound', reason: 'quit' }, 'round-finished');
    expect(await player.act({ type: 'endRound', reason: 'done' })).toBe(true);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});

describe('U Mrože, outfits and the grotto', () => {
  it('sells what is unlocked and affordable, once; dresses friends and decorates the grotto', async () => {
    const player = await playerFrom(afterOne);
    const coins = player.state().coins;
    await expectRejected(player, { type: 'buy', item: 'crown-coral' }, 'unknown-item');
    await expectRejected(player, { type: 'buy', item: 'no-such-hat' }, 'unknown-item');
    expect(await player.act({ type: 'buy', item: 'hat-captain' })).toBe(true);
    expect(player.state().coins).toBe(coins - 20);
    expect(player.data_('item.purchased')).toEqual([{ item: 'hat-captain', price: 20 }]);
    await expectRejected(player, { type: 'buy', item: 'hat-captain' }, 'owned');
    if (player.state().coins < 40) {
      await expectRejected(player, { type: 'buy', item: 'scarf-sea' }, 'insufficient-coins');
    }
    await expectRejected(
      player,
      { type: 'equip', friend: 'krab-tvrdak', slot: 'eyes', item: 'hat-captain' },
      'wrong-slot',
    );
    await expectRejected(
      player,
      { type: 'equip', friend: 'krab-tvrdak', slot: 'eyes', item: 'goggles-yellow' },
      'not-owned',
    );
    await expectRejected(
      player,
      { type: 'equip', friend: 'rak-korinek', slot: 'head', item: 'hat-captain' },
      'unknown-friend',
    );
    expect(
      await player.act({ type: 'equip', friend: 'krab-tvrdak', slot: 'head', item: 'hat-captain' }),
    ).toBe(true);
    expect(player.view().friends.find((f) => f.id === 'krab-tvrdak')!.outfit.head).toBe(
      'hat-captain',
    );
    expect(player.data_('friend.dressed')).toEqual([
      { friend: 'krab-tvrdak', slot: 'head', item: 'hat-captain' },
    ]);
    expect(
      await player.act({ type: 'equip', friend: 'krab-tvrdak', slot: 'head', item: null }),
    ).toBe(true);
    expect(player.view().friends.find((f) => f.id === 'krab-tvrdak')!.outfit.head).toBeNull();
    await expectRejected(player, { type: 'decorate', spot: 0, item: 'hat-captain' }, 'wrong-slot');
    await expectRejected(player, { type: 'decorate', spot: 0, item: 'lamp-anemone' }, 'not-owned');
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('moves a grotto decoration rather than copying it', async () => {
    const save = await saveAfter(['sunny-lagoon.1', 'sunny-lagoon.2', 'sunny-lagoon.3']);
    const player = await playerFrom(save);
    expect(await player.act({ type: 'buy', item: 'lamp-anemone' })).toBe(true);
    expect(await player.act({ type: 'decorate', spot: 0, item: 'lamp-anemone' })).toBe(true);
    expect(await player.act({ type: 'decorate', spot: 2, item: 'lamp-anemone' })).toBe(true);
    const spots = player.view().grotto.spots;
    expect(spots.filter((spot) => spot === 'lamp-anemone')).toHaveLength(1);
    expect(spots[2]).toBe('lamp-anemone');
    await player.dispose();
  });
});

describe('daily quests, the treasure chest and settings', () => {
  it('pays a done quest once, opens the chest only when the goal is met', async () => {
    const player = await playerFrom(afterOne);
    await expectRejected(player, { type: 'openChest' }, 'chest-not-ready');
    const daily = player.view().daily!;
    const done = daily.quests.find((q) => q.done);
    const open = daily.quests.find((q) => !q.done);
    if (open)
      await expectRejected(player, { type: 'claimQuest', quest: open.id }, 'quest-not-done');
    await expectRejected(player, { type: 'claimQuest', quest: 'quest.answers@1' }, 'unknown-quest');
    if (done) {
      const coins = player.state().coins;
      expect(await player.act({ type: 'claimQuest', quest: done.id })).toBe(true);
      expect(player.state().coins).toBe(coins + done.coins);
      await expectRejected(player, { type: 'claimQuest', quest: done.id }, 'quest-claimed');
    }
    // Play on until the daily goal is reached: then the chest opens, once.
    for (const level of ['sunny-lagoon.2', 'sunny-lagoon.3']) await player.playLevel(level);
    expect(player.view().daily!.reached).toBe(true);
    expect(player.view().daily!.chest).toBe('ready');
    expect(await player.act({ type: 'openChest' })).toBe(true);
    expect(player.data_('chest.opened')).toHaveLength(1);
    expect(player.view().daily!.chest).toBe('opened');
    await expectRejected(player, { type: 'openChest' }, 'chest-not-ready');
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('checks the settings it is given', async () => {
    const player = await playerFrom(afterOne);
    await expectRejected(
      player,
      { type: 'setSetting', setting: { key: 'dailyGoal', value: 1 } },
      'invalid-setting',
    );
    await expectRejected(
      player,
      { type: 'setSetting', setting: { key: 'unlockAhead', value: ['atlantis'] } },
      'invalid-setting',
    );
    expect(await player.act({ type: 'setSetting', setting: { key: 'dailyGoal', value: 20 } })).toBe(
      true,
    );
    expect(player.view().settings.dailyGoal).toBe(20);
    expect(
      await player.act({
        type: 'setSetting',
        setting: { key: 'unlockAhead', value: ['moon-caves'] },
      }),
    ).toBe(true);
    expect(player.view().hub.regions.find((r) => r.id === 'moon-caves')!.unlocked).toBe(true);
    expect(await player.act({ type: 'setSetting', setting: { key: 'race', value: false } })).toBe(
      true,
    );
    expect(player.view().settings.race).toBe(false);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});
