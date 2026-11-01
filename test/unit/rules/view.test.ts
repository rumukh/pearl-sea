/**
 * The game view (contract §12) after a first lesson: the friend's next stage with exact counts,
 * the Great Shell's pearls of the open regions, today's polished pearls and learned words, U Mrože's
 * shelf, and the grown-ups' area with the hardest item named by its Czech word.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../../../src/rules/contract';
import { itemIndex, itemsOf } from '../../../src/rules/learning/index-cache';
import { PERFECT, Player } from '../../traces/support';

vi.setConfig({ testTimeout: 120_000 });

let player: Player;
let view: GameView;
beforeAll(async () => {
  player = new Player({ ...PERFECT, right: (n) => n !== 2 }, 'view');
  await player.begin('krab-tvrdak');
  await player.playLevel('sunny-lagoon.1');
  view = player.view();
  expect(player.failures).toEqual([]);
});

describe('the view after a first lesson', () => {
  it('shows the hatched friend’s next stage with exact counts', () => {
    const krab = view.friends.find((f) => f.id === 'krab-tvrdak')!;
    expect(krab.stage).toBe('baby');
    expect(krab.next).toMatchObject({
      stage: 'grown',
      share: 80,
      mastery: 'silver',
      monster: 'murena-mumla',
    });
    expect(krab.next!.need).toBe(Math.ceil((krab.mastery.items * 80) / 100));
    expect(krab.next!.have).toBeLessThan(krab.next!.need);
    expect(krab.mastery.seen).toBeGreaterThanOrEqual(30);
  });

  it('lays the open regions’ items as pearls in the Great Shell, with today’s new ones', () => {
    const data = player.data;
    const open = new Set(view.hub.regions.filter((r) => r.unlocked).map((r) => r.id));
    const skills = data.levels
      .filter((level) => open.has(level.region))
      .flatMap((level) => level.activities.flatMap((a) => a.skills));
    const items = itemsOf([...new Set(skills)], itemIndex(data));
    const total = Object.values(view.shell.counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(items.length);
    expect(view.shell.recent.length).toBeGreaterThan(0);
    expect(view.shell.recent.every((pearl) => player.state().items[pearl.item] !== undefined)).toBe(
      true,
    );
    expect(view.daily!.learned.length).toBeGreaterThan(0);
    expect(view.daily!.learned.every((w) => w.text.length > 0)).toBe(true);
  });

  it('shows U Mrože with what is open, affordable or not', () => {
    const hat = view.market.items.find((i) => i.id === 'hat-captain')!;
    expect(hat).toMatchObject({ available: true, owned: false, affordable: view.coins >= 20 });
    expect(view.market.items.find((i) => i.id === 'crown-coral')!.available).toBe(false);
  });

  it('names the hardest item by its word for the grown-ups', () => {
    const missed = player.served.find((s) => !s.right)!;
    const hardest = view.grownUps.hardest.find((h) => h.item === missed.item);
    expect(hardest, `the missed item ${missed.item} is among the hardest`).toBeDefined();
    expect(hardest!.text.length).toBeGreaterThan(0);
    expect(hardest!.accuracy).toBeLessThan(100);
    const seen = Object.values(player.state().items).reduce((sum, r) => sum + r.seen, 0);
    expect(view.grownUps.answers, 'every practice of an item, boards too').toBe(seen);
    expect(view.grownUps.answers).toBeGreaterThan(player.served.length);
  });
});
