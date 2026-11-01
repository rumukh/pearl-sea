/**
 * A save from state version 1, restored after hints took their examples from other words
 * (docs/contract.md §5.3, §7.6). In version 1 a `family` or `test-word` hint named the asked word
 * itself and `listed` was the rhyme that lists it; read with version 2's meaning, the shell would
 * show them as examples ("třeba dub → duby") and give the answer away. A round saved with such a
 * problem on screen is upgraded on load: those hints are cleared, every other hint and everything
 * else stays, and the round plays on. The shell's save path upgrades it the same way.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRuntimeHost } from '@aegis/runtime';
import type { RuntimeSnapshot } from '@aegis/runtime';
import { SAVE_MIGRATIONS } from '../../src/app/game/definition';
import { pearlSeaAdapter } from '../../src/rules/adapter';
import { RUNTIME_STATE_RESOURCE, STATE_VERSION, migrateSnapshot } from '../../src/rules/contract';
import type { Hint, ProfileState, ProblemRound } from '../../src/rules/contract';
import { lagoonPack } from '../fixtures/rules/packs';
import { PERFECT, Player } from '../traces/support';

vi.setConfig({ testTimeout: 300_000 });

const pack = lagoonPack();
const SEED = 'state-version-2';

/** Version 1's hints of the asked word itself, one of each kind. */
const STALE: Hint[] = [
  { kind: 'test-word', word: 'hrad', test: 'hrady' },
  { kind: 'family', word: 'hrad', related: 'hrad' },
  { kind: 'listed', letter: 'b' },
];

/** A child's save with a Krmení problem on screen, made by the current rules. */
async function saveMidProblem(): Promise<{ player: Player; snapshot: RuntimeSnapshot }> {
  const player = new Player(PERFECT, SEED, undefined, pack);
  let snapshot: RuntimeSnapshot | null = null;
  player.host.subscribeCommits((commit) => {
    snapshot = commit.snapshot;
  });
  await player.act({ type: 'startSession', day: '2026-11-02' });
  await player.choose(null);
  await player.settleStory();
  await player.act({ type: 'chooseFirstFriend', friend: 'krab-tvrdak' });
  await player.act({ type: 'startLevel', level: 'sunny-lagoon.1' });
  await player.settleStory();
  await player.playRound();
  await player.act({ type: 'endRound', reason: 'done' });
  await player.act({ type: 'startActivity', activity: { kind: 'level', index: 1 } });
  await player.playRound();
  await player.act({ type: 'endRound', reason: 'done' });
  await player.act({ type: 'startActivity', activity: { kind: 'level', index: 2 } });
  await player.answer();
  expect(player.failures).toEqual([]);
  return { player, snapshot: snapshot! };
}

const stateOf = (snapshot: RuntimeSnapshot) =>
  snapshot.world.resources[RUNTIME_STATE_RESOURCE] as ProfileState;
const roundOf = (state: ProfileState) => state.round as ProblemRound;

