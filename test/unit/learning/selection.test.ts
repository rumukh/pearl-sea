/**
 * Item selection (src/rules/learning/selection.ts) and "the same word" (item-info.ts `wordKey`)
 * against docs/design.md §6.3: no item comes back within `noRepeatWithin` problems, a word's items
 * counting as one; a sound-alike partner is never served right after the other; the learning share
 * follows recent success within 10-50 %; a known item 4 days past its review is starving and is
 * the first review; review, learning, snack and mixed draws prefer what the design says; the focus
 * egg is the chosen first egg while it is an egg (else the oldest), its never-right items first.
 * States are built by hand on the fixture packs.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { initialProfileState } from '../../../src/rules/contract';
import type {
  ContentData,
  FriendState,
  ItemState,
  ProfileState,
  ResponseBucket,
} from '../../../src/rules/contract';
import { servableIndex } from '../../../src/rules/learning/generate';
import { itemIndex } from '../../../src/rules/learning/index-cache';
import { wordKey } from '../../../src/rules/learning/item-info';
import {
  blockedKeys,
  eggsByAge,
  focusItems,
  learningShare,
  pickLearning,
  pickMixed,
  pickPlacement,
  pickRace,
  pickReview,
  pickSnack,
  starving,
  withoutBlocked,
} from '../../../src/rules/learning/selection';
import { lagoonPack, miniPack } from '../../fixtures/rules/packs';

const lagoon = lagoonPack().data;
const mini = miniPack().data;
const DAY = 20_000;
const WINDOW = lagoon.balance.mix.noRepeatWithin;
const NOTHING: ReadonlySet<string> = new Set();

function state(patch: Partial<ProfileState> = {}): ProfileState {
  return { ...initialProfileState({ dailyGoal: 30, race: false }), day: DAY, ...patch };
}

/** An item answered right before, in `box`, due on `due`, last answered on `lastDay` (`last`). */
function item(box: number, due: number, lastDay = DAY - 1, last: ResponseBucket = 'ok'): ItemState {
  return { box, due, seen: 3, correct: last === 'miss' ? 1 : 2, recent: ['ok', last], lastDay };
}

/** Today's answers, as the last day of the history the mix reads. */
const history = (answers: number, correct: number): Pick<ProfileState, 'history'> => ({
  history: [{ day: DAY, answers, correct, fast: 0 }],
});

const copy = (data: ContentData): ContentData => JSON.parse(JSON.stringify(data));

/** Each word's sound-alike partners, read off the lexicon's pairs. */
function partners(data: ContentData): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const word = (ref: string | { word: string }) => (typeof ref === 'string' ? ref : ref.word);
  for (const [a, b] of data.lexicon.relations.soundAlikes) {
    out.set(`w:${word(a)}`, [...(out.get(`w:${word(a)}`) ?? []), `w:${word(b)}`]);
    out.set(`w:${word(b)}`, [...(out.get(`w:${word(b)}`) ?? []), `w:${word(a)}`]);
  }
  return out;
}

