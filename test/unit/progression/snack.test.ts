/**
 * Svačinka and Osmiččin košík (design §5.15, §6.3): at the start of a day the adventure offers a
 * snack for hungry friends before new levels; a snack has 6-10 problems (4-6 while recent success
 * is low), serves only items the child met or was taught (never a board-only item), brings a
 * first taste (a taught item never answered) at every other problem, up to three, and once fed
 * the adventure moves on; a starving item brings Svačinka back first.
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

/** Start the next day and play the snack the adventure offers, recording what it served. */
async function snackDay(player: Player, day: string) {
  await player.act({ type: 'startSession', day });
  await player.settleStory();
  const next = player.view().hub.next;
  const known = new Set(Object.keys(player.state().items));
  const taught = taughtItems(player.state(), pack.data, itemIndex(pack.data));
  if (next.kind !== 'snack') return { next, served: [], known, taught, target: null };
  await player.act({ type: 'startActivity', activity: { kind: 'snack', friend: next.friend } });
  const target = (player.view().round as ProblemRoundView).progress.target;
  const start = player.served.length;
  await player.playRound();
  const served = player.served.slice(start).filter((s) => s.step === 0);
  await player.act({ type: 'endRound', reason: 'done' });
  await player.settleStory();
  return { next, served, known, taught, target };
}

describe('Svačinka', () => {
  it('comes first on a new day, serves 6-10 met or taught items with first tastes every other problem', async () => {
    const player = await playerFrom(afterThree);
    const day = await snackDay(player, '2026-11-03');
    expect(day.next.kind).toBe('snack');
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
    expect(day.next.kind).toBe('snack');
    expect(day.target).toBeGreaterThanOrEqual(4);
    expect(day.target).toBeLessThanOrEqual(6);
    await player.dispose();
  });

  it('comes back before new levels when a known item starves', async () => {
    const player = await playerFrom(afterThree);
    await snackDay(player, '2026-11-03');
    // Two weeks later every known item is far past its review.
    const later = await snackDay(player, '2026-11-20');
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
