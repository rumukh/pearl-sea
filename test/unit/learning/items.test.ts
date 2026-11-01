/**
 * Spaced retrieval for one item (src/rules/learning/items.ts and credit.ts) against
 * docs/design.md §6.2 and §6.5 and docs/contract.md §5.4: response buckets per input (choice,
 * letter pad, typing with its per-letter allowance, a sentence's reading time), the Leitner moves
 * and due days, pearls by the box and by effort days, `atLeast`, due items, the pearls polished
 * today and the events that crediting emits. The limits are read from the lagoon fixture's
 * balance, which carries the design's starting values (checked first); records are built by hand.
 */
import { describe, expect, it } from 'vitest';
import { EVENTS, initialProfileState } from '../../../src/rules/contract';
import type {
  Balance,
  ItemState,
  MasteryLevel,
  ProfileState,
  ResolvedInputMode,
  ResponseBucket,
} from '../../../src/rules/contract';
import { creditItem } from '../../../src/rules/learning/credit';
import {
  MASTERY_RANK,
  atLeast,
  boxLevel,
  effortLevel,
  isDue,
  letterCount,
  masteryLevel,
  polishedToday,
  responseBucket,
  updateItem,
  worseBucket,
} from '../../../src/rules/learning/items';
import type { Ctx } from '../../../src/rules/types';
import { lagoonPack } from '../../fixtures/rules/packs';

const data = lagoonPack().data;
const balance = data.balance;
const DAY = 20_000;
const INPUTS: readonly ResolvedInputMode[] = ['choice', 'letters', 'typed'];

/** The balance without the effort path (as a pack that does not ship it). */
function withoutEffort(): Balance {
  const plain: Balance = JSON.parse(JSON.stringify(balance));
  delete plain.mastery.effort;
  return plain;
}

/** An item record; the fields a test does not name are those of an item seen a few times. */
function record(patch: Partial<ItemState> = {}): ItemState {
  return {
    box: 0,
    due: DAY,
    seen: 6,
    correct: 6,
    recent: ['slow', 'slow', 'slow'],
    lastDay: DAY,
    ...patch,
  };
}

/** The record after answers with `bucket` on each of the given days (offsets from `DAY`). */
function answered(days: readonly number[], bucket: ResponseBucket, rules: Balance = balance) {
  let item: ItemState | undefined;
  for (const day of days) item = updateItem(item, bucket, DAY + day, rules);
  return item!;
}

describe('the fixture balance', () => {
  it('carries the starting values of design §6.2 and §6.5 (contract §7.3)', () => {
    expect(balance.response).toEqual({
      choice: { fastMs: 2500, okMs: 6000 },
      letters: { fastMs: 3500, okMs: 8000 },
      typed: { fastMs: 5000, okMs: 12000, perExtraLetterMs: 1000 },
      perSentenceWordMs: 1000,
    });
    expect(balance.leitner.intervals).toEqual([0, 1, 2, 4, 8, 16]);
    expect(balance.mastery).toEqual({
      goldBox: 5,
      goldFast: 2,
      goldOfLast: 3,
      effort: { bronzeDays: 2, silverDays: 4, gapDays: 2 },
    });
  });
});