describe('the same word (wordKey)', () => {
  it('names the word, the sentence or the letter an item is about', () => {
    const keys: Record<string, string> = {
      'spell:mlyyn:2': 'w:mlyyn',
      'gap:s.ryby-1:0': 's:s.ryby-1',
      'class:pos:ryba': 'w:ryba',
      'class:case:s.ryby-1:0': 's:s.ryby-1',
      'class:consonant:cx': 'c:cx',
      'class:person:plavat:past1': 'w:plavat',
      'rel:antonym:velkyy': 'w:velkyy',
      'rel:sound-alike:piit:pil': 'w:piit',
      'pair:family:mlynaarx': 'w:mlynaarx',
      'abc:ryba': 'w:ryba',
      'seg:vyletext': 'w:vyletext',
      'fam:mlyyn': 'w:mlyyn',
    };
    for (const [id, key] of Object.entries(keys)) expect(wordKey(mini, id), id).toBe(key);
    const kinds = copy(mini);
    kinds.lexicon.sentences.find((s) => s.id === 's.ryby-1')!.kind = 'statement';
    expect(wordKey(kinds, 'class:sentence-kind:s.ryby-1')).toBe('s:s.ryby-1');
  });

  it("counts a word's spelling points as one word, wherever they are asked", () => {
    expect(wordKey(lagoon, 'spell:diitex:1')).toBe('w:diitex');
    expect(wordKey(lagoon, 'spell:diitex:3')).toBe('w:diitex');
    expect(wordKey(lagoon, 'spell:dyynex:1')).toBe(wordKey(lagoon, 'spell:dyynex:3'));
    expect(wordKey(lagoon, 'spell:texlo:1')).not.toBe(wordKey(lagoon, 'spell:diitex:1'));
    expect(wordKey(lagoon, 'gap:s.deti-1:0')).not.toBe(wordKey(lagoon, 'spell:diitex:1'));
  });
});

describe('no repeats (blockedKeys, withoutBlocked)', () => {
  it('block the words of the last noRepeatWithin (2) items, a word counting once', () => {
    expect(WINDOW).toBe(2);
    const blocked = blockedKeys(
      lagoon,
      ['spell:ryba:1', 'spell:diitex:1', 'gap:s.deti-1:0'],
      WINDOW,
    );
    expect([...blocked].sort()).toEqual(['s:s.deti-1', 'w:diitex']);
    const pool = [
      'spell:diitex:3',
      'spell:diitex:1',
      'gap:s.deti-1:0',
      'spell:ryba:1',
      'spell:texlo:1',
    ];
    expect(withoutBlocked(lagoon, pool, blocked)).toEqual(['spell:ryba:1', 'spell:texlo:1']);
    expect(blockedKeys(lagoon, ['spell:ryba:1', 'spell:texlo:1'], 0).size, 'no window').toBe(0);
  });

  it('fall back to the whole pool rather than serve nothing', () => {
    const blocked = blockedKeys(lagoon, ['spell:diitex:1'], WINDOW);
    expect(withoutBlocked(lagoon, ['spell:diitex:3'], blocked)).toEqual(['spell:diitex:3']);
    expect(withoutBlocked(lagoon, ['spell:ryba:1'], NOTHING)).toEqual(['spell:ryba:1']);
    const random = createPrng('fallback');
    expect(
      pickMixed({
        state: state(),
        data: lagoon,
        pool: ['spell:diitex:3'],
        blocked,
        focus: null,
        random,
      }),
    ).toBe('spell:diitex:3');
  });

  it('block the sound-alike partner of the last item only: být, then never bít', () => {
    expect([...blockedKeys(mini, ['spell:byyt:1'], WINDOW)].sort()).toEqual(['w:biit', 'w:byyt']);
    expect([...blockedKeys(mini, ['spell:biit:1'], 0)]).toEqual(['w:byyt']);
    expect([...blockedKeys(mini, ['spell:byyt:1', 'spell:ryba:1'], WINDOW)].sort()).toEqual([
      'w:byyt',
      'w:ryba',
    ]);
    expect(blockedKeys(mini, [], WINDOW).size).toBe(0);
  });

  it('block a partner that is a form of a word (pyl × pil of pít)', () => {
    const forms = copy(mini);
    forms.lexicon.relations.soundAlikes.push(['pyl', { word: 'piit', form: 'pil' }]);
    expect([...blockedKeys(forms, ['spell:pyl:1'], 0)]).toEqual(['w:piit']);
    expect([...blockedKeys(forms, ['rel:sound-alike:piit:pil'], 0)]).toEqual(['w:pyl']);
  });

  it('keep long mixed, snack, placement and race rounds free of repeats and sound-alikes in a row', () => {
    for (const [name, data] of [
      ['lagoon', lagoon],
      ['mini', mini],
    ] as const) {
      const pool = [...new Set([...servableIndex(data).values()].flat())];
      if (data === mini) pool.push('spell:byyt:1', 'spell:biit:1');
      expect(pool.length, name).toBeGreaterThan(WINDOW + 2);
      // A child with known, due and missed items among new ones.
      const items: Record<string, ItemState> = {};
      pool.forEach((id, i) => {
        if (i % 3 === 0) items[id] = item(2 + (i % 4), DAY - (i % 6), DAY - 7);
        else if (i % 3 === 1) items[id] = item(1, DAY, DAY - 1, 'miss');
      });
      const s = state({ items, ...history(30, 24) });
      const pairs = partners(data);
      type Draw = (
        blocked: ReadonlySet<string>,
        served: string[],
        random: ReturnType<typeof createPrng>,
      ) => string | null;
      const draws: Record<string, Draw> = {
        mixed: (blocked, served, random) =>
          pickMixed({ state: s, data, pool, blocked, served, focus: null, random }),
        snack: (blocked, served, random) =>
          pickSnack({ state: s, data, pool, blocked, served, random }),
        placement: (blocked, served, random) =>
          pickPlacement({ state: s, data, pool, blocked, served, random }),
        race: (blocked, served, random) =>
          pickRace({ state: s, data, pool, blocked, served, random }),
      };
      for (const [draw, pick] of Object.entries(draws)) {
        const random = createPrng(`no-repeat:${name}:${draw}`);
        const served: string[] = [];
        for (let i = 0; i < 200; i++) {
          const next = pick(blockedKeys(data, served, WINDOW), served.slice(-8), random);
          expect(next, `${name} ${draw} ${i}`).not.toBeNull();
          const key = wordKey(data, next!);
          const recent = served.slice(-WINDOW).map((id) => wordKey(data, id));
          expect(recent, `${name} ${draw} ${i}: ${next} again`).not.toContain(key);
          const last = served.at(-1);
          if (last !== undefined) {
            expect(pairs.get(wordKey(data, last)) ?? [], `${name} ${draw} ${i}`).not.toContain(key);
          }
          served.push(next!);
        }
        expect(new Set(served).size, `${name} ${draw}: the draws vary`).toBeGreaterThan(WINDOW + 1);
        if (data === mini && draw === 'mixed') {
          // Not starved by the blocking: at least a quarter of a fair share of the draws.
          for (const id of ['spell:byyt:1', 'spell:biit:1']) {
            expect(served.filter((s) => s === id).length, `${id} is drawn`).toBeGreaterThan(
              served.length / pool.length / 4,
            );
          }
        }
      }
    }
  });
});

