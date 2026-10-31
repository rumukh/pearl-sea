/**
 * State, days and actions. Calendar expectations are written from known dates, not derived from
 * the conversion under test.
 */
import { describe, expect, it } from 'vitest';
import { requireValue } from '@aegis/runtime';
import {
  ACTION_TURNS,
  GROTTO_SPOTS,
  STATE_VERSION,
  dayNumber,
  gameActionSchema,
  initialProfileState,
  isoDay,
  profileStateSchema,
  weekday,
} from '../../../src/rules/contract';

describe('local days', () => {
  it('converts known dates', () => {
    expect(dayNumber('2000-01-01')).toBe(10957);
    expect(dayNumber('2026-10-31')).toBe(20757);
    expect(dayNumber('2024-02-29')).toBe(19782);
    expect(isoDay(20757)).toBe('2026-10-31');
  });

  it('round-trips every day from 2000 to 2100', () => {
    const first = dayNumber('2000-01-01')!;
    const last = dayNumber('2100-12-31')!;
    for (let day = first; day <= last; day++) expect(dayNumber(isoDay(day))).toBe(day);
    expect(last - first + 1).toBe(36890);
  });

  it('rejects text that is not a calendar date', () => {
    for (const text of [
      '2026-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '26-10-06',
      '31.10.2026',
      '1999-12-31',
    ]) {
      expect(dayNumber(text), text).toBeNull();
    }
  });

  it('knows the weekday (Monday = 0): 2026-10-31 is a Saturday', () => {
    expect(weekday(dayNumber('2026-10-31')!)).toBe(5);
    expect(weekday(dayNumber('2026-11-02')!)).toBe(0);
  });
});

describe('profile state', () => {
  it('starts valid and empty, for a 3rd grader unless told otherwise', () => {
    expect(STATE_VERSION).toBe(1);
    const state = initialProfileState({ dailyGoal: 30, race: true });
    expect(requireValue(profileStateSchema.parse(JSON.parse(JSON.stringify(state))))).toEqual(
      state,
    );
    expect(state.day).toBeNull();
    expect(state.coins).toBe(0);
    expect(state.friends).toEqual({});
    expect(state.grotto).toEqual(Array.from({ length: GROTTO_SPOTS }, () => null));
    expect(state.settings.grade).toBe(3);
    expect(initialProfileState({ dailyGoal: 30, race: true, grade: 4 }).settings.grade).toBe(4);
  });

  it('keeps the form of address and the grown-ups’ language out of game state', () => {
    const state = initialProfileState({ dailyGoal: 30, race: true });
    const text = JSON.stringify(state);
    for (const word of ['address', 'boy', 'girl', 'neutral', 'language', 'locale']) {
      expect(text, word).not.toContain(word);
    }
    expect(
      profileStateSchema.parse({ ...state, settings: { ...state.settings, address: 'girl' } }).ok,
    ).toBe(false);
  });

  it('rejects unknown fields and out-of-range values', () => {
    const state = initialProfileState({ dailyGoal: 30, race: true });
    expect(profileStateSchema.parse({ ...state, surprise: 1 }).ok).toBe(false);
    expect(profileStateSchema.parse({ ...state, coins: -1 }).ok).toBe(false);
    expect(profileStateSchema.parse({ ...state, grotto: [null] }).ok).toBe(false);
    expect(
      profileStateSchema.parse({ ...state, settings: { ...state.settings, grade: 5 } }).ok,
    ).toBe(false);
    expect(
      profileStateSchema.parse({
        ...state,
        items: { 'spell:mlyyn:2': { box: 6, due: 0, seen: 1, correct: 1, recent: [], lastDay: 0 } },
      }).ok,
    ).toBe(false);
    expect(
      profileStateSchema.parse({
        ...state,
        items: {
          'spell:mlyyn:2': { box: 5, due: 0, seen: 1, correct: 1, recent: ['fast'], lastDay: 0 },
        },
      }).ok,
    ).toBe(true);
  });
});

describe('actions', () => {
  it('charge a logical turn for answers only', () => {
    const paid = Object.entries(ACTION_TURNS)
      .filter(([, turns]) => turns > 0)
      .map(([type]) => type)
      .sort();
    expect(paid).toEqual(['answer', 'placementAnswer']);
  });

  it('accept well-formed actions and reject malformed ones', () => {
    const ok = (action: unknown) => gameActionSchema.parse(action).ok;
    expect(ok({ type: 'startSession', day: '2026-10-31' })).toBe(true);
    expect(ok({ type: 'chooseFirstFriend', friend: 'krab-tvrdak' })).toBe(true);
    expect(ok({ type: 'answer', value: { kind: 'text', value: 'ý' }, elapsedMs: 2300 })).toBe(true);
    expect(ok({ type: 'answer', value: { kind: 'pick', index: 2 }, elapsedMs: 900 })).toBe(true);
    expect(ok({ type: 'equip', friend: 'krab-tvrdak', slot: 'head', item: null })).toBe(true);
    expect(ok({ type: 'decorate', spot: GROTTO_SPOTS - 1, item: 'coral-arch' })).toBe(true);
    expect(ok({ type: 'setSetting', setting: { key: 'grade', value: 4 } })).toBe(true);
    expect(ok({ type: 'openChest' })).toBe(true);

    expect(ok({ type: 'startSession', day: '31.10.2026' })).toBe(false);
    expect(ok({ type: 'answer', value: { kind: 'text', value: 'ý' } })).toBe(false);
    expect(ok({ type: 'answer', value: { kind: 'number', value: 56 }, elapsedMs: 10 })).toBe(false);
    expect(ok({ type: 'answer', value: { kind: 'text', value: 'ý' }, elapsedMs: -5 })).toBe(false);
    expect(ok({ type: 'equip', friend: 'krab-tvrdak', slot: 'grotto', item: null })).toBe(false);
    expect(ok({ type: 'decorate', spot: GROTTO_SPOTS, item: null })).toBe(false);
    expect(ok({ type: 'setSetting', setting: { key: 'grade', value: 5 } })).toBe(false);
    expect(ok({ type: 'setSetting', setting: { key: 'address', value: 'girl' } })).toBe(false);
    expect(ok({ type: 'launchSubmarine' })).toBe(false);
  });
});