describe('response buckets (design §6.2)', () => {
  /** The bucket of a right answer `elapsed` ms after the step was shown. */
  const bucket = (elapsed: number, input: ResolvedInputMode, letters = 1, allowance = 0) =>
    responseBucket(true, elapsed, input, letters, balance, allowance);

  it('sort a right choice by 2.5 s and 6 s, both limits inclusive', () => {
    const { fastMs, okMs } = balance.response.choice;
    expect([0, fastMs, fastMs + 1, okMs, okMs + 1].map((ms) => bucket(ms, 'choice'))).toEqual([
      'fast',
      'fast',
      'ok',
      'ok',
      'slow',
    ]);
  });

  it('sort the letter pad by 3.5 s and 8 s, however many letters the answer has', () => {
    const { fastMs, okMs } = balance.response.letters;
    for (const letters of [1, 3, 9]) {
      expect(
        [fastMs, fastMs + 1, okMs, okMs + 1].map((ms) => bucket(ms, 'letters', letters)),
        `${letters} letters`,
      ).toEqual(['fast', 'ok', 'ok', 'slow']);
    }
    // The letter count is the typing allowance's alone: choice ignores it too.
    expect(bucket(balance.response.choice.fastMs + 1, 'choice', 9)).toBe('ok');
  });

  it('give typing 5 s and 12 s plus 1 s per letter after the first', () => {
    const { fastMs, okMs, perExtraLetterMs } = balance.response.typed;
    for (const answer of ['ý', 'mně', 'odplavala']) {
      const extra = (letterCount(answer) - 1) * perExtraLetterMs;
      const letters = letterCount(answer);
      expect(
        [fastMs + extra, fastMs + extra + 1, okMs + extra, okMs + extra + 1].map((ms) =>
          bucket(ms, 'typed', letters),
        ),
        answer,
      ).toEqual(['fast', 'ok', 'ok', 'slow']);
    }
    expect(bucket(fastMs, 'typed', 0), 'an empty count adds nothing').toBe('fast');
    expect(bucket(fastMs + 1, 'typed', 0)).toBe('ok');
  });

  it("add a sentence's words × 1 s to both limits, whatever the input", () => {
    const words = 6;
    const allowance = words * balance.response.perSentenceWordMs;
    for (const input of INPUTS) {
      const { fastMs, okMs } = balance.response[input];
      expect(
        [fastMs, fastMs + 1, okMs, okMs + 1].map((ms) =>
          bucket(ms + allowance, input, 1, allowance),
        ),
        input,
      ).toEqual(['fast', 'ok', 'ok', 'slow']);
      expect(bucket(okMs + 1, input), 'slow without the sentence').toBe('slow');
      expect(bucket(okMs + 1, input, 1, allowance), 'not slow with it').not.toBe('slow');
    }
  });

  it('make every wrong answer a miss, however fast', () => {
    for (const input of INPUTS) {
      for (const ms of [0, 1000, 60_000]) {
        expect(responseBucket(false, ms, input, 1, balance, 5000)).toBe('miss');
      }
    }
  });

  it('count letters as code points of the NFC text', () => {
    expect(letterCount('ý')).toBe(1);
    expect(letterCount('y\u0301'), 'a decomposed ý is one letter').toBe(1);
    expect(letterCount('mně')).toBe(3);
    expect(letterCount('od plavala')).toBe(10);
    expect(letterCount('')).toBe(0);
  });

  it('take the worse of two steps, a miss worst', () => {
    const order: readonly ResponseBucket[] = ['fast', 'ok', 'slow', 'miss'];
    for (const [i, a] of order.entries()) {
      for (const [j, b] of order.entries()) {
        expect(worseBucket(a, b), `${a} ${b}`).toBe(order[Math.max(i, j)]);
      }
    }
  });
});

describe('Leitner boxes (design §6.2)', () => {
  const intervals = balance.leitner.intervals;
  const at = (box: number): ItemState =>
    record({ box, recent: ['ok'], seen: 4, correct: 3, lastDay: DAY - 1 });

  it('move a right fast or ok answer up one box, at most to box 5', () => {
    for (let box = 0; box <= 5; box++) {
      for (const bucket of ['fast', 'ok'] as const) {
        const up = Math.min(5, box + 1);
        expect(updateItem(at(box), bucket, DAY, balance), `box ${box} ${bucket}`).toMatchObject({
          box: up,
          due: DAY + intervals[up]!,
        });
      }
    }
  });

  it('keep a right but slow answer in its box', () => {
    for (let box = 0; box <= 5; box++) {
      expect(updateItem(at(box), 'slow', DAY, balance), `box ${box}`).toMatchObject({
        box,
        due: DAY + intervals[box]!,
      });
    }
  });

  it('send a miss back to box 1 from any box', () => {
    for (let box = 0; box <= 5; box++) {
      expect(updateItem(at(box), 'miss', DAY, balance), `box ${box}`).toMatchObject({
        box: 1,
        due: DAY + intervals[1]!,
      });
    }
    expect(updateItem(undefined, 'miss', DAY, balance).box, 'a new item missed').toBe(1);
  });

  it('start a new item in box 0 and count every answer, keeping the last three buckets', () => {
    expect(updateItem(undefined, 'fast', DAY, balance)).toMatchObject({
      box: 1,
      seen: 1,
      correct: 1,
      recent: ['fast'],
      lastDay: DAY,
    });
    let item = updateItem(undefined, 'slow', DAY, balance);
    expect(item).toMatchObject({ box: 0, due: DAY, seen: 1, correct: 1 });
    for (const [day, bucket] of [
      [1, 'miss'],
      [2, 'ok'],
      [3, 'fast'],
    ] as const) {
      item = updateItem(item, bucket, DAY + day, balance);
    }
    expect(item).toMatchObject({
      box: 3,
      seen: 4,
      correct: 3,
      recent: ['miss', 'ok', 'fast'],
      lastDay: DAY + 3,
      due: DAY + 3 + intervals[3]!,
    });
  });

  it('make an item due 0, 1, 2, 4, 8, 16 days after it reached box 0 … 5', () => {
    expect(intervals).toEqual([0, 1, 2, 4, 8, 16]);
    for (let box = 0; box <= 5; box++) {
      const reached =
        box === 0
          ? updateItem(undefined, 'slow', DAY, balance)
          : updateItem(at(box - 1), 'ok', DAY, balance);
      expect(reached.box).toBe(box);
      const wait = intervals[box]!;
      expect(isDue(reached, DAY), `box ${box}: never again the same day`).toBe(false);
      if (wait > 1) expect(isDue(reached, DAY + wait - 1), `box ${box}: early`).toBe(false);
      expect(isDue(reached, DAY + Math.max(1, wait)), `box ${box}: on time`).toBe(true);
      expect(isDue(reached, DAY + wait + 30), `box ${box}: late`).toBe(true);
    }
  });

  it('never make an item due before it was answered right', () => {
    const missed = updateItem(undefined, 'miss', DAY, balance);
    expect(missed.correct).toBe(0);
    expect(isDue(missed, DAY + 10)).toBe(false);
    expect(isDue(undefined, DAY)).toBe(false);
    expect(isDue(updateItem(missed, 'miss', DAY + 1, balance), DAY + 20)).toBe(false);
  });
});