describe('the learning share (design §6.3)', () => {
  const mix = lagoon.balance.mix;

  it('starts at 100 - knownShare (30 %) before five answers', () => {
    expect(mix).toMatchObject({
      knownShare: 70,
      successTarget: 82,
      minLearningShare: 10,
      maxLearningShare: 50,
      window: 20,
    });
    expect(learningShare(state(), lagoon)).toBe(100 - mix.knownShare);
    expect(learningShare(state(history(4, 0)), lagoon)).toBe(30);
  });

  it('stays at 30 % on target (82 %) and moves with recent success within 10-50 %', () => {
    expect(learningShare(state(history(17, 14)), lagoon), '14 of 17 is 82 %').toBe(30);
    const shares = Array.from({ length: 21 }, (_, right) =>
      learningShare(state(history(20, right)), lagoon),
    );
    for (const [right, share] of shares.entries()) {
      expect(share, `${right} of 20`).toBeGreaterThanOrEqual(mix.minLearningShare);
      expect(share, `${right} of 20`).toBeLessThanOrEqual(mix.maxLearningShare);
      if (right > 0) expect(share, `${right} of 20`).toBeGreaterThanOrEqual(shares[right - 1]!);
      if (right * 100 > mix.successTarget * 20) expect(share, `${right} of 20`).toBeGreaterThan(30);
      else expect(share, `${right} of 20`).toBeLessThan(30);
    }
    expect(shares[20], 'all right: 30 + (100 - 82)').toBe(48);
    expect(shares[10], 'half right').toBe(mix.minLearningShare);
  });

  it('is held at 50 % when success would push it higher', () => {
    const generous = copy(lagoon);
    generous.balance.mix.knownShare = 60;
    expect(learningShare(state(history(20, 20)), generous)).toBe(mix.maxLearningShare);
  });

  it('reads the last 20 answers across days, the latest last, and a part window in part', () => {
    const days = (older: [number, number], today: [number, number]) =>
      state({
        history: [
          { day: DAY - 1, answers: older[0], correct: older[1], fast: 0 },
          { day: DAY, answers: today[0], correct: today[1], fast: 0 },
        ],
      });
    expect(learningShare(days([20, 0], [20, 20]), lagoon), 'only today counts').toBe(48);
    expect(learningShare(days([10, 10], [10, 0]), lagoon), 'half of each day').toBe(10);
    // 10 of 10 right: (100 - 82) × 10 / 20 = 9 points.
    expect(learningShare(state(history(10, 10)), lagoon)).toBe(39);
  });
});

