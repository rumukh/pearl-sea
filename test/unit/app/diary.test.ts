/**
 * The diary card on goodbye (docs/design.md §8.6), made from data: today's new pearls (at most
 * five words by name, then "+N"), friends that hatched or grew since the day began, monsters
 * freed today and stickers earned today. Older ones never appear on today's card.
 */
import { describe, expect, it } from 'vitest';
import { DIARY_WORDS, diaryOf } from '../../../src/app/screens/goodbye';
import type { DailyView } from '../../../src/rules/contract';
import { friend, lagoonView } from './game-views';

const TODAY = '2026-10-31';

function daily(learned: string[]): DailyView {
  return {
    day: TODAY,
    goal: 30,
    correct: 12,
    answers: 15,
    reached: false,
    quests: [],
    chest: 'locked',
    week: [false, false, false, false, false, true, false],
    sleepy: false,
    learned: learned.map((text) => ({ word: text, text })),
  };
}

describe('the diary card', () => {
  it('names today’s new pearls, five at most, then how many more', () => {
    const words = ['mlýn', 'slyšet', 'myš', 'brýle', 'pytel', 'výr', 'sýr'];
    const diary = diaryOf(lagoonView({ daily: daily(words) }), {});
    expect(DIARY_WORDS).toBe(5);
    expect(diary.words).toEqual(words.slice(0, 5));
    expect(diary.moreWords).toBe(2);
    expect(diaryOf(lagoonView({ daily: daily(['mlýn']) }), {})).toMatchObject({
      words: ['mlýn'],
      moreWords: 0,
    });
  });

  it('lists the friends that hatched or grew since the day began, never an egg', () => {
    const view = lagoonView({
      friends: [
        friend('krab-tvrdak', { stage: 'baby' }),
        friend('meduzka-mekulka', { stage: 'grown' }),
        friend('zelva-obojka', { stage: 'egg' }),
        friend('konik-skokan', { stage: 'baby' }),
      ],
    });
    const began = {
      'krab-tvrdak': 'egg',
      'meduzka-mekulka': 'grown',
      'zelva-obojka': 'egg',
      'konik-skokan': 'baby',
    };
    expect(diaryOf(view, began).grown).toEqual([{ friend: 'krab-tvrdak', stage: 'baby' }]);
    // A friend that came today (not in the day's record) grew today too.
    expect(diaryOf(view, {}).grown.map((each) => each.friend)).toEqual([
      'krab-tvrdak',
      'meduzka-mekulka',
      'konik-skokan',
    ]);
    // Without the day's record nothing is claimed.
    expect(diaryOf(view, null).grown).toEqual([]);
  });

  it('shows only today’s freed monsters and stickers', () => {
    const view = lagoonView({
      daily: daily([]),
      gallery: {
        monsters: [
          { id: 'murena-mumla', nameKey: 'm', freed: true, day: TODAY },
          { id: 'krab-klepeto', nameKey: 'k', freed: true, day: '2026-10-30' },
          { id: 'chobotnice', nameKey: 'ch', freed: false, day: null },
        ],
      },
      album: {
        pages: [
          {
            region: 'sunny-lagoon',
            stickers: [
              {
                id: 'first-baby',
                nameKey: 's1',
                icon: 'egg',
                color: 'coral',
                frame: 'round',
                earned: true,
                day: TODAY,
              },
              {
                id: 'first-dive',
                nameKey: 's2',
                icon: 'wave',
                color: 'sea',
                frame: 'round',
                earned: true,
                day: '2026-10-29',
              },
              {
                id: 'first-hat',
                nameKey: 's3',
                icon: 'hat',
                color: 'sun',
                frame: 'round',
                earned: false,
                day: null,
              },
            ],
          },
        ],
        earned: 2,
        total: 3,
      },
    });
    const diary = diaryOf(view, {});
    expect(diary.freed).toEqual(['murena-mumla']);
    expect(diary.stickers).toEqual(['first-baby']);
  });
});