describe('pearls by the Leitner box (design §6.5)', () => {
  it('are cloudy at box 0-1, bronze at 2 and silver at 3-4', () => {
    const fluent: ResponseBucket[] = ['fast', 'fast', 'fast'];
    expect(
      [0, 1, 2, 3, 4].map((box) => boxLevel(record({ box, recent: fluent }), balance)),
    ).toEqual(['cloudy', 'cloudy', 'bronze', 'silver', 'silver']);
    expect(boxLevel(undefined, balance)).toBe('cloudy');
  });

  it('are gold at box 5 with 2 fast answers among the last 3, else silver', () => {
    const at5 = (recent: ResponseBucket[]) => boxLevel(record({ box: 5, recent }), balance);
    expect(at5(['fast', 'ok', 'fast'])).toBe('gold');
    expect(at5(['fast', 'fast', 'slow'])).toBe('gold');
    expect(at5(['fast', 'fast'])).toBe('gold');
    expect(at5(['fast', 'ok', 'ok']), 'one fast answer').toBe('silver');
    expect(at5(['ok', 'ok', 'ok']), 'no fast answers').toBe('silver');
    expect(at5(['slow', 'slow', 'slow'])).toBe('silver');
  });
});

describe('pearls by effort days (design §6.5)', () => {
  it('count the first right day at any speed, and a miss never', () => {
    expect(answered([0], 'slow')).toMatchObject({ box: 0, rightDays: 1, lastCountedDay: DAY });
    expect(answered([0], 'fast')).toMatchObject({ box: 1, rightDays: 1, lastCountedDay: DAY });
    const missed = answered([0], 'miss');
    expect(missed.rightDays).toBeUndefined();
    expect(missed.lastCountedDay).toBeUndefined();
  });

  it('count a day only gapDays (2) after the last counted day, not the last right day', () => {
    // Right on days 0, 1, 2, 5 and 6: days 0, 2 and 5 count.
    expect(answered([0, 1, 2, 5, 6], 'slow')).toMatchObject({
      rightDays: 3,
      lastCountedDay: DAY + 5,
      correct: 5,
    });
    expect(answered([0, 0, 0, 2, 2], 'ok').rightDays, 'a day counts once').toBe(2);
  });

  it('keep the counts through a miss and count again after it', () => {
    const counted = answered([0, 2], 'slow');
    const missed = updateItem(counted, 'miss', DAY + 4, balance);
    expect(missed).toMatchObject({ box: 1, rightDays: 2, lastCountedDay: DAY + 2 });
    expect(updateItem(missed, 'slow', DAY + 4, balance).rightDays).toBe(3);
  });

  it('give bronze on 2 counted days and silver on 4, never gold', () => {
    const levels = [0, 1, 2, 3, 4, 5, 40].map((days) =>
      effortLevel(
        days === 0 ? record({ box: 0 }) : record({ rightDays: days, lastCountedDay: DAY }),
        balance,
      ),
    );
    expect(levels).toEqual(['cloudy', 'cloudy', 'bronze', 'bronze', 'silver', 'silver', 'silver']);
    expect(effortLevel(undefined, balance)).toBe('cloudy');
  });

  it('count nothing without the effort path, and a record keeps the counts it has', () => {
    const plain = withoutEffort();
    const item = answered([0, 2, 4], 'slow', plain);
    expect(Object.keys(item).sort()).toEqual([
      'box',
      'correct',
      'due',
      'lastDay',
      'recent',
      'seen',
    ]);
    expect(effortLevel(record({ rightDays: 9, lastCountedDay: DAY }), plain)).toBe('cloudy');
    expect(updateItem(answered([0, 2], 'slow'), 'ok', DAY + 6, plain)).toMatchObject({
      rightDays: 2,
      lastCountedDay: DAY + 2,
    });
  });
});

