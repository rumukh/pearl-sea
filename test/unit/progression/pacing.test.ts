/**
 * Pacing and Svačinka's aim (design §4.2, §6.3). The daily adventure holds new levels, the day's
 * first too, while recent success is below the band or more than `BACKLOG_LIMIT` items wait for
 * review, and brings one all the same on every `PACE_EVERY`-th day of practice; a level under way
 * always continues. Svačinka serves the likeliest successes first below the mix's success target,
 * not only below the band.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RuntimeSnapshot } from '@aegis/runtime';
import type {
  GameView,
  NextStep,
  ProblemRoundView,
  ProfileState,
} from '../../../src/rules/contract';
import { LOW_SUCCESS, belowTarget, lowSuccess } from '../../../src/rules/learning/selection';
import { servableItems, snackItems } from '../../../src/rules/progression/friends';
import type { Read } from '../../../src/rules/types';
import {
  BACKLOG_LIMIT,
  PACE_EVERY,
  levelsHeld,
  projectView,
  reviewBacklog,
} from '../../../src/rules/view';
import { lagoonPack } from '../../fixtures/rules/packs';
import { playerFrom, saveAfter } from './saves';

vi.setConfig({ testTimeout: 120_000 });

const pack = lagoonPack();
const data = pack.data;
const NEXT = 'sunny-lagoon.4';
const STATE = 'aegis.runtime.state';

let afterThree: RuntimeSnapshot;
/** A perfect child after lessons 1-3, on the next day, its first Svačinka of the day played. */
let base: ProfileState;

beforeAll(async () => {
  afterThree = await saveAfter(['sunny-lagoon.1', 'sunny-lagoon.2', 'sunny-lagoon.3']);
  const player = await playerFrom(afterThree);
  await player.act({ type: 'startSession', day: '2026-11-03' });
  await player.settleStory();
  base = structuredClone(player.state());
  await player.dispose();
});

/**
 * `base` on practice day `practiceDay`, with recent success `success` % (yesterday's 20 answers
 * and today's 10; a multiple of 10), nothing due but `due` servable items, no new level today and
 * today's board replay played (so the next step after a held level is a review).
 */
function scene(options: { success: number; practiceDay: number; due?: number }): ProfileState {
  const state = structuredClone(base);
  const day = state.day!;
  state.daysPracticed = options.practiceDay;
  const today = { day, answers: 10, correct: options.success / 10, fast: 0 };
  state.history = [{ day: day - 1, answers: 20, correct: options.success / 5, fast: 0 }, today];
  state.daily = {
    ...state.daily!,
    answers: 10,
    correct: today.correct,
    levels: 0,
    minigames: 1,
    chest: 'locked',
  };
  for (const record of Object.values(state.items)) {
    record.due = day + 3;
    record.lastDay = day - 1;
  }
  const servable = [...servableItems(data)].sort();
  for (const item of servable.slice(0, options.due ?? 0)) {
    state.items[item] = {
      box: 2,
      due: day,
      seen: 2,
      correct: 2,
      recent: ['ok', 'ok'],
      lastDay: day - 2,
    };
  }
  return state;
}

const next = (state: ProfileState): NextStep =>
  (
    projectView({
      state,
      content: pack,
      revision: pack.revision,
      turn: 0,
    } as unknown as Read) as GameView
  ).hub.next;

