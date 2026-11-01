/**
 * Reviewing the items only boards train (design §4.2, §6.3, §6.5): the necklace's words, the nets'
 * letters, Pexeso's pairs, the shell's and the family's words. A board threads starving items
 * first (the review guarantee), then the chosen egg's never-right items, then the items waiting
 * for a board (due, or never answered: a board is the only place to meet them). The daily
 * adventure replays a finished board once a day, for variety after a level and on a day without
 * one while its items wait; and while a known item only boards train is starving, a board comes
 * before anything new, at most `STARVING_BOARDS` boards a day.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initialProfileState, isMinigameKind } from '../../../src/rules/contract';
import type { GameView, NextStep, ProfileState } from '../../../src/rules/contract';
import { itemIndex, itemsOf } from '../../../src/rules/learning/index-cache';
import { STARVING_DAYS } from '../../../src/rules/learning/selection';
import { boardFocus } from '../../../src/rules/progression/minigame-rounds';
import { servableItems } from '../../../src/rules/progression/friends';
import type { Read } from '../../../src/rules/types';
import { STARVING_BOARDS, projectView } from '../../../src/rules/view';
import { lagoonPack } from '../../fixtures/rules/packs';
import { playerFrom, saveAfter } from './saves';

vi.setConfig({ testTimeout: 120_000 });

const pack = lagoonPack();
const data = pack.data;
const index = itemIndex(data);
const DAY = 20_000;
/** Lekce 1's nets: the 24 consonant letters, which in the fixture only boards train. */
const NETS = itemsOf(['sk.lagoon.consonants'], index);
const zelva = data.friends.find((f) => f.id === 'zelva-obojka')!;
const zelvaLetters = NETS.filter((item) => itemsOf(zelva.skills, index).includes(item));

/** A child with no friend and nothing answered, on day `DAY`. */
function fresh(): ProfileState {
  const state = initialProfileState({ dailyGoal: 30, race: true });
  state.day = DAY;
  return state;
}

function answered(state: ProfileState, item: string, box: number, due: number): void {
  state.items[item] = { box, due, seen: 4, correct: 4, recent: ['ok', 'ok'], lastDay: due - 1 };
}

describe('what a board threads first (boardFocus)', () => {
  it('threads what it never met, and of what it met only the due items', () => {
    const state = fresh();
    expect(boardFocus(state, data, index, NETS)).toEqual(NETS);
    const [upToDate, due, ...rest] = NETS;
    answered(state, upToDate!, 3, DAY + 5);
    answered(state, due!, 3, DAY);
    expect(boardFocus(state, data, index, NETS)).toEqual([due, ...rest]);
    for (const item of rest) answered(state, item, 3, DAY + 2);
    answered(state, due!, 3, DAY + 1);
    expect(boardFocus(state, data, index, NETS), 'nothing waits').toBeNull();
  });

  it('warms the chosen egg with its never-right items before the waiting ones', () => {
    const state = fresh();
    state.onboarding.firstFriend = zelva.id;
    state.friends[zelva.id] = {
      stage: 'egg',
      obtainedDay: DAY,
      stageDay: DAY,
      outfit: { head: null, eyes: null, neck: null },
    };
    expect(zelvaLetters.length).toBeGreaterThan(3);
    expect(boardFocus(state, data, index, NETS)).toEqual(zelvaLetters);
  });

  it('threads a starving item first, before the egg (the review guarantee)', () => {
    const state = fresh();
    state.onboarding.firstFriend = zelva.id;
    state.friends[zelva.id] = {
      stage: 'egg',
      obtainedDay: DAY,
      stageDay: DAY,
      outfit: { head: null, eyes: null, neck: null },
    };
    const known = NETS.find((item) => !zelvaLetters.includes(item))!;
    answered(state, known, 2, DAY - STARVING_DAYS);
    expect(boardFocus(state, data, index, NETS)).toEqual([known]);
    // A day less overdue is due, not starving: the egg comes first again.
    answered(state, known, 2, DAY - STARVING_DAYS + 1);
    expect(boardFocus(state, data, index, NETS)).toEqual(zelvaLetters);
  });
});