describe('the pearl the child sees (masteryLevel, atLeast)', () => {
  it('is the better of the box and the effort path; gold only from a fluent box', () => {
    const cases: [ItemState, MasteryLevel, MasteryLevel][] = [
      [record({ box: 1, rightDays: 4, lastCountedDay: DAY }), 'cloudy', 'silver'],
      [record({ box: 0, rightDays: 2, lastCountedDay: DAY }), 'cloudy', 'bronze'],
      [record({ box: 3, rightDays: 2, lastCountedDay: DAY }), 'silver', 'silver'],
      [record({ box: 2, rightDays: 4, lastCountedDay: DAY }), 'bronze', 'silver'],
      [
        record({ box: 5, recent: ['fast', 'fast', 'ok'], rightDays: 4, lastCountedDay: DAY }),
        'gold',
        'gold',
      ],
      [
        record({ box: 5, recent: ['ok', 'ok', 'ok'], rightDays: 40, lastCountedDay: DAY }),
        'silver',
        'silver',
      ],
      [record({ box: 1, rightDays: 40, lastCountedDay: DAY }), 'cloudy', 'silver'],
    ];
    for (const [item, byBox, level] of cases) {
      expect(boxLevel(item, balance), JSON.stringify(item)).toBe(byBox);
      expect(masteryLevel(item, balance), JSON.stringify(item)).toBe(level);
    }
    expect(masteryLevel(undefined, balance)).toBe('cloudy');
  });

  it('is at least `seen` once answered right, and at least a level by its pearl', () => {
    const fresh = record({ box: 0, seen: 2, correct: 0, recent: ['miss', 'miss'] });
    expect(atLeast(undefined, 'seen', balance)).toBe(false);
    expect(atLeast(fresh, 'seen', balance), 'never right').toBe(false);
    const once = record({ box: 1, seen: 1, correct: 1, recent: ['fast'] });
    expect(atLeast(once, 'seen', balance)).toBe(true);
    expect(atLeast(once, 'bronze', balance)).toBe(false);
    const bronze = record({ box: 2, recent: ['ok', 'ok'] });
    const levels = ['seen', 'bronze', 'silver', 'gold'] as const;
    expect(levels.map((level) => atLeast(bronze, level, balance))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    const byEffort = record({ box: 1, rightDays: 4, lastCountedDay: DAY });
    expect(atLeast(byEffort, 'silver', balance)).toBe(true);
    expect(atLeast(byEffort, 'gold', balance), 'gold is fluency').toBe(false);
    expect(atLeast(byEffort, 'silver', withoutEffort())).toBe(false);
    const gold = record({ box: 5, recent: ['fast', 'ok', 'fast'] });
    expect(atLeast(gold, 'gold', balance)).toBe(true);
  });
});

describe('pearls polished today (polishedToday)', () => {
  /** The level the answer raised the item to, worked out from the levels before and after. */
  const rise = (before: ItemState, after: ItemState): MasteryLevel | null => {
    const from = MASTERY_RANK.indexOf(masteryLevel(before, balance));
    const to = MASTERY_RANK.indexOf(masteryLevel(after, balance));
    return to > from ? MASTERY_RANK[to]! : null;
  };
  /** A record last answered `ago` days back, its effort path counted `rightDays` times then. */
  const before = (patch: Partial<ItemState>, ago: number, rightDays: number): ItemState =>
    record({ ...patch, lastDay: DAY - ago, rightDays, lastCountedDay: DAY - ago });
  const cases: [string, ItemState, ResponseBucket, MasteryLevel | null][] = [
    [
      'a promotion into box 2',
      before({ box: 1, recent: ['miss', 'ok', 'miss'], seen: 3, correct: 1 }, 1, 1),
      'ok',
      'bronze',
    ],
    [
      'a promotion into box 3',
      before({ box: 2, recent: ['ok', 'ok'], seen: 2, correct: 2 }, 1, 1),
      'fast',
      'silver',
    ],
    [
      'a fast answer that makes a box-5 pearl gold',
      before({ box: 4, recent: ['ok', 'fast', 'ok'] }, 1, 1),
      'fast',
      'gold',
    ],
    [
      "the effort path's second counted day",
      before({ box: 0, recent: ['slow'], seen: 1, correct: 1 }, 2, 1),
      'slow',
      'bronze',
    ],
    ["the effort path's fourth counted day", before({ box: 0 }, 2, 3), 'slow', 'silver'],
    [
      'a slow answer that keeps a bronze pearl bronze',
      before({ box: 2, recent: ['ok', 'ok'], seen: 2, correct: 2 }, 2, 2),
      'slow',
      null,
    ],
    [
      'a promotion within silver while the effort path reaches bronze',
      before({ box: 3, recent: ['ok'] }, 2, 1),
      'ok',
      null,
    ],
    ['a miss', before({ box: 3, recent: ['ok', 'ok', 'ok'] }, 1, 1), 'miss', null],
  ];

  for (const [name, item, bucket, level] of cases) {
    it(`report ${level ?? 'nothing'} for ${name}`, () => {
      const after = updateItem(item, bucket, DAY, balance);
      expect(rise(item, after), 'the answer raised the level as named').toBe(level);
      expect(polishedToday(after, DAY, balance)).toBe(level);
    });
  }

  it('report nothing for an item answered on another day or never answered right', () => {
    const after = updateItem(
      before({ box: 1, recent: ['ok'], seen: 1, correct: 1 }, 1, 1),
      'ok',
      DAY,
      balance,
    );
    expect(polishedToday(after, DAY, balance)).toBe('bronze');
    expect(polishedToday(after, DAY + 1, balance)).toBe(null);
    expect(polishedToday(undefined, DAY, balance)).toBe(null);
    expect(polishedToday(updateItem(undefined, 'miss', DAY, balance), DAY, balance)).toBe(null);
  });
});

describe('crediting an item (credit.ts)', () => {
  function credit(item: ItemState | undefined, bucket: ResponseBucket) {
    const state: ProfileState = {
      ...initialProfileState({ dailyGoal: 30, race: false }),
      day: DAY,
    };
    if (item !== undefined) state.items['spell:ryba:1'] = item;
    const events: { type: string; data: unknown }[] = [];
    const ctx = {
      state,
      content: { data },
      emit: (type: string, payload: unknown) => events.push({ type, data: payload }),
    } as unknown as Ctx;
    creditItem(ctx, 'spell:ryba:1', bucket);
    return { after: state.items['spell:ryba:1']!, events };
  }

  it('moves the box and reports the promotion and the newly polished pearl', () => {
    const { after, events } = credit(
      record({ box: 1, recent: ['miss'], seen: 2, correct: 1, lastDay: DAY - 1 }),
      'fast',
    );
    expect(after).toMatchObject({ box: 2, due: DAY + 2, lastDay: DAY });
    expect(events).toEqual([
      { type: EVENTS.itemPromoted, data: { item: 'spell:ryba:1', box: 2 } },
      { type: EVENTS.pearlPolished, data: { item: 'spell:ryba:1', level: 'bronze' } },
    ]);
  });

  it('reports a promotion alone when the pearl stays, and nothing for a slow answer or a miss', () => {
    expect(credit(undefined, 'ok').events).toEqual([
      { type: EVENTS.itemPromoted, data: { item: 'spell:ryba:1', box: 1 } },
    ]);
    const silver = record({
      box: 3,
      recent: ['ok'],
      lastDay: DAY - 1,
      rightDays: 4,
      lastCountedDay: DAY - 1,
    });
    expect(credit(silver, 'ok').events.map((e) => e.type)).toEqual([EVENTS.itemPromoted]);
    expect(credit(silver, 'slow').events).toEqual([]);
    expect(credit(silver, 'miss').events, 'a miss is invisible').toEqual([]);
  });

  it('reports a pearl polished on the effort path without a promotion', () => {
    const { after, events } = credit(
      record({
        box: 0,
        recent: ['slow'],
        seen: 1,
        correct: 1,
        lastDay: DAY - 2,
        rightDays: 1,
        lastCountedDay: DAY - 2,
      }),
      'slow',
    );
    expect(after).toMatchObject({ box: 0, rightDays: 2, lastCountedDay: DAY });
    expect(events).toEqual([
      { type: EVENTS.pearlPolished, data: { item: 'spell:ryba:1', level: 'bronze' } },
    ]);
  });
});