describe('pacing: the day’s new levels', () => {
  it('come while the day goes well and the reviews keep up', () => {
    const state = scene({ success: 90, practiceDay: 2, due: 3 });
    expect(levelsHeld(state, data)).toBe(false);
    expect(next(state)).toEqual({ kind: 'level', level: NEXT });
  });

  it('wait while recent success is below the band, except on the first and every third day of practice', () => {
    const low = scene({ success: 60, practiceDay: 2 });
    expect(lowSuccess(low, data)).toBe(true);
    expect(levelsHeld(low, data)).toBe(true);
    expect(next(low).kind, JSON.stringify(next(low))).not.toBe('level');
    const pace = scene({ success: 60, practiceDay: PACE_EVERY });
    expect(levelsHeld(pace, data)).toBe(false);
    expect(next(pace)).toEqual({ kind: 'level', level: NEXT });
    expect(levelsHeld(scene({ success: 60, practiceDay: 2 * PACE_EVERY + 1 }), data)).toBe(true);
    expect(levelsHeld(scene({ success: 60, practiceDay: 2 * PACE_EVERY }), data)).toBe(false);
    // The first day: a 4th grader's first lesson follows the misses of the placement check.
    const first = scene({ success: 60, practiceDay: 1 });
    expect(levelsHeld(first, data), 'the first day of practice').toBe(false);
    expect(next(first)).toEqual({ kind: 'level', level: NEXT });
    // At the band's edge the levels come.
    expect(levelsHeld(scene({ success: LOW_SUCCESS, practiceDay: 2 }), data)).toBe(false);
  });

  it(`wait while more than ${BACKLOG_LIMIT} items are due for review`, () => {
    const piled = scene({ success: 90, practiceDay: 2, due: BACKLOG_LIMIT + 1 });
    expect(reviewBacklog(piled, data)).toBe(BACKLOG_LIMIT + 1);
    expect(levelsHeld(piled, data)).toBe(true);
    expect(next(piled), 'Svačinka reviews them').toEqual({ kind: 'snack', friend: null });
    const kept = scene({ success: 90, practiceDay: 2, due: BACKLOG_LIMIT });
    expect(reviewBacklog(kept, data)).toBe(BACKLOG_LIMIT);
    expect(levelsHeld(kept, data)).toBe(false);
    const pace = scene({ success: 90, practiceDay: PACE_EVERY, due: BACKLOG_LIMIT + 1 });
    expect(next(pace)).toEqual({ kind: 'level', level: NEXT });
  });

  it('never hold a level under way', async () => {
    const player = await playerFrom(afterThree);
    await player.act({ type: 'startSession', day: '2026-11-03' });
    await player.settleStory();
    await player.act({ type: 'startLevel', level: NEXT });
    await player.settleStory();
    await player.act({ type: 'endRound', reason: 'quit' });
    const state = structuredClone(player.state());
    expect(state.run?.level).toBe(NEXT);
    state.daysPracticed = 2;
    const day = state.day!;
    state.history = [{ day, answers: 20, correct: 8, fast: 0 }];
    state.daily = { ...state.daily!, answers: 20, correct: 8 };
    expect(levelsHeld(state, data), 'held for anything new').toBe(true);
    expect(next(state)).toEqual({ kind: 'level', level: NEXT });
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});

describe('Svačinka below the success target', () => {
  /**
   * The save after lessons 1-3 with two of Krab's items due the next day and nothing else:
   * `missed` the more overdue and missed last time, `right` answered right last time; recent
   * success `success` % of yesterday's 20 answers (a multiple of 5).
   */
  function save(success: number): { snapshot: RuntimeSnapshot; missed: string; right: string } {
    const snapshot = structuredClone(afterThree) as unknown as {
      world: { resources: Record<string, ProfileState> };
    };
    const state = snapshot.world.resources[STATE]!;
    const day = state.day!;
    const krab = data.friends.find((f) => f.id === 'krab-tvrdak')!;
    const [missed, right] = snackItems(krab, data).filter(
      (item) => state.items[item] !== undefined,
    );
    for (const record of Object.values(state.items)) record.due = day + 5;
    state.items[missed!] = {
      box: 1,
      due: day - 1,
      seen: 2,
      correct: 1,
      recent: ['ok', 'miss'],
      lastDay: day - 2,
    };
    state.items[right!] = {
      box: 2,
      due: day + 1,
      seen: 2,
      correct: 2,
      recent: ['ok', 'ok'],
      lastDay: day - 2,
    };
    state.history = [
      ...state.history.slice(0, -1),
      { day, answers: 20, correct: success / 5, fast: 0 },
    ];
    return { snapshot: snapshot as unknown as RuntimeSnapshot, missed: missed!, right: right! };
  }

  async function firstServed(success: number) {
    const { snapshot, missed, right } = save(success);
    const player = await playerFrom(snapshot);
    await player.act({ type: 'startSession', day: '2026-11-03' });
    await player.settleStory();
    expect(player.view().hub.next.kind).toBe('snack');
    await player.act({ type: 'startActivity', activity: { kind: 'snack', friend: null } });
    const round = player.view().round as ProblemRoundView;
    const state = player.state();
    const result = { item: round.problem!.item, missed, right, below: belowTarget(state, data) };
    expect(player.failures).toEqual([]);
    await player.dispose();
    return result;
  }

  it('serves the likeliest success first between the band and the target', async () => {
    const between = await firstServed(75);
    expect(between.below).toBe(true);
    expect(between.item, 'answered right last time, not the most overdue miss').toBe(between.right);
  });

  it('serves the most overdue first at the target', async () => {
    const atTarget = await firstServed(data.balance.mix.successTarget + 3);
    expect(atTarget.below).toBe(false);
    expect(atTarget.item).toBe(atTarget.missed);
  });
});