describe('the review guarantee (starving)', () => {
  it('is a known item (box 2+) waiting 4 or more days past its review day', () => {
    expect(starving(item(2, DAY - 4, DAY - 6), DAY)).toBe(true);
    expect(starving(item(5, DAY - 30, DAY - 46), DAY)).toBe(true);
    expect(starving(item(2, DAY - 3, DAY - 5), DAY), '3 days late').toBe(false);
    expect(starving(item(1, DAY - 10, DAY - 11, 'miss'), DAY), 'not known').toBe(false);
    expect(starving(item(3, DAY - 4, DAY), DAY), 'practised today').toBe(false);
    expect(starving({ ...item(2, DAY - 9), correct: 0 }, DAY), 'never right').toBe(false);
    expect(starving(undefined, DAY)).toBe(false);
  });

  it('is the first review, before more overdue items and while success is protected', () => {
    const s = state({
      items: {
        'spell:ryba:1': item(2, DAY - 4, DAY - 6),
        'spell:chyba:2': item(1, DAY - 9, DAY - 10, 'miss'),
        'spell:kytara:1': item(3, DAY - 2, DAY - 6),
      },
    });
    const due = ['spell:chyba:2', 'spell:kytara:1', 'spell:ryba:1'];
    for (const likelyFirst of [false, true]) {
      for (let i = 0; i < 10; i++) {
        expect(pickReview(s, due, createPrng(`starving:${i}`), likelyFirst)).toBe('spell:ryba:1');
      }
    }
    expect(pickReview(s, [], createPrng('empty'), false)).toBeNull();
  });

  it('else reviews the most overdue item, or the likeliest success while success is protected', () => {
    const s = state({
      items: {
        'spell:chyba:2': item(1, DAY - 3, DAY - 4, 'miss'),
        'spell:kytara:1': item(3, DAY - 1, DAY - 5),
        'spell:ryba:1': item(2, DAY - 1, DAY - 3),
      },
    });
    const due = ['spell:chyba:2', 'spell:kytara:1', 'spell:ryba:1'];
    for (let i = 0; i < 10; i++) {
      expect(pickReview(s, due, createPrng(`review:${i}`), false)).toBe('spell:chyba:2');
      expect(pickReview(s, due, createPrng(`review:${i}`), true), 'right last, most recent').toBe(
        'spell:ryba:1',
      );
    }
  });
});

