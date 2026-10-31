/**
 * The daily adventure's big button (`hub.next`, design §4.2): new levels in order while the day
 * goes well, the treasure chest as soon as the daily goal is met, Svačinka first on a new day, the
 * next level once a day even after a hard start, a minigame for variety once, and below 70 % of
 * today's answers right a review of the last finished levels instead of anything new, though a
 * level under way always continues; free play when nothing is left.
 */
import { describe, expect, it, vi } from 'vitest';
import type { NextStep } from '../../../src/rules/contract';
import { PERFECT, Player } from '../../traces/support';
import type { Style } from '../../traces/support';

vi.setConfig({ testTimeout: 120_000 });

const HALF: Style = { right: (n) => n % 2 === 0, elapsedMs: () => 4000, clumsy: false };

function tag(next: NextStep): string {
  switch (next.kind) {
    case 'level':
      return `level:${next.level}`;
    case 'minigame':
      return `replay:${next.level}#${next.activity}`;
    case 'snack':
      return 'snack';
    case 'story':
      return `story:${next.beat}`;
    default:
      return next.kind;
  }
}

/** Follow the big button `steps` times (or until free play), noting each step and the goal. */
async function follow(player: Player, steps: number) {
  const seen: { step: string; reached: boolean; activity: string | null }[] = [];
  for (let n = 0; n < steps; n++) {
    const next = player.view().hub.next;
    seen.push({
      step: tag(next),
      reached: player.view().daily?.reached ?? false,
      activity: null,
    });
    if (next.kind === 'level') await player.playLevel(next.level);
    else if (next.kind === 'minigame') {
      await player.act({ type: 'startLevel', level: next.level, activity: next.activity });
      seen.at(-1)!.activity = player.view().round?.activity ?? null;
      await player.playRound();
      await player.act({ type: 'endRound', reason: 'done' });
    } else if (next.kind === 'snack') {
      await player.act({ type: 'startActivity', activity: { kind: 'snack', friend: next.friend } });
      await player.playRound();
      await player.act({ type: 'endRound', reason: 'done' });
      await player.settleStory();
    } else if (next.kind === 'chest') await player.act({ type: 'openChest' });
    else break;
  }
  return seen;
}

describe('a day that goes well', () => {
  it('goes from level to level, opens the chest when the goal is met, and starts the next day with Svačinka', async () => {
    const player = new Player(PERFECT, 'adventure');
    expect(tag(player.view().hub.next)).toBe('first-friend');
    await player.act({ type: 'startSession', day: '2026-11-02' });
    expect(tag(player.view().hub.next)).toBe('story:beat.prologue');
    await player.begin('krab-tvrdak');
    const day = await follow(player, 9);
    const steps = day.map((d) => d.step);
    expect(steps.slice(0, 3)).toEqual([
      'level:sunny-lagoon.1',
      'level:sunny-lagoon.2',
      'level:sunny-lagoon.3',
    ]);
    const chest = steps.indexOf('chest');
    expect(chest, 'the chest once the goal is met').toBeGreaterThan(0);
    expect(day[chest]!.reached).toBe(true);
    expect(
      day.slice(0, chest).every((d) => !d.reached),
      'right when it is met',
    ).toBe(true);
    expect(steps.filter((s) => s === 'chest')).toHaveLength(1);
    expect(steps.slice(chest + 1, chest + 3)).toEqual([
      'level:sunny-lagoon.4',
      'level:sunny-lagoon.5',
    ]);

    await player.act({ type: 'startSession', day: '2026-11-03' });
    await player.settleStory();
    const next = await follow(player, 6);
    expect(next[0]!.step, 'Svačinka first on a new day').toBe('snack');
    expect(next.at(-1)!.step, 'free play when nothing new is left').toBe('free-play');
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});

describe('a hard day', () => {
  it('reviews the last finished levels instead of new ones, but continues a level under way', async () => {
    const player = new Player(HALF, 'adventure');
    await player.begin('krab-tvrdak');
    const day = await follow(player, 4);
    expect(day[0]!.step).toBe('level:sunny-lagoon.1');
    expect(
      day.slice(1).every((d) => d.step.startsWith('replay:sunny-lagoon.1#') || d.step === 'snack'),
      `reviews after a hard first lesson: ${day.map((d) => d.step).join(', ')}`,
    ).toBe(true);
    // A level started from the map stays the suggestion until it is done.
    await player.act({ type: 'startLevel', level: 'sunny-lagoon.2' });
    await player.settleStory();
    await player.act({ type: 'endRound', reason: 'quit' });
    expect(tag(player.view().hub.next)).toBe('level:sunny-lagoon.2');
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('starts the next day with Svačinka, then one new level, then a minigame for variety, then reviews', async () => {
    const player = new Player(HALF, 'adventure');
    await player.begin('krab-tvrdak');
    await player.playLevel('sunny-lagoon.1');
    await player.act({ type: 'startSession', day: '2026-11-03' });
    await player.settleStory();
    const day = await follow(player, 4);
    expect(day.map((d) => d.step).slice(0, 2)).toEqual(['snack', 'level:sunny-lagoon.2']);
    expect(day[2]!.step).toMatch(/^replay:/);
    expect(['pearl-necklace', 'fishing-nets', 'memory-match']).toContain(day[2]!.activity);
    expect(day[3]!.step === 'snack' || day[3]!.step.startsWith('replay:')).toBe(true);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});
