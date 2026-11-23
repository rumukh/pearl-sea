/**
 * New levels that wait (design §4.2): for tomorrow, once today's new levels reach the grown-ups'
 * limit (three unless they choose; `0` is no limit), and for the school, while a level practises
 * the listed words after a letter a 3rd grader's school has not taught. A level under way and the
 * finished levels never wait. And a child back after a break of `RETURN_AFTER` days gets new
 * levels that day, however the reviews piled up.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LISTED_LETTERS } from '../../../src/rules/contract';
import type { GameView, LevelCard, NextStep, ProfileState } from '../../../src/rules/contract';
import { servableItems } from '../../../src/rules/progression/friends';
import { levelLetters, untaughtLetters } from '../../../src/rules/progression/levels';
import type { Read } from '../../../src/rules/types';
import {
  BACKLOG_LIMIT,
  RETURN_AFTER,
  levelsHeld,
  projectView,
  returning,
} from '../../../src/rules/view';
import { lagoonPack, realPack } from '../../fixtures/rules/packs';
import { PERFECT, Player } from '../../traces/support';
import { playerFrom, saveAfter } from './saves';

vi.setConfig({ testTimeout: 120_000 });

const card = (view: GameView, id: string): LevelCard =>
  view.hub.regions.flatMap((region) => region.levels).find((level) => level.id === id)!;

describe('the daily limit on new levels', () => {
  it('lets three new levels start a day, then the next waits for tomorrow; replays stay free', async () => {
    const player = new Player(PERFECT, 'limit');
    await player.begin('krab-tvrdak');
    for (const level of ['sunny-lagoon.1', 'sunny-lagoon.2', 'sunny-lagoon.3']) {
      await player.playLevel(level);
    }
    expect(player.view().hub.newLevels).toEqual({ today: 3, limit: 3 });
    expect(card(player.view(), 'sunny-lagoon.4').waits).toBe('tomorrow');
    expect(card(player.view(), 'sunny-lagoon.3').waits, 'a finished level').toBeNull();
    expect(
      await player.reject({ type: 'startLevel', level: 'sunny-lagoon.4' }, 'new-levels-done'),
    ).toBe(true);
    await player.playLevel('sunny-lagoon.3');
    expect(player.view().hub.newLevels.today, 'a replay is not new').toBe(3);
    expect(player.view().hub.next.kind).not.toBe('level');

    await player.act({ type: 'startSession', day: '2026-11-03' });
    await player.settleStory();
    expect(player.view().hub.newLevels.today).toBe(0);
    expect(card(player.view(), 'sunny-lagoon.4').waits).toBeNull();
    expect(await player.act({ type: 'startLevel', level: 'sunny-lagoon.4' })).toBe(true);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('follows the grown-ups’ choice, with no limit at 0', async () => {
    const player = new Player(PERFECT, 'limit');
    await player.act({ type: 'setSetting', setting: { key: 'newLevels', value: 1 } });
    await player.begin('krab-tvrdak');
    await player.playLevel('sunny-lagoon.1');
    expect(card(player.view(), 'sunny-lagoon.2').waits).toBe('tomorrow');
    await player.act({ type: 'setSetting', setting: { key: 'newLevels', value: 0 } });
    expect(player.view().hub.newLevels).toEqual({ today: 1, limit: 0 });
    for (const level of ['sunny-lagoon.2', 'sunny-lagoon.3', 'sunny-lagoon.4']) {
      expect(card(player.view(), level).waits, level).toBeNull();
      await player.playLevel(level);
    }
    expect(player.view().hub.newLevels.today).toBe(4);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('never stops a level under way', async () => {
    const player = new Player(PERFECT, 'limit');
    await player.begin('krab-tvrdak');
    await player.playLevel('sunny-lagoon.1');
    await player.act({ type: 'startLevel', level: 'sunny-lagoon.2' });
    await player.settleStory();
    await player.act({ type: 'endRound', reason: 'quit' });
    await player.act({ type: 'setSetting', setting: { key: 'newLevels', value: 1 } });
    expect(card(player.view(), 'sunny-lagoon.2').waits).toBeNull();
    expect(player.view().hub.next).toEqual({ kind: 'level', level: 'sunny-lagoon.2' });
    expect(await player.act({ type: 'startLevel', level: 'sunny-lagoon.2' })).toBe(true);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});

describe('the listed words the school has taught', () => {
  it('are read from each level’s objectives', () => {
    const level = (id: string) => realPack().data.levels.find((l) => l.id === id)!;
    expect(levelLetters(level('sunny-lagoon.4'))).toEqual([]);
    expect(levelLetters(level('coral-reef.1')), 'both-way consonants').toEqual([]);
    expect(levelLetters(level('coral-reef.2'))).toEqual(['b']);
    expect(levelLetters(level('coral-reef.6'))).toEqual(['b', 'l']);
    expect(levelLetters(level('kelp-forest.3'))).toEqual(['p']);
    expect(levelLetters(level('pirate-wreck.monster'))).toEqual(['s', 'v', 'z']);
    expect(levelLetters(level('pearl-bay.1'))).toEqual([...LISTED_LETTERS]);
    expect(levelLetters(level('volcanic-vents.1'))).toEqual([]);
  });

  it('hold a 3rd grader’s new levels with listed words after another letter', async () => {
    const player = new Player(PERFECT, 'school', undefined, realPack());
    await player.act({ type: 'setSetting', setting: { key: 'listedLetters', value: ['l', 'b'] } });
    expect(player.state().settings.listedLetters, 'kept in school order').toEqual(['b', 'l']);
    await player.begin('krab-tvrdak');
    await player.act({
      type: 'setSetting',
      setting: { key: 'unlockAhead', value: ['coral-reef', 'kelp-forest'] },
    });
    expect(card(player.view(), 'coral-reef.4').waits, 'L is taught').toBeNull();
    expect(card(player.view(), 'kelp-forest.1').waits, 'M is not').toBe('school');
    expect(
      await player.reject({ type: 'startLevel', level: 'kelp-forest.1' }, 'school-letters'),
    ).toBe(true);
    await player.act({
      type: 'setSetting',
      setting: { key: 'listedLetters', value: ['b', 'l', 'm'] },
    });
    expect(card(player.view(), 'kelp-forest.1').waits).toBeNull();
    expect(await player.act({ type: 'startLevel', level: 'kelp-forest.1' })).toBe(true);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('never hold a 4th grader, who has learnt them all', () => {
    const third = { settings: { grade: 3, listedLetters: ['b'] } } as unknown as ProfileState;
    expect(untaughtLetters(third)).toEqual(['l', 'm', 'p', 's', 'v', 'z']);
    const fourth = { settings: { grade: 4, listedLetters: ['b'] } } as unknown as ProfileState;
    expect(untaughtLetters(fourth)).toEqual([]);
    const unset = { settings: { grade: 3 } } as unknown as ProfileState;
    expect(untaughtLetters(unset), 'absent: every letter taught').toEqual([]);
  });
});

describe('a return after a break', () => {
  const pack = lagoonPack();
  let base: ProfileState;

  beforeAll(async () => {
    const player = await playerFrom(
      await saveAfter(['sunny-lagoon.1', 'sunny-lagoon.2', 'sunny-lagoon.3']),
    );
    await player.act({ type: 'startSession', day: '2026-11-03' });
    await player.settleStory();
    base = structuredClone(player.state());
    await player.dispose();
  });

  /** `base` on its second day of practice, `gap` days after the last, with the reviews piled up. */
  function back(gap: number): ProfileState {
    const state = structuredClone(base);
    const day = state.day!;
    state.daysPracticed = 2;
    state.history = [
      { day: day - gap, answers: 40, correct: 38, fast: 20 },
      { day, answers: 0, correct: 0, fast: 0 },
    ];
    for (const item of [...servableItems(pack.data)].sort().slice(0, BACKLOG_LIMIT + 1)) {
      state.items[item] = {
        box: 2,
        due: day - 1,
        seen: 2,
        correct: 2,
        recent: ['ok', 'ok'],
        lastDay: day - gap,
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

  it(`brings new levels after ${RETURN_AFTER} days away, however the reviews piled up`, () => {
    const soon = back(RETURN_AFTER - 1);
    expect(returning(soon)).toBe(false);
    expect(levelsHeld(soon, pack.data), 'a weekend away: paced as ever').toBe(true);
    expect(next(soon)).toEqual({ kind: 'snack', friend: null });
    const away = back(RETURN_AFTER);
    expect(returning(away)).toBe(true);
    expect(levelsHeld(away, pack.data)).toBe(false);
    expect(next(away), 'the return opens with something new').toEqual({
      kind: 'level',
      level: 'sunny-lagoon.4',
    });
  });

  it('counts a break longer than the history keeps', () => {
    const state = back(RETURN_AFTER);
    state.history = state.history.slice(-1);
    state.daysPracticed = 9;
    expect(returning(state)).toBe(true);
  });
});
