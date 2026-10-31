/**
 * S5's audio manifest as the shell reads it: the shipped manifest (an empty placeholder until
 * S5's pack replaces it) parses and every file it names exists; a full manifest in this schema
 * keeps its selection policies, music states and throttles; and anything unreadable falls back
 * to the silent map instead of breaking boot.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadAudioMap, parseAudioManifest } from '../../../src/app/audio/manifest';
import { STUB_AUDIO_MAP } from '../../../src/app/audio/stub-map';
import type { Fetcher } from '../../../src/app/content/site';
import { AUDIO_MANIFEST_PATH, AUDIO_MANIFEST_SCHEMA } from '../../../src/rules/contract';

const shipped = JSON.parse(readFileSync(AUDIO_MANIFEST_PATH, 'utf8')) as Record<string, unknown>;

/** A manifest in the schema S5's pack writes (Dragon Valley's, under this game's name). */
const SAMPLE = {
  schema: AUDIO_MANIFEST_SCHEMA,
  packId: 'pearl-sea-audio',
  revision: 'r1',
  sounds: [
    {
      id: 'sfx/chime-1',
      src: 'assets/audio/sfx/chime-1.ogg',
      bus: 'effects',
      durationSeconds: 0.4,
    },
    {
      id: 'sfx/chime-2',
      src: 'assets/audio/sfx/chime-2.ogg',
      bus: 'effects',
      durationSeconds: 0.4,
    },
    { id: 'sfx/coin', src: 'assets/audio/sfx/coin.ogg', bus: 'effects', durationSeconds: 0.3 },
    {
      id: 'sfx/coin-shower',
      src: 'assets/audio/sfx/coin-shower.ogg',
      bus: 'effects',
      durationSeconds: 0.9,
    },
    {
      id: 'sfx/fanfare',
      src: 'assets/audio/sfx/fanfare.ogg',
      bus: 'effects',
      durationSeconds: 1.5,
    },
    { id: 'sfx/splash', src: 'assets/audio/sfx/splash.ogg', bus: 'effects', durationSeconds: 0.5 },
    { id: 'music/grotto', src: 'assets/audio/music/grotto.ogg', bus: 'music', durationSeconds: 32 },
  ],
  events: {
    'answer.correct': { sounds: ['sfx/chime-1', 'sfx/chime-2'], select: 'streak' },
    'answer.incorrect': { sounds: ['sfx/splash'] },
    'coins.earned': { sounds: ['sfx/coin', 'sfx/coin-shower'], select: 'amount' },
    'level.completed': { sounds: ['sfx/fanfare', 'sfx/chime-1'], select: 'sequence' },
  },
  music: {
    states: { grotto: 'music/grotto', title: 'music/grotto', grownups: null },
    crossfadeSeconds: 1.2,
  },
  voices: {
    throttle: {
      'sfx/coin': { minIntervalMs: 70, maxConcurrent: 3 },
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
      'sfx/chime-1',
      'sfx/chime-2',
      'sfx/coin',
      'sfx/coin-shower',
      'sfx/fanfare',
      'sfx/splash',
    ]);
    expect(map.music).toEqual([
      { id: 'music/grotto', src: 'assets/audio/music/grotto.ogg', durationMs: 32_000 },
    ]);
  });

  it('keeps the selection policies of the event map', () => {
    expect(map.events['answer.correct']?.pick).toBe('streak');
    expect(map.events['coins.earned']?.pick).toBe('amount');
    expect(map.events['level.completed']?.pick).toBe('sequence');
    expect(map.events['answer.incorrect']?.pick).toBe('first');
    expect(map.musicStates).toEqual({
      grotto: 'music/grotto',
      title: 'music/grotto',
      grownups: null,
    });
  });

  it('keeps per-sound throttles and skips advice that names no sound', () => {
    expect(map.throttle['sfx/coin']).toEqual({ minIntervalMs: 70, maxConcurrent: 3 });
    expect(map.throttle).not.toHaveProperty('bubble-family');
  });

  it('refuses another schema and malformed entries', () => {
    expect(() =>
      parseAudioManifest({ ...SAMPLE, schema: 'dragon-valley-audio-manifest/1' }),
    ).toThrow(AUDIO_MANIFEST_SCHEMA);
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
        events: { 'answer.correct': { sounds: ['sfx/chime-1'], select: 'shuffle' } },
      }),
    ).toThrow();
    expect(() =>
      parseAudioManifest({ ...SAMPLE, events: { x: { sounds: ['not-a-sound'] } } }),
    ).toThrow();
  });

  it('refuses sounds not named by the contract: sfx/<name> effects, music/<loop> music', () => {
    const effect = SAMPLE.sounds[0]!;
    const loop = SAMPLE.sounds[SAMPLE.sounds.length - 1]!;
    for (const sound of [
      { ...effect, id: 'chime-1' },
      { ...effect, id: 'sfx/Chime 1' },
      { ...effect, id: 'music/chime-1' },
      { ...loop, id: 'sfx/grotto' },
    ]) {
      expect(
        () => parseAudioManifest({ ...SAMPLE, sounds: [sound], events: {}, music: { states: {} } }),
        sound.id,
      ).toThrow(`Invalid sound ${sound.id}.`);
    }
  });

  it('loads the manifest below the deployment base', async () => {
    const requested: string[] = [];
    const loaded = await loadAudioMap('https://example.test/pearl-sea/', async (url) => {
      requested.push(url);
      return serve(200, JSON.stringify(SAMPLE))(url);
    });
    expect(requested).toEqual([`https://example.test/pearl-sea/${AUDIO_MANIFEST_PATH}`]);
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
