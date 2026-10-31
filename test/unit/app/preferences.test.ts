/**
 * Child preferences: strict validation (they are stored and restored), defaults, and edits
 * that refuse to produce an invalid record.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  isChildPreferences,
  preferencesRecord,
  TEXT_SCALES,
  TIME_LIMITS,
  withPreferences,
} from '../../../src/app/persistence/preferences';
import { PREFERENCES_GAME_ID } from '../../../src/rules/contract';

describe('child preferences', () => {
  it('default to Czech, read-aloud on, auto-read off, 100 % text and no time limit', () => {
    expect(isChildPreferences(DEFAULT_PREFERENCES)).toBe(true);
    expect(DEFAULT_PREFERENCES).toMatchObject({
      readAloud: true,
      autoRead: false,
      voice: null,
      timeLimit: null,
      presentation: { locale: 'cs', textScale: 1, reducedMotion: false },
    });
    // The audio pack's mix is baked into its files, so every bus starts at full scale.
    expect(DEFAULT_PREFERENCES.presentation.volumes).toEqual({
      narration: 1,
      music: 1,
      effects: 1,
    });
  });

  it('accept every offered text size and every offered time limit', () => {
    expect(TEXT_SCALES).toEqual([1, 1.25, 1.5, 2]);
    for (const textScale of TEXT_SCALES) {
      const value = withPreferences(DEFAULT_PREFERENCES, (draft) => {
        draft.presentation = { ...draft.presentation, textScale };
      });
      expect(isChildPreferences(value)).toBe(true);
    }
    for (const timeLimit of TIME_LIMITS) {
      const value = withPreferences(DEFAULT_PREFERENCES, (draft) => {
        draft.timeLimit = timeLimit;
      });
      expect(value.timeLimit).toBe(timeLimit);
    }
  });

  it('reject anything else', () => {
    const base = structuredClone(DEFAULT_PREFERENCES) as unknown as Record<string, unknown>;
    const presentation = base['presentation'] as Record<string, unknown>;
    const bad: unknown[] = [
      null,
      { ...base, extra: true },
      { ...base, notation: 'czech' },
      { ...base, readAloud: 'yes' },
      { ...base, voice: '' },
      { ...base, voice: 'v'.repeat(513) },
      { ...base, timeLimit: 0 },
      { ...base, timeLimit: 4 },
      { ...base, timeLimit: 121 },
      { ...base, timeLimit: 12.5 },
      { ...base, timeLimit: '20' },
      { ...base, presentation: { ...presentation, textScale: 2.5 } },
      { ...base, presentation: { ...presentation, textScale: 0.5 } },
      { ...base, presentation: { ...presentation, locale: 'not a locale' } },
      { ...base, presentation: { ...presentation, extra: 1 } },
      { ...base, presentation: { ...presentation, volumes: { music: 1, effects: 1 } } },
      {
        ...base,
        presentation: { ...presentation, volumes: { narration: 1, music: 2, effects: 1 } },
      },
    ];
    for (const value of bad) expect(isChildPreferences(value), JSON.stringify(value)).toBe(false);
  });

  it('refuse edits that break the record, leaving the original untouched', () => {
    expect(() =>
      withPreferences(DEFAULT_PREFERENCES, (draft) => {
        draft.timeLimit = 1;
      }),
    ).toThrow(RangeError);
    expect(DEFAULT_PREFERENCES.timeLimit).toBeNull();
  });

  it('are stored per child in their own record namespace', () => {
    const record = preferencesRecord('profile-2');
    expect(record).toMatchObject({
      kind: 'preferences',
      gameId: PREFERENCES_GAME_ID,
      profileId: 'profile-2',
      schemaVersion: 1,
    });
    expect(record.isCurrent(DEFAULT_PREFERENCES)).toBe(true);
  });
});