describe('learning draws (pickLearning)', () => {
  const s = state({
    items: {
      'spell:ryba:1': item(1, DAY, DAY - 1, 'miss'),
      'spell:chyba:2': item(0, DAY, DAY - 1, 'slow'),
    },
  });
  const learning = [
    'spell:ryba:1',
    'spell:chyba:2',
    'spell:kytara:1',
    'spell:tyyden:1',
    'spell:rychlyy:1',
    'spell:pexna:1',
    'spell:obexd:2',
  ];
  const focus = ['spell:pexna:1', 'spell:obexd:2'];

  it("serve the focus egg's items first, those not served in this round before the others", () => {
    const random = createPrng('focus');
    for (let i = 0; i < 30; i++) {
      expect(focus).toContain(pickLearning(s, learning, focus, random));
      expect(pickLearning(s, learning, focus, random, ['spell:pexna:1'])).toBe('spell:obexd:2');
    }
    expect(pickLearning(s, ['spell:ryba:1'], focus, random), 'no focus item left').toBe(
      'spell:ryba:1',
    );
    expect(pickLearning(s, [], focus, random)).toBeNull();
  });

  it('serve new and weak items in about equal measure', () => {
    const random = createPrng('fresh-weak');
    const weak = new Set(['spell:ryba:1', 'spell:chyba:2']);
    let fresh = 0;
    for (let i = 0; i < 400; i++) if (!weak.has(pickLearning(s, learning, null, random)!)) fresh++;
    expect(fresh).toBeGreaterThan(160);
    expect(fresh).toBeLessThan(240);
  });

  it('serve the likeliest successes while success is protected', () => {
    const random = createPrng('likely');
    for (let i = 0; i < 20; i++) {
      expect(pickLearning(s, learning, null, random, [], true), 'right last time').toBe(
        'spell:chyba:2',
      );
    }
  });
});

describe('snack draws (pickSnack)', () => {
  const items = {
    'spell:ryba:1': item(4, DAY + 5),
    'spell:chyba:2': item(2, DAY + 1),
    'spell:kytara:1': item(3, DAY - 2, DAY - 4),
    'spell:tyyden:1': item(2, DAY - 6, DAY - 8),
  };
  const pool = [...Object.keys(items), 'spell:rychlyy:1'];
  const s = state({ items });
  const without = (...out: string[]) => pool.filter((id) => !out.includes(id));

  it('serve starving items first, then due ones, then the weakest known', () => {
    const random = createPrng('snack');
    const snack = (from: string[]) =>
      pickSnack({ state: s, data: lagoon, pool: from, blocked: NOTHING, random });
    expect(snack(pool)).toBe('spell:tyyden:1');
    expect(snack(without('spell:tyyden:1'))).toBe('spell:kytara:1');
    expect(snack(without('spell:tyyden:1', 'spell:kytara:1')), 'the lowest box').toBe(
      'spell:chyba:2',
    );
    expect(snack(['spell:rychlyy:1'])).toBe('spell:rychlyy:1');
    expect(snack([])).toBeNull();
  });

  it('give a first taste at every other problem, up to tastesPerSnack, later ones after starving items', () => {
    const random = createPrng('tastes');
    const tastes = ['spell:cibule:1', 'spell:jiskra:1'];
    const snack = (served: string[], likelyFirst = false) =>
      pickSnack({
        state: s,
        data: lagoon,
        pool: [...without('spell:tyyden:1'), ...tastes],
        blocked: NOTHING,
        served,
        random,
        likelyFirst,
        tastes,
        tastesPerSnack: 3,
      });
    expect(snack(['spell:ryba:1']), 'the 2nd problem').toBe('spell:cibule:1');
    expect(snack(['spell:ryba:1', 'spell:cibule:1', 'spell:chyba:2']), 'the 4th').toBe(
      'spell:jiskra:1',
    );
    expect(snack(['spell:ryba:1', 'spell:cibule:1']), 'the 3rd: a review').toBe('spell:kytara:1');
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((x) => `spell:${x}:0`);
    expect(snack(many), 'past three tastes').toBe('spell:kytara:1');
    // Starving items wait for the snack's first taste only, and not while success is protected.
    const hungry = (served: string[], likelyFirst = false) =>
      pickSnack({
        state: s,
        data: lagoon,
        pool: [...pool, ...tastes],
        blocked: NOTHING,
        served,
        random,
        likelyFirst,
        tastes,
        tastesPerSnack: 3,
      });
    expect(hungry(['spell:ryba:1'])).toBe('spell:cibule:1');
    expect(hungry(['spell:ryba:1'], true)).toBe('spell:tyyden:1');
    expect(hungry(['spell:ryba:1', 'spell:cibule:1', 'spell:chyba:2'])).toBe('spell:tyyden:1');
  });
});

