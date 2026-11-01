/**
 * Ukaž, co umíš, the 4th grader's placement check (design §5.16, §9.2): a ladder of steps on the
 * letter pad at least; a passed step places its levels (one star, `placed`, their eggs), never a
 * region's lesson 1 or a monster level; three misses in a row or a failed step end it gently;
 * finishing pays once and marks it done, leaving or playing a level instead marks it skipped
 * (keeping what was placed); a step whose skill this build cannot ask is left out.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ContentData, ProblemRoundView } from '../../../src/rules/contract';
import { lagoonPack, lagoonPackWith } from '../../fixtures/rules/packs';
import { PERFECT, Player } from '../../traces/support';
import type { Style } from '../../traces/support';

vi.setConfig({ testTimeout: 120_000 });

const LADDER = [
  'sunny-lagoon.2',
  'sunny-lagoon.3',
  'sunny-lagoon.4',
  'sunny-lagoon.5',
  'sunny-lagoon.6',
];

async function fourthGrader(style: Style = PERFECT, pack = lagoonPack()): Promise<Player> {
  const player = new Player(style, 'placement', undefined, pack);
  await player.act({ type: 'setSetting', setting: { key: 'grade', value: 4 } });
  await player.begin('zelva-obojka');
  return player;
}

async function takeCheck(player: Player, stopAfter = Infinity): Promise<string[]> {
  const inputs: string[] = [];
  await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
  for (let n = 0; n < 40 && n < stopAfter; n++) {
    const round = player.view().round as ProblemRoundView | null;
    if (round?.status !== 'active' || !round.problem) break;
    inputs.push(round.problem.input);
    await player.answer();
  }
  return inputs;
}

const placed = (player: Player) =>
  (player.data_('placement.completed') as { placed: string[] }[]).flatMap((e) => e.placed);

describe('the placement check', () => {
  it('places every passed step’s levels with one star and their eggs, and pays once', async () => {
    const player = await fourthGrader();
    expect(player.view().hub.next.kind).toBe('placement');
    const inputs = await takeCheck(player);
    expect(inputs).toHaveLength(LADDER.length * 3);
    expect(inputs.every((input) => input === 'letters' || input === 'typed')).toBe(true);
    const round = player.view().round as ProblemRoundView;
    expect(round.placement).toEqual({ step: LADDER.length, steps: LADDER.length, placed: LADDER });
    await player.act({ type: 'endRound', reason: 'done' });
    expect(placed(player)).toEqual(LADDER);
    const state = player.state();
    for (const level of LADDER)
      expect(state.levels[level]).toMatchObject({ stars: 1, placed: true });
    expect(state.levels['sunny-lagoon.1'], 'never a lesson 1').toBeUndefined();
    expect(state.levels['sunny-lagoon.monster'], 'never a monster level').toBeUndefined();
    expect(Object.keys(state.friends).sort()).toEqual([
      'krab-tvrdak',
      'meduzka-mekulka',
      'zelva-obojka',
    ]);
    expect(state.onboarding.placement).toBe('done');
    const paid = (player.data_('coins.earned') as { reason: string }[]).filter(
      (c) => c.reason === 'placement',
    );
    expect(paid).toHaveLength(1);
    expect(state.stickers['sticker.show']).toBeDefined();
    // A rerun (the grown-ups' choice) places nothing new and pays nothing more.
    await takeCheck(player);
    await player.act({ type: 'endRound', reason: 'done' });
    expect(
      (player.data_('coins.earned') as { reason: string }[]).filter(
        (c) => c.reason === 'placement',
      ),
    ).toHaveLength(1);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('stops gently after three misses in a row, keeping the steps passed', async () => {
    const player = await fourthGrader({ ...PERFECT, right: (n) => n <= 3 || n > 6 });
    const inputs = await takeCheck(player);
    // Step 1: three right (passed); step 2: three wrong in a row.
    expect(inputs).toHaveLength(6);
    await player.act({ type: 'endRound', reason: 'done' });
    expect(placed(player)).toEqual(['sunny-lagoon.2']);
    expect(player.state().onboarding.placement).toBe('done');
    await player.dispose();
  });

  it('needs the step’s pass accuracy, floored: two of three is 66 %, below 67 %', async () => {
    const player = await fourthGrader({ ...PERFECT, right: (n) => n !== 3 });
    const inputs = await takeCheck(player);
    expect(inputs).toHaveLength(3);
    await player.act({ type: 'endRound', reason: 'done' });
    expect(placed(player)).toEqual([]);
    await player.dispose();
  });

  it('stops at a failed step', async () => {
    const player = await fourthGrader({ ...PERFECT, right: (n) => n === 1 || n > 3 });
    const inputs = await takeCheck(player);
    expect(inputs).toHaveLength(3);
    await player.act({ type: 'endRound', reason: 'done' });
    expect(placed(player)).toEqual([]);
    await player.dispose();
  });

  it('left early, keeps what was placed and is marked skipped, unpaid', async () => {
    const player = await fourthGrader();
    await takeCheck(player, 4);
    await player.act({ type: 'endRound', reason: 'quit' });
    expect(placed(player)).toEqual(['sunny-lagoon.2']);
    expect(player.state().onboarding.placement).toBe('skipped');
    expect(
      (player.data_('coins.earned') as { reason: string }[]).filter(
        (c) => c.reason === 'placement',
      ),
    ).toHaveLength(0);
    await player.dispose();
  });

  it('is skipped when the child plays a level instead', async () => {
    const player = await fourthGrader();
    await player.act({ type: 'startLevel', level: 'moon-caves.1' });
    expect(player.state().onboarding.placement).toBe('skipped');
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('never places a region’s first lesson or a monster level, whatever a step lists', async () => {
    const greedy = lagoonPackWith((data: ContentData) => {
      data.placement.steps[0]!.levels = [
        'sunny-lagoon.1',
        'sunny-lagoon.2',
        'sunny-lagoon.monster',
      ];
    });
    const player = await fourthGrader(PERFECT, greedy);
    await takeCheck(player);
    await player.act({ type: 'endRound', reason: 'done' });
    expect(placed(player)).toEqual(LADDER);
    expect(player.state().levels['sunny-lagoon.1']).toBeUndefined();
    expect(player.state().levels['sunny-lagoon.monster']).toBeUndefined();
    await player.dispose();
  });

  it('leaves out a step whose skill no problem generator can ask', async () => {
    const boardStep = lagoonPackWith((data: ContentData) => {
      data.placement.steps[1]!.skill = 'sk.lagoon.abc';
    });
    const player = await fourthGrader(PERFECT, boardStep);
    const inputs = await takeCheck(player);
    expect(inputs).toHaveLength(12);
    await player.act({ type: 'endRound', reason: 'done' });
    expect(placed(player)).toEqual(LADDER.filter((level) => level !== 'sunny-lagoon.3'));
    await player.dispose();
  });

  it('is not offered to a 3rd grader, whose ladder is empty', async () => {
    const player = new Player(PERFECT, 'placement');
    await player.begin('krab-tvrdak');
    expect(player.view().hub.next).toEqual({ kind: 'level', level: 'sunny-lagoon.1' });
    expect(
      await player.reject(
        { type: 'startActivity', activity: { kind: 'placement' } },
        'locked-activity',
      ),
    ).toBe(true);
    await player.dispose();
  });
});
