/**
 * Závod s delfíny (design §5.14): it opens with Murena freed (and only while the grown-ups leave it
 * on), asks known items one gap at a time on the letter pad at least, never re-asks or teaches,
 * ends on the shell's `time-up`, and keeps the child's best score.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RuntimeSnapshot } from '@aegis/runtime';
import type { Problem, ProblemRoundView } from '../../../src/rules/contract';
import { LAGOON_LESSONS, playerFrom, saveAfter } from './saves';

vi.setConfig({ testTimeout: 120_000 });

let afterMurena: RuntimeSnapshot;
beforeAll(async () => {
  afterMurena = await saveAfter([...LAGOON_LESSONS, 'sunny-lagoon.monster']);
});

describe('the race', () => {
  it('asks known items one gap at a time on the letter pad and keeps the best score', async () => {
    const player = await playerFrom(afterMurena, {
      right: (n) => n % 4 !== 0,
      elapsedMs: () => 1500,
      clumsy: false,
    });
    expect(player.view().hub.race.available).toBe(true);
    await player.act({ type: 'startActivity', activity: { kind: 'race' } });
    for (let n = 0; n < 12; n++) {
      const round = player.view().round as ProblemRoundView;
      const problem = round.problem!.problem as Problem;
      expect(round.problem!.input === 'letters' || round.problem!.input === 'typed').toBe(true);
      expect(problem.kind === 'gaps' ? problem.gaps.length : 1).toBe(1);
      expect(player.state().items[round.problem!.item]?.correct ?? 0).toBeGreaterThan(0);
      await player.answer();
    }
    expect(player.count('reask.scheduled'), 'no re-asks in the race').toBe(0);
    expect(player.served.every((s) => !s.teach)).toBe(true);
    await player.act({ type: 'endRound', reason: 'time-up' });
    const finished = player.data_('race.finished') as { score: number; best: number }[];
    expect(finished).toHaveLength(1);
    expect(finished[0]!.score).toBe(player.served.filter((s) => s.right).length);
    expect(player.view().hub.race.best).toBe(finished[0]!.score);
    await player.dispose();
  });

  it('stays closed while the grown-ups switch it off', async () => {
    const player = await playerFrom(afterMurena);
    await player.act({ type: 'setSetting', setting: { key: 'race', value: false } });
    expect(player.view().hub.race.available).toBe(false);
    expect(
      await player.reject({ type: 'startActivity', activity: { kind: 'race' } }, 'race-locked'),
    ).toBe(true);
    await player.dispose();
  });
});