describe('mixed draws (pickMixed)', () => {
  it('serve the most overdue review when the draw is not a learning one', () => {
    const s = state({
      ...history(40, 34),
      items: {
        'spell:ryba:1': item(3, DAY - 3, DAY - 6),
        'spell:chyba:2': item(3, DAY - 1, DAY - 5),
        'spell:kytara:1': item(4, DAY + 3),
      },
    });
    const pool = ['spell:ryba:1', 'spell:chyba:2', 'spell:kytara:1', 'spell:tyyden:1'];
    const random = createPrng('mixed');
    const picks = new Set<string>();
    for (let i = 0; i < 60; i++) {
      picks.add(
        pickMixed({ state: s, data: lagoon, pool, blocked: NOTHING, focus: null, random })!,
      );
    }
    expect(picks.has('spell:ryba:1')).toBe(true);
    expect(picks.has('spell:tyyden:1'), 'learning draws').toBe(true);
    expect(picks.has('spell:chyba:2'), 'a less overdue item waits').toBe(false);
  });

  it('serve learning items about as often as the learning share says, more as success grows', () => {
    const reviews = ['spell:ryba:1', 'spell:chyba:2', 'spell:kytara:1', 'spell:tyyden:1'];
    const fresh = ['spell:sxipka:1', 'spell:cibule:1', 'spell:jiskra:1', 'spell:texlo:1'];
    const items = Object.fromEntries(reviews.map((id) => [id, item(3, DAY - 1, DAY - 5)]));
    for (const [right, low, high] of [
      [16, 20, 36],
      [20, 40, 56],
    ] as const) {
      const s = state({ items, ...history(20, right) });
      const share = learningShare(s, lagoon);
      const random = createPrng(`share:${right}`);
      let learning = 0;
      for (let i = 0; i < 600; i++) {
        const pick = pickMixed({
          state: s,
          data: lagoon,
          pool: [...reviews, ...fresh],
          blocked: NOTHING,
          focus: null,
          random,
        })!;
        if (fresh.includes(pick)) learning++;
      }
      expect(share).toBeGreaterThan(low);
      expect(share).toBeLessThan(high);
      expect(learning / 6, `${right} of 20 right: share ${share} %`).toBeGreaterThan(low);
      expect(learning / 6, `${right} of 20 right: share ${share} %`).toBeLessThan(high);
    }
  });

  it('never serve a blocked word while another is available', () => {
    const random = createPrng('blocked');
    const blocked = blockedKeys(lagoon, ['spell:diitex:1'], WINDOW);
    for (let i = 0; i < 30; i++) {
      expect(
        pickMixed({
          state: state(),
          data: lagoon,
          pool: ['spell:diitex:3', 'spell:texlo:1'],
          blocked,
          focus: null,
          random,
        }),
      ).toBe('spell:texlo:1');
    }
  });
});

