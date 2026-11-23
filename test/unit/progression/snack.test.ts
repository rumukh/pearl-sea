/**
 * Svačinka and Osmiččin košík (design §5.15, §6.3): a day opens with its first new level and the
 * adventure offers a snack for hungry friends right after it (first, when no new level comes); a
 * snack has 6-10 problems (4-6 while recent success is low), serves only items the child met or
 * was taught (never a board-only item), brings a first taste (a taught item never answered) at
 * every other problem, up to three, and once fed the adventure moves on; a starving item brings
 * Svačinka back right after the day's first new level.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RuntimeSnapshot } from '@aegis/runtime';
import type { ProblemRoundView } from '../../../src/rules/contract';
import { taughtItems } from '../../../src/rules/progression/friends';
import { itemIndex } from '../../../src/rules/learning/index-cache';
import { lagoonPack } from '../../fixtures/rules/packs';
import { PERFECT } from '../../traces/support';
import type { Player, Style } from '../../traces/support';
import { playerFrom, saveAfter } from './saves';

vi.setConfig({ testTimeout: 120_000 });

const pack = lagoonPack();
const BOARD_ONLY = /^(abc|pair|seg|fam):/;

let afterThree: RuntimeSnapshot;
beforeAll(async () => {
  afterThree = await saveAfter(['sunny-lagoon.1', 'sunny-lagoon.2', 'sunny-lagoon.3']);
});

/** Play a Svačinka for `friend` (or all) now, recording what it served. */
async function playSnack(player: Player, friend: string | null) {
  const known = new Set(Object.keys(player.state().items));
  const taught = taughtItems(player.state(), pack.data, itemIndex(pack.data));
  await player.act({ type: 'startActivity', activity: { kind: 'snack', friend } });
  const target = (player.view().round as ProblemRoundView).progress.target;
  const start = player.served.length;
  await player.playRound();
  const served = player.served.slice(start).filter((s) => s.step === 0);
  await player.act({ type: 'endRound', reason: 'done' });
  await player.settleStory();
  return { served, known, taught, target };
}

/**
 * Start the next day, play the new level the adventure opens it with (if any), then the snack it
 * offers, recording what it served.
 */
async function snackDay(player: Player, day: string) {
  await player.act({ type: 'startSession', day });
  await player.settleStory();
  const first = player.view().hub.next;
  const opened = first.kind === 'level' ? first.level : null;
  if (opened !== null) await player.playLevel(opened);
  const next = player.view().hub.next;
  if (next.kind !== 'snack') return { opened, next, served: [], target: null };
  return { opened, next, ...(await playSnack(player, next.friend)) };
}

describe('Svačinka', () => {
  it('serves 6-10 met or taught items with first tastes every other problem', async () => {
    const player = await playerFrom(afterThree);
    await player.act({ type: 'startSession', day: '2026-11-03' });
    await player.settleStory();
    expect(player.view().hub.next, 'the day opens with something new').toEqual({
      kind: 'level',
      level: 'sunny-lagoon.4',
    });
    // Fed from the friends' screen before the level, while the first tastes still wait.
    const day = await playSnack(player, null);
    expect(day.target).toBeGreaterThanOrEqual(6);
    expect(day.target).toBeLessThanOrEqual(10);
    expect(day.served).toHaveLength(day.target!);
    expect(day.served.every((s) => !BOARD_ONLY.test(s.item))).toBe(true);
    expect(day.served.every((s) => day.known.has(s.item) || day.taught.has(s.item))).toBe(true);
    const tastes = day.served.filter((s) => !day.known.has(s.item) && !s.reask);
    expect(tastes.length, 'some first tastes').toBeGreaterThan(0);
    expect(tastes.length).toBeLessThanOrEqual(3);
    expect(
      tastes.every((s) => s.index % 2 === 0),
      'at the 2nd, 4th, 6th problem',
    ).toBe(true);
    // Fed: the adventure moves on to the next lesson.
    expect(player.view().hub.next).toEqual({ kind: 'level', level: 'sunny-lagoon.4' });
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('is short, 4-6 problems, while recent success is low', async () => {
    // Lesson 1 goes well (the egg hatches), lesson 2 badly.
    const struggling: Style = {
      right: (n) => n <= 10 || n % 3 === 0,
      elapsedMs: () => 5000,
      clumsy: false,
    };
    const save = await saveAfter([]);
    const player = await playerFrom(save, struggling);
    await player.playLevel('sunny-lagoon.1');
    await player.playLevel('sunny-lagoon.2');
    const day = await snackDay(player, '2026-11-03');
    expect(day.opened, 'a hard day holds new levels: Svačinka first').toBeNull();
    expect(day.next.kind).toBe('snack');
    expect(day.target).toBeGreaterThanOrEqual(4);
    expect(day.target).toBeLessThanOrEqual(6);
    await player.dispose();
  });

  it('comes back right after the day’s first new level when a known item starves', async () => {
    const player = await playerFrom(afterThree);
    await snackDay(player, '2026-11-03');
    // Two weeks later every known item is far past its review.
    const later = await snackDay(player, '2026-11-20');
    expect(later.opened, 'a return opens with something new').toBe('sunny-lagoon.5');
    expect(later.next.kind).toBe('snack');
    expect(later.served.length).toBeGreaterThan(0);
    await player.dispose();
  });

  it('rejects a snack when nobody is hungry', async () => {
    const player = await playerFrom(afterThree);
    await snackDay(player, '2026-11-03');
    await player.playLevel('sunny-lagoon.4');
    const hungry = player.view().hub.hungry;
    if (hungry.length === 0) {
      expect(
        await player.reject(
          { type: 'startActivity', activity: { kind: 'snack', friend: null } },
          'not-hungry',
        ),
      ).toBe(true);
    }
    expect(
      await player.reject(
        { type: 'startActivity', activity: { kind: 'snack', friend: 'rak-korinek' } },
        'unknown-friend',
      ),
    ).toBe(true);
    await player.dispose();
  });
});

describe('the snack for a friend', () => {
  it('feeds only that friend’s items', async () => {
    const player = await playerFrom(afterThree, PERFECT);
    await player.act({ type: 'startSession', day: '2026-11-03' });
    await player.settleStory();
    const friend = player.view().hub.hungry[0]!;
    const set = new Set(
      pack.data.friends
        .find((f) => f.id === friend)!
        .skills.flatMap((skill) => itemIndex(pack.data).get(skill) ?? []),
    );
    await player.act({ type: 'startActivity', activity: { kind: 'snack', friend } });
    await player.playRound();
    const served = player.served.filter((s) => s.activity === 'snack' && s.step === 0);
    expect(served.length).toBeGreaterThan(0);
    expect(served.every((s) => set.has(s.item))).toBe(true);
    await player.dispose();
  });
});