describe('the daily adventure’s boards on a day without a new level', () => {
  /** The child after every level of the fixture, its day under way with no board yet. */
  let base: ProfileState;
  /** The items of the fixture's boards that no problem skill serves, in content order. */
  const boardItems = () => [
    ...new Set(
      data.levels
        .flatMap((level) => level.activities)
        .filter((activity) => isMinigameKind(activity.kind))
        .flatMap((activity) => itemsOf(activity.skills, index))
        .filter((item) => !servableItems(data).has(item)),
    ),
  ];

  beforeAll(async () => {
    const player = await playerFrom(await saveAfter(data.levels.map((level) => level.id)));
    expect(
      player.view().hub.regions.every((r) => r.levels.every((l) => l.status === 'completed')),
    ).toBe(true);
    base = structuredClone(player.state());
    await player.dispose();
  });

  /** A day after `base` on which every item (every board's too) is met and up to date, then `change`d. */
  function scene(change: (state: ProfileState) => void): ProfileState {
    const state = structuredClone(base);
    const day = (state.day ?? 0) + 7;
    state.day = day;
    for (const level of data.levels) {
      for (const activity of level.activities) {
        for (const item of itemsOf(activity.skills, index)) {
          state.items[item] ??= {
            box: 3,
            due: day,
            seen: 2,
            correct: 2,
            recent: ['ok', 'ok'],
            lastDay: day - 1,
          };
        }
      }
    }
    for (const record of Object.values(state.items)) {
      record.due = day + 3;
      record.lastDay = day - 1;
    }
    state.daily = {
      day,
      answers: 12,
      correct: 12,
      fast: 12,
      levels: 0,
      minigames: 0,
      goal: 30,
      quests: [],
      chest: 'locked',
    };
    change(state);
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
  const replays = (step: NextStep, items: readonly string[]) =>
    step.kind === 'minigame' &&
    items.some((item) =>
      itemsOf(
        data.levels.find((l) => l.id === step.level)!.activities[step.activity]!.skills,
        index,
      ).includes(item),
    );

  it('plays freely when no board’s items wait', () => {
    expect(next(scene(() => {}))).toEqual({ kind: 'free-play' });
  });

  it('replays a board whose items the child never met, once a day', () => {
    const unmet = boardItems().slice(0, 3);
    expect(unmet.length).toBe(3);
    const state = scene((s) => unmet.forEach((item) => delete s.items[item]));
    expect(replays(next(state), unmet), JSON.stringify(next(state))).toBe(true);
    state.daily!.minigames = 1;
    expect(next(state), 'the day’s board was played').toEqual({ kind: 'free-play' });
  });

  it('replays a board whose items are due, once a day', () => {
    const due = boardItems().slice(5, 7);
    const state = scene((s) => due.forEach((item) => (s.items[item]!.due = s.day!)));
    expect(replays(next(state), due)).toBe(true);
    state.daily!.minigames = 1;
    expect(next(state)).toEqual({ kind: 'free-play' });
  });

  it('feeds a starving board-only item with boards before anything new, up to STARVING_BOARDS a day', () => {
    const item = boardItems()[9]!;
    const state = scene((s) => {
      s.items[item]!.box = 2;
      s.items[item]!.due = s.day! - STARVING_DAYS;
    });
    for (let played = 1; played < STARVING_BOARDS; played++) {
      state.daily!.minigames = played;
      expect(replays(next(state), [item]), `after ${played} boards`).toBe(true);
    }
    state.daily!.minigames = STARVING_BOARDS;
    expect(next(state), 'never more boards a day than the guarantee asks').toEqual({
      kind: 'free-play',
    });
  });
});