describe('the focus egg (eggsByAge, focusItems)', () => {
  const index = itemIndex(lagoon);
  const friend = (obtainedDay: number, stage: FriendState['stage'] = 'egg'): FriendState => ({
    stage,
    obtainedDay,
    stageDay: obtainedDay,
    outfit: { head: null, eyes: null, neck: null },
  });
  const chosen = (firstFriend: string | null) => ({
    onboarding: { firstFriend, placement: 'done' as const },
  });
  const ids = (s: ProfileState) => eggsByAge(s, lagoon).map((f) => f.id);
  const friends = {
    'krab-tvrdak': friend(DAY - 2),
    'meduzka-mekulka': friend(DAY - 5),
    'zelva-obojka': friend(DAY - 9, 'baby'),
    'rak-korinek': friend(DAY - 5),
  };
  /** Feeding in Slunná laguna 1: the hard, soft and bě pě vě mě words. */
  const pool = ['sk.lagoon.hard', 'sk.lagoon.soft', 'sk.lagoon.bepeveme'].flatMap(
    (skill) => index.get(skill) ?? [],
  );

  it('is the chosen first egg while it is an egg, then the oldest egg (content order on a tie)', () => {
    expect(ids(state({ friends }))).toEqual(['meduzka-mekulka', 'rak-korinek', 'krab-tvrdak']);
    expect(ids(state({ friends, ...chosen('krab-tvrdak') }))).toEqual([
      'krab-tvrdak',
      'meduzka-mekulka',
      'rak-korinek',
    ]);
    expect(ids(state({ friends, ...chosen('zelva-obojka') })), 'the chosen egg hatched').toEqual([
      'meduzka-mekulka',
      'rak-korinek',
      'krab-tvrdak',
    ]);
    expect(ids(state())).toEqual([]);
  });

  /** The items of a friend's skills that the pool holds, sorted (its set, contract §6.5). */
  const own = (id: string) =>
    [...new Set(lagoon.friends.find((f) => f.id === id)!.skills.flatMap((s) => index.get(s) ?? []))]
      .filter((item) => pool.includes(item))
      .sort();

  it("serves the focus egg's never-right items among the round's pool", () => {
    const eggs = { 'krab-tvrdak': friend(DAY - 5), 'zelva-obojka': friend(DAY - 2) };
    const s = state({ friends: eggs, ...chosen('zelva-obojka') });
    const zelva = own('zelva-obojka');
    expect(zelva).toEqual(expect.arrayContaining(['spell:obexd:2', 'spell:pexna:1']));
    expect(focusItems(s, lagoon, index, pool)).toEqual(zelva);
    s.items['spell:pexna:1'] = item(1, DAY + 1, DAY);
    s.items['spell:obexd:2'] = { ...item(1, DAY + 1, DAY, 'miss'), correct: 0 };
    expect(focusItems(s, lagoon, index, pool), 'right once: warm already').toEqual(
      zelva.filter((id) => id !== 'spell:pexna:1'),
    );
  });

  it('moves on to the next egg when the chosen one hatches or has nothing left to warm here', () => {
    const krab = own('krab-tvrdak');
    expect(krab.length).toBeGreaterThan(0);
    const warm = Object.fromEntries(own('zelva-obojka').map((id) => [id, item(1, DAY + 1, DAY)]));
    const eggs = { 'krab-tvrdak': friend(DAY - 5), 'zelva-obojka': friend(DAY - 2) };
    const chosenZelva = chosen('zelva-obojka');
    expect(
      focusItems(state({ friends: eggs, items: warm, ...chosenZelva }), lagoon, index, pool),
    ).toEqual(krab);
    const hatched = { ...eggs, 'zelva-obojka': friend(DAY - 2, 'baby') };
    expect(focusItems(state({ friends: hatched, ...chosenZelva }), lagoon, index, pool)).toEqual(
      krab,
    );
  });

  it('is null when no egg has never-right items in the round', () => {
    const soft = index.get('sk.lagoon.soft') ?? [];
    const eggs = { 'krab-tvrdak': friend(DAY - 5), 'zelva-obojka': friend(DAY - 2) };
    expect(focusItems(state({ friends: eggs }), lagoon, index, soft)).toBeNull();
    expect(focusItems(state(), lagoon, index, pool)).toBeNull();
  });
});
