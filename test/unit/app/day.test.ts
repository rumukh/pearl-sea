/**
 * The day record behind the diary card: exactly a day, the items that shone and the friends'
 * stages when it began; one baseline per day that survives a new page; replaced (never asked
 * about) when it cannot be read.
 */
import { MemorySaveStorage } from '@aegis/browser/save';
import { describe, expect, it } from 'vitest';
import { dayRecord, DayStore, isDayRecord, localDay } from '../../../src/app/persistence/day';
import { recordPolicy } from '../../../src/app/persistence/records';
import { DAY_GAME_ID } from '../../../src/rules/contract';

const MORNING = { lit: ['word:mlyn:vyjm', 'word:byt:vyjm'], stages: { 'krab-tvrdak': 'baby' } };

describe('the day record', () => {
  it('accepts exactly a day, the items that shine and each friend’s stage', () => {
    expect(isDayRecord({ day: '2026-10-31', ...MORNING })).toBe(true);
    expect(isDayRecord({ day: '2026-10-31', lit: [], stages: {} })).toBe(true);
    const bad: unknown[] = [
      null,
      { day: '31. 10. 2026', ...MORNING },
      { day: '2026-10-31', lit: MORNING.lit },
      { day: '2026-10-31', ...MORNING, extra: 1 },
      { day: '2026-10-31', lit: ['word:mlyn:vyjm', 'word:mlyn:vyjm'], stages: {} },
      { day: '2026-10-31', lit: ['Mlýn'], stages: {} },
      { day: '2026-10-31', lit: [], stages: { 'krab-tvrdak': 7 } },
      { day: '2026-10-31', lit: [], stages: { 'Krab Tvrďák': 'baby' } },
    ];
    for (const value of bad) expect(isDayRecord(value), JSON.stringify(value)).toBe(false);
    expect(dayRecord('profile-1')).toMatchObject({ gameId: DAY_GAME_ID, profileId: 'profile-1' });
  });

  it('keeps one baseline per day and finds it again on a new page', async () => {
    const storage = new MemorySaveStorage();
    const store = new DayStore(storage, 'profile-1');
    expect(await store.open()).toBeUndefined();
    let taken = 0;
    const baseline = () => {
      taken += 1;
      return MORNING;
    };
    await store.begin('2026-10-31', baseline);
    await store.begin('2026-10-31', baseline);
    expect(taken, 'the day already has its baseline').toBe(1);
    const again = new DayStore(storage, 'profile-1');
    expect(await again.open()).toEqual({ day: '2026-10-31', ...MORNING });
    await again.begin('2026-11-01', () => ({ lit: [], stages: {} }));
    expect(again.current()).toEqual({ day: '2026-11-01', lit: [], stages: {} });
  });

  it('replaces a record it cannot read instead of asking a grown-up', async () => {
    const storage = new MemorySaveStorage();
    const policy = recordPolicy(dayRecord('profile-1'));
    await storage.compareAndSwap(policy, 0, { revision: 1, payload: '{"broken": true' });
    const store = new DayStore(storage, 'profile-1');
    expect(await store.open()).toBeUndefined();
    expect((await storage.read(policy)).current, 'the unreadable record is gone').toBeUndefined();
    await store.begin('2026-10-31', () => MORNING);
    expect(await new DayStore(storage, 'profile-1').open()).toEqual({
      day: '2026-10-31',
      ...MORNING,
    });
  });

  it('names the local calendar day the way the record stores it', () => {
    const day = (year: number, month: number, date: number) =>
      ({ getFullYear: () => year, getMonth: () => month, getDate: () => date }) as never;
    expect(localDay(day(2026, 9, 31))).toBe('2026-10-31');
    expect(localDay(day(2027, 0, 5))).toBe('2027-01-05');
  });
});
