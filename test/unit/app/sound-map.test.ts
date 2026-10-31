/**
 * Event-to-sound mapping: map validation, selection policies (rising streak chimes, coin or
 * coin shower by amount, timed sequences, cycling and random variants), cue contexts from
 * event payloads, and overlap throttling, all on an explicit clock.
 */
import { describe, expect, it } from 'vitest';
import {
  COIN_SHOWER_AMOUNT,
  createSoundPicker,
  eventCueContext,
  MAX_SEQUENCE_GAP_MS,
  validateAudioMap,
} from '../../../src/app/audio/sound-map';
import type { AudioMap, SoundAsset } from '../../../src/app/audio/sound-map';
import { STUB_AUDIO_MAP } from '../../../src/app/audio/stub-map';

const sfx = (name: string, durationMs = 200): SoundAsset => ({
  id: `sfx/${name}`,
  src: `assets/audio/sfx/${name}.wav`,
  durationMs,
});

const MAP: AudioMap = {
  packId: 'ps-audio',
  revision: 'r1',
  effects: [
    sfx('chime-1'),
    sfx('chime-2'),
    sfx('chime-3'),
    sfx('miss'),
    sfx('coin', 300),
    sfx('coin-shower', 900),
    sfx('fanfare', 1500),
    sfx('star-1', 400),
    sfx('star-2', 400),
    sfx('star-3', 400),
    sfx('bubble-1', 80),
    sfx('bubble-2', 80),
  ],
  music: [{ id: 'music/grotto', src: 'assets/audio/music/grotto.wav', durationMs: 30_000 }],
  events: {
    'answer.correct': { sounds: ['sfx/chime-1', 'sfx/chime-2', 'sfx/chime-3'], pick: 'streak' },
    'answer.incorrect': { sounds: ['sfx/miss'], pick: 'first' },
    'coins.earned': { sounds: ['sfx/coin', 'sfx/coin-shower'], pick: 'amount' },
    'level.completed': {
      sounds: ['sfx/fanfare', 'sfx/star-1', 'sfx/star-2', 'sfx/star-3'],
      pick: 'sequence',
    },
    'reask.scheduled': { sounds: [], pick: 'first' },
    'ui.cycle': { sounds: ['sfx/bubble-1', 'sfx/bubble-2'], pick: 'cycle' },
    'ui.random': { sounds: ['sfx/bubble-1', 'sfx/bubble-2'], pick: 'random' },
  },
  musicStates: { grotto: 'music/grotto', grownups: null },
  throttle: {
    'sfx/miss': { minIntervalMs: 500, maxConcurrent: 1 },
    'sfx/coin': { minIntervalMs: 70, maxConcurrent: 3 },
  },
  crossfadeSeconds: 1.2,
};

