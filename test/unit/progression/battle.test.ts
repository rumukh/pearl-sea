/**
 * Monster battles (design §7.1, §7.2): the meter washes one blot per right answer and never
 * refills, the kindness cap frees the monster with a flourish even for a child who misses every
 * answer, a harmless blot splashes every `battle.splashEvery` answers, the jokes come at the
 * start, after every 5th right answer and when freed (cycling through the list), a many-armed
 * monster washes arm by arm, a battle mixes in spaced review from outside its region, and the
 * battle view (meter, arms, joke) survives a reload.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RuntimeSnapshot } from '@aegis/runtime';
import { BATTLE_SPARE, jokeIndex } from '../../../src/rules/progression/problems';
import { itemIndex, itemsOf } from '../../../src/rules/learning/index-cache';
import type { ProblemRoundView } from '../../../src/rules/contract';
import { lagoonPack, lagoonPackWith } from '../../fixtures/rules/packs';
import { PERFECT } from '../../traces/support';
import type { Player, Style } from '../../traces/support';
import { LAGOON_LESSONS, playerFrom, saveAfter } from './saves';

vi.setConfig({ testTimeout: 120_000 });

const MONSTER = 'sunny-lagoon.monster';
const pack = lagoonPack();
const murena = pack.data.monsters.find((m) => m.id === 'murena-mumla')!;
const NEVER: Style = { right: () => false, elapsedMs: () => 3000, clumsy: false };

let beforeBattle: RuntimeSnapshot;
beforeAll(async () => {
  beforeBattle = await saveAfter(LAGOON_LESSONS);
});

function battleView(player: Player) {
  const round = player.view().round as ProblemRoundView | null;
  return round?.battle ?? null;
}

describe('which joke a battle tells', () => {
  it('counts jokes told: the first at the start, one per 5 blots while ink is left, one when freed', () => {
    expect([0, 4, 5, 9, 10, 14].map((washed) => jokeIndex(15, washed, false))).toEqual([
      0, 0, 1, 1, 2, 2,
    ]);
    // Freed by the meter: the 15th blot is no 5th-blot joke, the freeing one is the next.
    expect(jokeIndex(15, 15, true)).toBe(3);
    // Freed by the kindness cap after 12 blots, or with none washed at all.
    expect(jokeIndex(15, 12, true)).toBe(3);
    expect(jokeIndex(15, 0, true)).toBe(1);
    expect(jokeIndex(18, 18, true)).toBe(4);
  });
});

describe('a battle for a child who misses every answer', () => {
  it('never refills or washes on a miss, stops at the kindness cap and frees the monster', async () => {
    const player = await playerFrom(beforeBattle, NEVER);
    const coins = player.state().coins;
    const missed = player.count('answer.incorrect');
    await player.act({ type: 'startLevel', level: MONSTER });
    await player.settleStory();
    expect(battleView(player)).toMatchObject({ washed: 0, target: murena.meter, splashes: 0 });
    await player.playRound();
    const round = player.view().round as ProblemRoundView;
    const cap = Math.max(
      pack.data.levels.find((l) => l.id === MONSTER)!.activities[0]!.count,
      murena.meter + BATTLE_SPARE,
    );
    expect(round.status).toBe('complete');
    expect(round.progress.answered).toBe(cap);
    expect(player.count('ink.washed'), 'a miss never washes').toBe(0);
    // Ink splashes every `splashEvery` answer steps (a sentence of two gaps is two steps).
    const steps = player.count('answer.incorrect') - missed;
    expect(steps).toBeGreaterThanOrEqual(cap);
    expect(player.count('ink.splashed')).toBe(
      Math.floor(steps / pack.data.balance.battle.splashEvery),
    );
    // The cap washes the rest off with a flourish: the monster is freed all the same.
    expect(round.battle).toMatchObject({ washed: murena.meter, target: murena.meter });
    await player.act({ type: 'endRound', reason: 'done' });
    await player.settleStory();
    expect(player.data_('monster.freed')).toEqual([{ monster: murena.id }]);
    expect(player.state().monsters[murena.id]).toBeDefined();
    expect(player.state().coins, 'nothing is taken away').toBeGreaterThan(coins);
    expect(player.data_('monster.joked')).toEqual([
      { monster: murena.id, joke: murena.jokes[0] },
      { monster: murena.id, joke: murena.jokes[1] },
    ]);
    await player.dispose();
  });
});

describe('the battle view', () => {
  it('shows the meter, the splashes and the current joke, and redraws them after a reload', async () => {
    const player = await playerFrom(beforeBattle);
    let save: RuntimeSnapshot | null = null;
    player.host.subscribeCommits((commit) => {
      save = commit.snapshot;
    });
    await player.act({ type: 'startLevel', level: MONSTER });
    await player.settleStory();
    expect(battleView(player)).toMatchObject({
      monster: murena.id,
      nameKey: murena.nameKey,
      washed: 0,
      arms: 1,
      armsWashed: 0,
      jokeKey: murena.jokes[0],
    });
    for (let i = 0; i < 5; i++) await player.answer();
    expect(battleView(player)).toMatchObject({ washed: 5, splashes: 1, jokeKey: murena.jokes[1] });
    await player.answer();
    expect(battleView(player)!.jokeKey, 'the bubble goes after the next answer').toBeNull();
    for (let i = 0; i < 4; i++) await player.answer();
    const before = player.view();
    expect(battleView(player)).toMatchObject({ washed: 10, jokeKey: murena.jokes[2] });
    const reloaded = await playerFrom(save!);
    expect(reloaded.view(), 'a reload redraws the same battle').toEqual(before);
    await Promise.all([player.dispose(), reloaded.dispose()]);
  });
});

describe('a many-armed monster', () => {
  it('washes arm by arm: one arm per meter / arms blots', async () => {
    const armed = lagoonPackWith((data) => {
      data.monsters.find((m) => m.id === murena.id)!.arms = 3;
    });
    const save = await saveAfter(LAGOON_LESSONS, { pack: armed });
    const player = await playerFrom(save, PERFECT, { pack: armed });
    await player.act({ type: 'startLevel', level: MONSTER });
    await player.settleStory();
    expect(battleView(player)).toMatchObject({ arms: 3, armsWashed: 0 });
    await player.playRound();
    expect(player.data_('arm.washed')).toEqual([
      { monster: murena.id, arm: 1, arms: 3 },
      { monster: murena.id, arm: 2, arms: 3 },
      { monster: murena.id, arm: 3, arms: 3 },
    ]);
    // Each arm came clean right after its 5th blot.
    const tape = player.events
      .filter((e) => e.type === 'ink.washed' || e.type === 'arm.washed')
      .map((e) =>
        e.type === 'arm.washed' ? 'arm' : String((e.data as { washed: number }).washed),
      );
    expect(tape.filter((t, i) => tape[i + 1] === 'arm')).toEqual(['5', '10', '15']);
    expect(battleView(player)).toMatchObject({ armsWashed: 3, washed: 15 });
    await player.dispose();
  });
});

describe('spaced review in a battle', () => {
  it('mixes in known items from outside the region, about the review share', async () => {
    const afterLagoon = await saveAfter([...LAGOON_LESSONS, MONSTER, 'moon-caves.1']);
    const player = await playerFrom(afterLagoon);
    await player.act({ type: 'startLevel', level: 'moon-caves.monster' });
    await player.settleStory();
    await player.playRound();
    const level = pack.data.levels.find((l) => l.id === 'moon-caves.monster')!;
    const own = new Set(itemsOf(level.activities[0]!.skills, itemIndex(pack.data)));
    const asked = player.served.filter((s) => s.step === 0);
    const review = asked.filter((s) => !own.has(s.item));
    const monster = pack.data.monsters.find((m) => m.id === level.monster)!;
    expect(asked.length).toBeGreaterThan(0);
    expect(review.length, 'some review').toBeGreaterThan(0);
    expect((review.length * 100) / asked.length).toBeLessThanOrEqual(monster.reviewShare + 20);
    expect(review.every((s) => player.state().items[s.item] !== undefined)).toBe(true);
    await player.dispose();
  });
});
