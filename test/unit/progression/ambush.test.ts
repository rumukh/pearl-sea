/**
 * The Inkoustíci (design §7.4): ambushes come from their own seeded stream, so the same seed and
 * actions bring the same ambushes and an ambush never changes the problems served; they come only
 * after the lagoon's monster, from the third problem of a Krmení, Inkoustová věta, Lov chyb,
 * Určování or Svačinka round, at most one a round, never on a re-ask or a taught problem and never
 * in a battle, the race, the placement check or a board; a right answer splashes the Inkoustík
 * away for a bonus coin, a wrong one lets it swim off with no penalty.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ContentData, ProblemRoundView } from '../../../src/rules/contract';
import { lagoonPackWith } from '../../fixtures/rules/packs';
import type { Player, Served, Style } from '../../traces/support';
import { LAGOON_LESSONS, playerFrom, saveAfter } from './saves';

vi.setConfig({ testTimeout: 180_000 });

const MONSTER = 'sunny-lagoon.monster';
const AMBUSH_ACTIVITIES = ['feeding', 'ink-sentence', 'bug-hunt', 'analysis', 'snack'];
const withChance = (chance: number) =>
  lagoonPackWith((data: ContentData) => {
    data.balance.ambush.chance = chance;
  });
const always = withChance(100);
const never = withChance(0);

/** Mostly right, one slip in five. */
const CHILD: Style = { right: (n) => n % 5 !== 3, elapsedMs: () => 2000, clumsy: false };

/** From the start: the whole lagoon, the battle, the caves' first lesson, a snack the next day. */
async function playAll(pack: typeof always, seed = 'ambush'): Promise<Player> {
  const save = await saveAfter([], { pack, seed });
  const player = await playerFrom(save, CHILD, { pack, seed });
  for (const level of [...LAGOON_LESSONS, MONSTER]) await player.playLevel(level);
  await player.playLevel('moon-caves.1');
  await player.act({ type: 'startSession', day: '2026-11-03' });
  await player.settleStory();
  await player.act({ type: 'startActivity', activity: { kind: 'snack', friend: null } });
  await player.playRound();
  await player.act({ type: 'endRound', reason: 'done' });
  expect(player.failures).toEqual([]);
  return player;
}

const firstSteps = (served: readonly Served[]) => served.filter((s) => s.step === 0);

describe('ambushes', () => {
  let ambushed: Player;
  let calm: Player;
  beforeAll(async () => {
    [ambushed, calm] = await Promise.all([playAll(always), playAll(never)]);
  });

  it('never change the problems served', () => {
    const items = (p: Player) => p.served.map((s) => `${s.round}:${s.index}:${s.step}:${s.item}`);
    expect(items(ambushed)).toEqual(items(calm));
    expect(calm.count('inkoustik.ambushed')).toBe(0);
    expect(ambushed.count('inkoustik.ambushed')).toBeGreaterThan(0);
  });

  it('come only after the lagoon monster, in the right activities, at most one a round', () => {
    const freedAt = ambushed.events.findIndex((e) => e.type === 'monster.freed');
    const firstAmbush = ambushed.events.findIndex((e) => e.type === 'inkoustik.ambushed');
    expect(firstAmbush).toBeGreaterThan(freedAt);
    const hit = firstSteps(ambushed.served).filter((s) => s.ambush !== null);
    expect(hit.every((s) => AMBUSH_ACTIVITIES.includes(s.activity))).toBe(true);
    const perRound = new Map<string, number>();
    for (const s of hit) perRound.set(s.round, (perRound.get(s.round) ?? 0) + 1);
    expect([...perRound.values()].every((n) => n === 1)).toBe(true);
  });

  it('land on the first eligible problem when the chance is certain: the third, not a re-ask or a taught one', () => {
    const rounds = new Map<string, Served[]>();
    const freed = ambushed.served.findIndex((s) => s.activity === 'battle');
    for (const s of firstSteps(ambushed.served).slice(freed)) {
      if (!AMBUSH_ACTIVITIES.includes(s.activity)) continue;
      rounds.set(s.round, [...(rounds.get(s.round) ?? []), s]);
    }
    expect(rounds.size).toBeGreaterThan(0);
    for (const served of rounds.values()) {
      const eligible = served.find((s) => s.index >= 3 && !s.reask && !s.teach);
      const hit = served.find((s) => s.ambush !== null);
      expect(hit?.index).toBe(eligible?.index);
    }
  });

  it('never come in a battle or on a board', () => {
    expect(ambushed.served.filter((s) => s.activity === 'battle').length).toBeGreaterThan(0);
    expect(ambushed.served.some((s) => s.activity === 'battle' && s.ambush !== null)).toBe(false);
    const ambushedItems = ambushed.data_('inkoustik.ambushed') as { item: string }[];
    expect(ambushedItems.every((a) => !/^(abc|pair|seg|fam):/.test(a.item))).toBe(true);
  });

  it('a right answer splashes the Inkoustík away for a bonus coin; a wrong one lets it swim off', () => {
    const hits = firstSteps(ambushed.served).filter((s) => s.ambush !== null);
    const splashed = ambushed.data_('inkoustik.splashed') as { coins: number }[];
    expect(hits.some((s) => s.right)).toBe(true);
    expect(splashed.length).toBe(hits.filter((s) => s.right).length);
    expect(splashed.every((s) => s.coins === 1)).toBe(true);
    expect(ambushed.state().splashed).toBe(splashed.length);
    const bonus = (ambushed.data_('coins.earned') as { reason: string }[]).filter(
      (c) => c.reason === 'ambush',
    );
    expect(bonus.length).toBe(splashed.length);
    // Apart from the bonus coins, both runs earned the same.
    const earned = (p: Player) =>
      (p.data_('coins.earned') as { amount: number; reason: string }[])
        .filter((c) => c.reason !== 'ambush' && c.reason !== 'quest' && c.reason !== 'chest')
        .reduce((sum, c) => sum + c.amount, 0);
    expect(earned(ambushed)).toBe(earned(calm));
  });
});

describe('the ambush feedback', () => {
  it('says which Inkoustík was splashed or swam off', async () => {
    const save = await saveAfter([...LAGOON_LESSONS, MONSTER], { pack: always, seed: 'feedback' });
    const player = await playerFrom(
      save,
      { right: (n) => n !== 3, elapsedMs: () => 2000, clumsy: false },
      {
        pack: always,
        seed: 'feedback',
      },
    );
    await player.act({ type: 'startLevel', level: 'moon-caves.1' });
    await player.settleStory();
    for (let guard = 0; guard < 400; guard++) {
      const round = player.view().round;
      if (round?.type === 'problems' && round.status === 'active') break;
      if (round === null) break;
      if (round.status !== 'active') {
        await player.act({ type: 'endRound', reason: 'done' });
        const run = player.view().run!;
        await player.act({ type: 'startActivity', activity: { kind: 'level', index: run.next } });
      } else await player.playBoard();
    }
    const feedbacks: unknown[] = [];
    for (let guard = 0; guard < 20; guard++) {
      const round = player.view().round as ProblemRoundView | null;
      if (round?.status !== 'active' || !round.problem) break;
      const ambush = round.problem.ambush;
      await player.answer();
      const after = player.view().round as ProblemRoundView;
      if (ambush !== null) feedbacks.push(after.feedback?.ambush);
    }
    expect(feedbacks).toHaveLength(1);
    expect(feedbacks[0]).toMatchObject({ splashed: false });
    expect(player.count('inkoustik.splashed')).toBe(0);
    await player.dispose();
  });
});