function clock() {
  let now = 0;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

const sounds = (planned: { sound: string }[]): string[] => planned.map(({ sound }) => sound);

describe('audio map validation', () => {
  it('accepts a consistent map and the silent stub', () => {
    expect(validateAudioMap(MAP)).toBe(MAP);
    expect(validateAudioMap(STUB_AUDIO_MAP)).toBe(STUB_AUDIO_MAP);
  });

  it('rejects references that do not exist, sounds the contract does not name, unsafe paths and impossible numbers', () => {
    const broken: AudioMap[] = [
      { ...MAP, events: { x: { sounds: ['sfx/missing'], pick: 'first' } } },
      { ...MAP, events: { x: { sounds: ['music/grotto'], pick: 'first' } } },
      { ...MAP, events: { x: { sounds: ['sfx/coin'], pick: 'amount' } } },
      { ...MAP, musicStates: { grotto: 'sfx/chime-1' } },
      { ...MAP, effects: [...MAP.effects, sfx('chime-1')] },
      { ...MAP, effects: [{ id: 'sfx/up', src: '../secret.wav', durationMs: 100 }] },
      { ...MAP, effects: [{ id: 'sfx/abs', src: '/assets/a.wav', durationMs: 100 }] },
      {
        ...MAP,
        effects: [{ id: 'sfx/remote', src: 'https://example.com/a.wav', durationMs: 100 }],
      },
      { ...MAP, effects: [{ id: 'sfx/silent', src: 'assets/a.wav', durationMs: 0 }] },
      { ...MAP, effects: [{ id: 'chime-9', src: 'assets/a.wav', durationMs: 100 }] },
      { ...MAP, effects: [{ id: 'sfx/Chime 9', src: 'assets/a.wav', durationMs: 100 }] },
      { ...MAP, effects: [{ id: 'music/chime', src: 'assets/a.wav', durationMs: 100 }] },
      {
        ...MAP,
        music: [{ id: 'sfx/grotto', src: 'assets/audio/music/grotto.wav', durationMs: 30_000 }],
        musicStates: {},
      },
      { ...MAP, packId: 'bad id' },
      { ...MAP, throttle: { 'sfx/coin': { minIntervalMs: -1, maxConcurrent: 1 } } },
      { ...MAP, throttle: { 'sfx/coin': { minIntervalMs: 10, maxConcurrent: 0 } } },
      { ...MAP, crossfadeSeconds: 9 },
    ];
    for (const map of broken) expect(() => validateAudioMap(map)).toThrow();
  });
});

describe('sound planning', () => {
  const picker = () => createSoundPicker(MAP, { now: clock().now, random: () => 0 });

  it('plans nothing for unmapped and deliberately silent events', () => {
    expect(picker().plan('monster.freed')).toEqual([]);
    expect(picker().plan('reask.scheduled')).toEqual([]);
  });

  it('raises the chime with the streak and holds the top chime after that', () => {
    const plans = [1, 2, 3, 4, 9].map((streak) =>
      sounds(picker().plan('answer.correct', { streak })),
    );
    expect(plans).toEqual([
      ['sfx/chime-1'],
      ['sfx/chime-2'],
      ['sfx/chime-3'],
      ['sfx/chime-3'],
      ['sfx/chime-3'],
    ]);
  });

  it('plays one coin for a few coins and one shower for many', () => {
    const p = picker();
    expect(sounds(p.plan('coins.earned', { amount: 1 }))).toEqual(['sfx/coin']);
    expect(sounds(p.plan('coins.earned', { amount: COIN_SHOWER_AMOUNT - 1 }))).toEqual([
      'sfx/coin',
    ]);
    expect(sounds(p.plan('coins.earned', { amount: COIN_SHOWER_AMOUNT }))).toEqual([
      'sfx/coin-shower',
    ]);
    expect(sounds(p.plan('coins.earned'))).toEqual(['sfx/coin']);
  });

  it('times a sequence by sound lengths, and plays one star sound per star earned', () => {
    const p = picker();
    expect(p.plan('level.completed', { count: 2 })).toEqual([
      { sound: 'sfx/fanfare', delayMs: 0 },
      // A long fanfare never holds the stars back for more than the gap limit.
      { sound: 'sfx/star-1', delayMs: MAX_SEQUENCE_GAP_MS },
      { sound: 'sfx/star-2', delayMs: MAX_SEQUENCE_GAP_MS + 400 },
    ]);
    expect(sounds(p.plan('level.completed', { count: 0 }))).toEqual(['sfx/fanfare']);
    expect(sounds(p.plan('level.completed', { count: 7 }))).toHaveLength(4);
    expect(sounds(p.plan('level.completed'))).toEqual([
      'sfx/fanfare',
      'sfx/star-1',
      'sfx/star-2',
      'sfx/star-3',
    ]);
  });

  it('cycles through variants and picks random variants from the injected source', () => {
    const randoms = [0.1, 0.9];
    const p = createSoundPicker(MAP, { now: () => 0, random: () => randoms.shift() ?? 0 });
    expect([0, 1, 2].map(() => sounds(p.plan('ui.cycle'))[0])).toEqual([
      'sfx/bubble-1',
      'sfx/bubble-2',
      'sfx/bubble-1',
    ]);
    expect(sounds(p.plan('ui.random'))).toEqual(['sfx/bubble-1']);
    expect(sounds(p.plan('ui.random'))).toEqual(['sfx/bubble-2']);
  });
});

describe('cue context from event payloads', () => {
  it('reads the streak, the coin amount and the stars as a count', () => {
    expect(eventCueContext({ item: 'word:mlyn:vyjm', streak: 3 })).toEqual({ streak: 3 });
    expect(eventCueContext({ amount: 6, reason: 'stars' })).toEqual({ amount: 6 });
    expect(eventCueContext({ level: 'l1', stars: 2, firstTime: true })).toEqual({ count: 2 });
  });

  it('ignores payloads without those numbers', () => {
    expect(eventCueContext(null)).toBeUndefined();
    expect(eventCueContext([3])).toBeUndefined();
    expect(eventCueContext({ item: 'word:mlyn:vyjm' })).toBeUndefined();
    expect(eventCueContext({ streak: Number.NaN })).toBeUndefined();
    expect(eventCueContext({ streak: '3' })).toBeUndefined();
  });
});

describe('overlap throttling', () => {
  it('holds a sound to its minimum interval', () => {
    const time = clock();
    const p = createSoundPicker(MAP, { now: time.now, random: () => 0 });
    expect(p.admit('sfx/miss')).toBe(true);
    time.advance(499);
    expect(p.admit('sfx/miss')).toBe(false);
    time.advance(1);
    expect(p.admit('sfx/miss')).toBe(true);
  });

  it('limits how many copies of a sound play at once', () => {
    const time = clock();
    const p = createSoundPicker(MAP, { now: time.now, random: () => 0 });
    for (let index = 0; index < 3; index++) {
      expect(p.admit('sfx/coin')).toBe(true);
      time.advance(70);
    }
    // Three coins (300 ms each) still ring; a fourth waits until the first has finished.
    expect(p.admit('sfx/coin')).toBe(false);
    time.advance(90);
    expect(p.admit('sfx/coin')).toBe(true);
  });

  it('caps how many effects may start together', () => {
    const time = clock();
    const p = createSoundPicker(MAP, {
      now: time.now,
      random: () => 0,
      maxBurst: 2,
      burstWindowMs: 250,
    });
    expect(p.admit('sfx/chime-1')).toBe(true);
    expect(p.admit('sfx/coin')).toBe(true);
    expect(p.admit('sfx/bubble-1')).toBe(false);
    time.advance(250);
    expect(p.admit('sfx/bubble-1')).toBe(true);
  });
});