describe('a save from state version 1', () => {
  it('is upgraded to version 2: the problem on screen loses the hints that named its word', async () => {
    expect(STATE_VERSION).toBe(2);
    const { player, snapshot } = await saveMidProblem();
    const state = structuredClone(stateOf(snapshot));
    const problem = roundOf(state).current!.problem;
    expect(problem.kind, 'Krmení asks gaps').toBe('gaps');
    if (problem.kind !== 'gaps') return;
    // The saved problem as version 1 wrote it: a stale hint on the first gap; a rule line, which
    // kept its meaning, on a second one if there is one.
    const kept: Hint = { kind: 'rule', rule: 'tvrda' };
    problem.gaps[0]!.hint = STALE[0]!;
    if (problem.gaps[1]) problem.gaps[1].hint = kept;
    const old = {
      ...snapshot,
      stateVersion: 1,
      world: {
        ...snapshot.world,
        resources: { ...snapshot.world.resources, [RUNTIME_STATE_RESOURCE]: state },
      },
    } as RuntimeSnapshot;
    const before = structuredClone(old);

    // The runtime refuses the old version as it is.
    const refusing = createRuntimeHost({ adapter: pearlSeaAdapter, content: pack, seed: SEED });
    expect((await refusing.restore(old)).ok).toBe(false);
    await refusing.dispose();

    const migrated = migrateSnapshot(old);
    expect(old, 'the save is not mutated').toEqual(before);
    expect(migrated.stateVersion).toBe(2);
    const upgraded = stateOf(migrated);
    const onScreen = roundOf(upgraded).current!.problem;
    expect(onScreen.kind === 'gaps' && onScreen.gaps[0]!.hint).toBeNull();
    if (problem.gaps[1]) expect(onScreen.kind === 'gaps' && onScreen.gaps[1]!.hint).toEqual(kept);
    // Nothing else changes: the rest of the problem, the round, the child's progress.
    const cleared = structuredClone(state);
    const clearedProblem = roundOf(cleared).current!.problem;
    if (clearedProblem.kind === 'gaps') clearedProblem.gaps[0]!.hint = null;
    expect(upgraded).toEqual(cleared);
    expect({ ...migrated, world: null }).toEqual({ ...old, stateVersion: 2, world: null });
    expect(migrateSnapshot(migrated), 'a current save is returned as it is').toBe(migrated);

    // The shell's save path upgrades it the same way (one step per older version).
    expect(SAVE_MIGRATIONS.map(({ from, to }) => [from, to])).toEqual([[1, 2]]);
    expect(SAVE_MIGRATIONS[0]!.migrate?.(old)).toEqual(migrated);

    // It restores in a new process, shows no hint on that gap, and the round plays on.
    const restored = new Player(PERFECT, SEED, undefined, pack);
    const outcome = await restored.host.restore(migrated);
    expect(outcome.ok, outcome.ok ? '' : JSON.stringify(outcome.error)).toBe(true);
    const shown = restored.host.getView().round;
    const view = shown?.type === 'problems' ? shown.problem : null;
    expect(view?.problem.kind === 'gaps' && view.problem.gaps[0]!.hint).toBeNull();
    restored.answered = player.answered;
    restored.turn = player.turn;
    for (let i = 0; i < 4; i++) await restored.answer();
    expect(restored.failures).toEqual([]);
    await Promise.all([player.dispose(), restored.dispose()]);
  });

  it('loses every stale hint kind wherever version 1 put one: a gap, a fix, an odd set', () => {
    const base = {
      settings: { grade: 3 },
      coins: 7,
      round: { type: 'problems', id: 'r1', current: { index: 1, item: 'x', problem: null } },
    };
    const v1 = (problem: unknown) => ({
      ...base,
      round: { ...base.round, current: { ...base.round.current, problem } },
    });
    const migrate = (problem: unknown) =>
      (
        migrateSnapshot({
          stateVersion: 1,
          world: { resources: { [RUNTIME_STATE_RESOURCE]: v1(problem) } },
        } as unknown as RuntimeSnapshot).world.resources[RUNTIME_STATE_RESOURCE] as {
          round: { current: { problem: unknown } };
        }
      ).round.current.problem;
    const notListed: Hint = { kind: 'not-listed', word: 'biilyy', span: [1, 2] };
    for (const stale of STALE) {
      expect(migrate({ kind: 'gaps', gaps: [{ hint: stale }, { hint: notListed }] })).toEqual({
        kind: 'gaps',
        gaps: [{ hint: null }, { hint: notListed }],
      });
      expect(migrate({ kind: 'mistake', fix: { hint: stale }, wrong: 2 })).toEqual({
        kind: 'mistake',
        fix: { hint: null },
        wrong: 2,
      });
      expect(migrate({ kind: 'odd', hint: stale, correct: 1 })).toEqual({
        kind: 'odd',
        hint: null,
        correct: 1,
      });
    }
    // The hints that kept their meaning stay.
    for (const hint of [
      { kind: 'rule', rule: 'vyjm' },
      { kind: 'ten-ta-to', gender: 'f' },
      { kind: 'method', method: 'case' },
      notListed,
    ]) {
      expect(migrate({ kind: 'classify', hint })).toEqual({ kind: 'classify', hint });
    }
    // No problem on screen: the state is copied as it is.
    for (const round of [null, { type: 'minigame', id: 'r2' }, { ...base.round, current: null }]) {
      const state = { ...base, round };
      const migrated = migrateSnapshot({
        stateVersion: 1,
        world: { resources: { [RUNTIME_STATE_RESOURCE]: state } },
      } as unknown as RuntimeSnapshot).world.resources[RUNTIME_STATE_RESOURCE];
      expect(migrated).toEqual(state);
    }
  });
});
