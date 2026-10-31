/**
 * S5's audio manifest as the shell reads it: the shipped manifest (an empty placeholder until
 * S5's pack replaces it) parses and every file it names exists; a full manifest in this schema
 * keeps its selection policies, music states and throttles; and anything unreadable falls back
 * to the silent map instead of breaking boot.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  loadAudioMap,
  MANIFEST_PATH,
  MANIFEST_SCHEMA,
  parseAudioManifest,
} from '../../../src/app/audio/manifest';
import { STUB_AUDIO_MAP } from '../../../src/app/audio/stub-map';
import type { Fetcher } from '../../../src/app/content/site';

const shipped = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, unknown>;

/** A manifest in the schema S5's pack writes (Dragon Valley's, under this game's name). */
const SAMPLE = {
  schema: MANIFEST_SCHEMA,
  packId: 'pearl-sea-audio',
  revision: 'r1',
  sounds: [
    { id: 'chime-1', src: 'assets/audio/sfx/chime-1.wav', bus: 'effects', durationSeconds: 0.4 },
    { id: 'chime-2', src: 'assets/audio/sfx/chime-2.wav', bus: 'effects', durationSeconds: 0.4 },
    { id: 'coin', src: 'assets/audio/sfx/coin.wav', bus: 'effects', durationSeconds: 0.3 },
    { id: 'coin-shower', src: 'assets/audio/sfx/shower.wav', bus: 'effects', durationSeconds: 0.9 },
    { id: 'fanfare', src: 'assets/audio/sfx/fanfare.wav', bus: 'effects', durationSeconds: 1.5 },
    { id: 'splash', src: 'assets/audio/sfx/splash.wav', bus: 'effects', durationSeconds: 0.5 },
    { id: 'grotto', src: 'assets/audio/music/grotto.wav', bus: 'music', durationSeconds: 32 },
  ],
  events: {
    'answer.correct': { sounds: ['chime-1', 'chime-2'], select: 'streak' },
    'answer.incorrect': { sounds: ['splash'] },
    'coins.earned': { sounds: ['coin', 'coin-shower'], select: 'amount' },
    'level.completed': { sounds: ['fanfare', 'chime-1'], select: 'sequence' },
  },
  music: { states: { grotto: 'grotto', title: 'grotto', grownups: null }, crossfadeSeconds: 1.2 },
  voices: {
    throttle: {
      coin: { minIntervalMs: 70, maxConcurrent: 3 },
      'bubble-family': { minIntervalMs: 40, maxConcurrent: 2 },
    },
  },
};

const serve =
  (status: number, body: string): Fetcher =>
  async () => ({ ok: status < 400, status, text: async () => body });

describe('the shipped audio manifest', () => {
  it('parses into a valid map whose files all exist', () => {
    const map = parseAudioManifest(shipped);
    for (const asset of [...map.effects, ...map.music]) {
      expect(existsSync(asset.src), asset.src).toBe(true);
      expect(asset.durationMs).toBeGreaterThan(0);
    }
    expect(map.crossfadeSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe('reading a manifest', () => {
  const map = parseAudioManifest(SAMPLE);

  it('keeps the sounds on their buses, in milliseconds', () => {
    expect(map.effects.map((asset) => asset.id)).toEqual([
      'chime-1',
      'chime-2',
      'coin',
      'coin-shower',
      'fanfare',
      'splash',
    ]);
    expect(map.music).toEqual([
      { id: 'grotto', src: 'assets/audio/music/grotto.wav', durationMs: 32_000 },
    ]);
  });

  it('keeps the selection policies of the event map', () => {
    expect(map.events['answer.correct']?.pick).toBe('streak');
    expect(map.events['coins.earned']?.pick).toBe('amount');
    expect(map.events['level.completed']?.pick).toBe('sequence');
    expect(map.events['answer.incorrect']?.pick).toBe('first');
    expect(map.musicStates).toEqual({ grotto: 'grotto', title: 'grotto', grownups: null });
  });

  it('keeps per-sound throttles and skips advice that names no sound', () => {
    expect(map.throttle['coin']).toEqual({ minIntervalMs: 70, maxConcurrent: 3 });
    expect(map.throttle).not.toHaveProperty('bubble-family');
  });

  it('refuses another schema and malformed entries', () => {
    expect(() =>
      parseAudioManifest({ ...SAMPLE, schema: 'dragon-valley-audio-manifest/1' }),
    ).toThrow(MANIFEST_SCHEMA);
    expect(() => parseAudioManifest({ ...SAMPLE, sounds: {} })).toThrow();
    expect(() =>
      parseAudioManifest({
        ...SAMPLE,
        sounds: [{ ...SAMPLE.sounds[0], bus: 'voice' }, ...SAMPLE.sounds.slice(1)],
      }),
    ).toThrow();
    expect(() =>
      parseAudioManifest({
        ...SAMPLE,
        events: { 'answer.correct': { sounds: ['chime-1'], select: 'shuffle' } },
      }),
    ).toThrow();
    expect(() =>
      parseAudioManifest({ ...SAMPLE, events: { x: { sounds: ['not-a-sound'] } } }),
    ).toThrow();
  });

  it('loads the manifest below the deployment base', async () => {
    const requested: string[] = [];
    const loaded = await loadAudioMap('https://example.test/pearl-sea/', async (url) => {
      requested.push(url);
      return serve(200, JSON.stringify(SAMPLE))(url);
    });
    expect(requested).toEqual([`https://example.test/pearl-sea/${MANIFEST_PATH}`]);
    expect(loaded.packId).toBe('pearl-sea-audio');
  });

  it('falls back to the silent map when the manifest is missing or broken', async () => {
    const base = 'https://example.test/';
    expect(await loadAudioMap(base, serve(404, ''))).toBe(STUB_AUDIO_MAP);
    expect(await loadAudioMap(base, serve(200, '{ not json'))).toBe(STUB_AUDIO_MAP);
    expect(await loadAudioMap(base, serve(200, '{"schema":"other/1"}'))).toBe(STUB_AUDIO_MAP);
    expect(
      await loadAudioMap(base, async () => {
        throw new TypeError('offline');
      }),
    ).toBe(STUB_AUDIO_MAP);
  });
});
