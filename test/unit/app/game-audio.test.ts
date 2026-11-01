/**
 * Game audio over the SDK narration service: nothing before the unlocking gesture, effects
 * from the event map with throttling and timed sequences, music states with the pack's
 * crossfade, music lowered while read-aloud speaks, silence while paused, and a clean slate on
 * clear. The silent map never creates an audio context at all.
 */
import { readFileSync } from 'node:fs';
import { createNarration } from '@aegis/browser/audio';
import type { NarrationController, NarrationState } from '@aegis/browser/audio';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGameAudio,
  DUCK_LEVEL,
  musicFor,
  sdkPack,
  sdkSoundId,
} from '../../../src/app/audio/game-audio';
import { parseAudioManifest } from '../../../src/app/audio/manifest';
import type { AudioMap } from '../../../src/app/audio/sound-map';
import { STUB_AUDIO_MAP } from '../../../src/app/audio/stub-map';

const MAP: AudioMap = {
  packId: 'ps-audio',
  revision: 'r1',
  effects: [
    { id: 'sfx/chime', src: 'assets/audio/sfx/chime.wav', durationMs: 300 },
    { id: 'sfx/coin', src: 'assets/audio/sfx/coin.wav', durationMs: 300 },
    { id: 'sfx/fanfare', src: 'assets/audio/sfx/fanfare.wav', durationMs: 500 },
    { id: 'sfx/star-1', src: 'assets/audio/sfx/star-1.wav', durationMs: 400 },
  ],
  music: [{ id: 'music/grotto', src: 'assets/audio/music/grotto.wav', durationMs: 30_000 }],
  events: {
    'answer.correct': { sounds: ['sfx/chime'], pick: 'first' },
    'coins.earned': { sounds: ['sfx/coin'], pick: 'first' },
    'level.completed': { sounds: ['sfx/fanfare', 'sfx/star-1'], pick: 'sequence' },
  },
  musicStates: { grotto: 'music/grotto', round: 'music/grotto', battle: null },
  throttle: { 'sfx/coin': { minIntervalMs: 100, maxConcurrent: 3 } },
  crossfadeSeconds: 1.2,
};

function fakeNarration() {
  const calls: string[] = [];
  let unlock: () => void = () => undefined;
  const controller = {
    unlock: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          unlock = resolve;
        }),
    ),
    registerPack: vi.fn(),
    playEffect: vi.fn(async (_pack: string, id: string) => {
      calls.push(`effect ${id}`);
    }),
    setAtmosphere: vi.fn(async (next: { asset: string; fadeSeconds?: number } | null) => {
      calls.push(`music ${next ? next.asset : 'silence'}`);
    }),
    setVolume: vi.fn(),
    pause: vi.fn(() => calls.push('pause')),
    resume: vi.fn(async () => {
      calls.push('resume');
    }),
    clear: vi.fn(() => calls.push('clear')),
    dispose: vi.fn(async () => undefined),
  };
  const factory = (_listener: (state: NarrationState) => void): NarrationController =>
    controller as unknown as NarrationController;
  return { controller, calls, factory, finishUnlock: () => unlock() };
}

const flush = async (): Promise<void> => {
  for (let index = 0; index < 5; index++) await Promise.resolve();
};

async function ready(fake: ReturnType<typeof fakeNarration>, now?: () => number, map = MAP) {
  const audio = createGameAudio({
    baseUrl: 'http://localhost/',
    map,
    narration: fake.factory,
    ...(now ? { now } : {}),
  });
  audio.unlock();
  fake.finishUnlock();
  await flush();
  return audio;
}

/** The pack with its 9-second victory sting and a battle loop (docs/plan.md §10). */
const STING_MAP: AudioMap = {
  ...MAP,
  effects: [
    ...MAP.effects,
    { id: 'sfx/victory-sting', src: 'assets/audio/sfx/victory-sting.ogg', durationMs: 9000 },
  ],
  music: [
    ...MAP.music,
    { id: 'music/battle', src: 'assets/audio/music/battle.ogg', durationMs: 60_000 },
  ],
  events: { ...MAP.events, 'monster.freed': { sounds: ['sfx/victory-sting'], pick: 'first' } },
  musicStates: { grotto: 'music/grotto', battle: 'music/battle' },
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('game audio', () => {
  it('stays silent and creates nothing with the silent map', () => {
    const narration = vi.fn();
    const audio = createGameAudio({ baseUrl: 'http://localhost/', map: STUB_AUDIO_MAP, narration });
    audio.unlock();
    audio.cue('answer.correct');
    audio.setMusic('grotto');
    expect(audio.status()).toBe('silent');
    expect(narration).not.toHaveBeenCalled();
  });

  it('plays nothing before the unlocking gesture, then mapped effects and music', async () => {
    let now = 0;
    const fake = fakeNarration();
    const audio = createGameAudio({
      baseUrl: 'http://localhost/',
      map: MAP,
      now: () => now,
      narration: fake.factory,
    });
    audio.setMusic('grotto');
    audio.cue('answer.correct');
    expect(fake.calls).toEqual([]);
    expect(audio.status()).toBe('locked');

    audio.unlock();
    expect(fake.controller.unlock).toHaveBeenCalledOnce();
    fake.finishUnlock();
    await flush();
    expect(audio.status()).toBe('ready');
    expect(fake.calls).toEqual(['music music:grotto']);
    expect(fake.controller.setAtmosphere).toHaveBeenCalledWith({
      packId: 'ps-audio',
      asset: 'music:grotto',
      fadeSeconds: 1.2,
    });

    audio.cue('answer.correct');
    audio.cue('coins.earned');
    audio.cue('coins.earned');
    now += 100;
    audio.cue('coins.earned');
    audio.cue('monster.freed');
    await flush();
    expect(fake.calls).toEqual([
      'music music:grotto',
      'effect sfx:chime',
      'effect sfx:coin',
      'effect sfx:coin',
    ]);
    expect(fake.controller.registerPack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ps-audio', lines: [] }),
    );
  });

  it('keeps the same music playing across screens that share it', async () => {
    const fake = fakeNarration();
    const audio = await ready(fake);
    audio.setMusic('grotto');
    audio.setMusic('round');
    audio.setMusic('battle');
    await flush();
    expect(fake.calls).toEqual(['music music:grotto', 'music silence']);
  });

  it('plays the grotto loop for a mood the pack does not list, and silence only when asked', async () => {
    const fake = fakeNarration();
    const audio = await ready(fake);
    audio.setMusic('battle');
    audio.setMusic('map');
    audio.setMusic('victory');
    audio.setMusic(null);
    await flush();
    expect(fake.calls).toEqual(['music music:grotto', 'music silence']);
    const base = { ...MAP, musicStates: { battle: 'music/grotto' } };
    expect(musicFor(base, 'map')).toBeNull();
    expect(musicFor(MAP, 'toString')).toBe('music/grotto');
  });

  it('plays a sequence on time and drops its rest when cleared', async () => {
    vi.useFakeTimers();
    let now = 0;
    const fake = fakeNarration();
    const audio = await ready(fake, () => now);
    audio.cue('level.completed', { count: 1 });
    await flush();
    expect(fake.calls).toEqual(['effect sfx:fanfare']);
    now += 500;
    vi.advanceTimersByTime(500);
    await flush();
    expect(fake.calls).toEqual(['effect sfx:fanfare', 'effect sfx:star-1']);

    audio.cue('level.completed', { count: 1 });
    audio.clear();
    now += 1000;
    vi.advanceTimersByTime(1000);
    await flush();
    expect(fake.calls).toEqual([
      'effect sfx:fanfare',
      'effect sfx:star-1',
      'effect sfx:fanfare',
      'clear',
    ]);
  });

  it('is silent while paused, follows music changes made meanwhile, and clears on a switch', async () => {
    const fake = fakeNarration();
    const audio = await ready(fake);
    audio.setMusic('grotto');
    audio.pause();
    audio.cue('answer.correct');
    audio.setMusic('battle');
    audio.resume();
    audio.clear();
    await flush();
    expect(fake.calls).toEqual(['music music:grotto', 'pause', 'resume', 'music silence', 'clear']);
  });

  it('stops the battle loop before the victory sting, and brings the music asked for back after it', async () => {
    vi.useFakeTimers();
    let now = 0;
    const fake = fakeNarration();
    const audio = await ready(fake, () => now, STING_MAP);
    audio.setMusic('battle');
    // The results screen asks for the grotto and, in the same moment, frees the monster.
    audio.setMusic('grotto');
    audio.sting('monster.freed');
    await flush();
    expect(fake.calls).toEqual([
      'music music:battle',
      'music music:grotto',
      'music silence',
      'effect sfx:victory-sting',
    ]);
    // Music asked for during the sting waits for its end.
    audio.setMusic('battle');
    audio.setMusic('grotto');
    now += 8999;
    vi.advanceTimersByTime(8999);
    await flush();
    expect(fake.calls).toHaveLength(4);
    now += 1;
    vi.advanceTimersByTime(1);
    await flush();
    expect(fake.calls.slice(4)).toEqual(['music music:grotto']);
  });

  it('keeps the music silent for the rest of a sting paused with the game', async () => {
    vi.useFakeTimers();
    let now = 0;
    const fake = fakeNarration();
    const audio = await ready(fake, () => now, STING_MAP);
    audio.setMusic('grotto');
    audio.sting('monster.freed');
    now += 2000;
    vi.advanceTimersByTime(2000);
    audio.pause();
    now += 30_000;
    vi.advanceTimersByTime(30_000);
    audio.resume();
    await flush();
    expect(fake.calls).toEqual([
      'music music:grotto',
      'music silence',
      'effect sfx:victory-sting',
      'pause',
      'resume',
    ]);
    now += 6999;
    vi.advanceTimersByTime(6999);
    await flush();
    expect(fake.calls).toHaveLength(5);
    now += 1;
    vi.advanceTimersByTime(1);
    await flush();
    expect(fake.calls.slice(5)).toEqual(['music music:grotto']);
  });

  it('lets a new child’s music play at once after a sting, and leaves the music to a silent sting', async () => {
    vi.useFakeTimers();
    let now = 0;
    const fake = fakeNarration();
    const audio = await ready(fake, () => now, STING_MAP);
    audio.setMusic('grotto');
    audio.sting('round.started');
    audio.sting('monster.freed');
    audio.clear();
    audio.setMusic('grotto');
    await flush();
    expect(fake.calls).toEqual([
      'music music:grotto',
      'music silence',
      'effect sfx:victory-sting',
      'clear',
      'music music:grotto',
    ]);
    now += 9000;
    vi.advanceTimersByTime(9000);
    await flush();
    expect(fake.calls).toHaveLength(5);
  });

  it('applies bus volumes from preferences and lowers the music while read-aloud speaks', async () => {
    const fake = fakeNarration();
    const audio = createGameAudio({
      baseUrl: 'http://localhost/',
      map: MAP,
      narration: fake.factory,
    });
    audio.setVolumes({ music: 0.5, effects: 0.75 });
    expect(fake.controller.setVolume).toHaveBeenCalledWith('music', 0.5);
    expect(fake.controller.setVolume).toHaveBeenCalledWith('effects', 0.75);
    audio.duck(true);
    expect(fake.controller.setVolume).toHaveBeenLastCalledWith('effects', 0.75);
    expect(fake.controller.setVolume).toHaveBeenCalledWith('music', 0.5 * DUCK_LEVEL);
    fake.controller.setVolume.mockClear();
    audio.duck(true);
    expect(fake.controller.setVolume).not.toHaveBeenCalled();
    audio.duck(false);
    expect(fake.controller.setVolume).toHaveBeenCalledWith('music', 0.5);
  });

  it('reports a refused unlock as blocked, and a later gesture can retry', async () => {
    const fake = fakeNarration();
    fake.controller.unlock.mockImplementationOnce(() => Promise.reject(new Error('blocked')));
    const audio = createGameAudio({
      baseUrl: 'http://localhost/',
      map: MAP,
      narration: fake.factory,
    });
    audio.unlock();
    await flush();
    expect(audio.status()).toBe('blocked');
    audio.unlock();
    fake.finishUnlock();
    await flush();
    expect(audio.status()).toBe('ready');
  });

  it('carries on when the service cannot be created at all, and says so on the console', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const audio = createGameAudio({
      baseUrl: 'http://localhost/',
      map: MAP,
      narration: () => {
        throw new Error('no Web Audio here');
      },
    });
    audio.unlock();
    audio.cue('answer.correct');
    expect(audio.status()).toBe('unavailable');
    expect(errors).toHaveBeenCalledOnce();
  });

  it('reports a pack the SDK refuses on the console and as unavailable, never quietly', () => {
    const fake = fakeNarration();
    fake.controller.registerPack.mockImplementation(() => {
      throw new Error('id must be a bounded stable identifier.');
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const statuses: string[] = [];
    const audio = createGameAudio({
      baseUrl: 'http://localhost/',
      map: MAP,
      narration: fake.factory,
      onStatus: (status) => statuses.push(status),
    });
    audio.unlock();
    audio.setMusic('grotto');
    audio.cue('answer.correct');
    expect(audio.status()).toBe('unavailable');
    expect(statuses).toEqual(['unavailable']);
    expect(errors).toHaveBeenCalledOnce();
    expect(String(errors.mock.calls[0]![0])).toContain('could not be registered');
    expect(fake.controller.unlock).not.toHaveBeenCalled();
  });

  it('tells every change of its status', async () => {
    const fake = fakeNarration();
    fake.controller.unlock.mockImplementationOnce(() => Promise.reject(new Error('blocked')));
    const statuses: string[] = [];
    const audio = createGameAudio({
      baseUrl: 'http://localhost/',
      map: MAP,
      narration: fake.factory,
      onStatus: (status) => statuses.push(status),
    });
    audio.unlock();
    await flush();
    audio.unlock();
    fake.finishUnlock();
    await flush();
    expect(statuses).toEqual(['blocked', 'ready']);
  });
});

describe('the committed sound pack and the SDK', () => {
  const committed = JSON.parse(
    readFileSync(new URL('../../../assets/audio/manifest.json', import.meta.url), 'utf8'),
  ) as { readonly sounds: readonly { readonly id: string }[] };
  const map = parseAudioManifest(committed);

  it('registers every sound under its own ID that the SDK itself accepts', () => {
    const ids = [...map.effects, ...map.music].map((sound) => sound.id);
    expect([...ids].sort()).toEqual(committed.sounds.map((sound) => sound.id).sort());
    expect(ids).toContain('music/grotto');
    expect(ids).toContain('sfx/victory-sting');
    expect(new Set(ids.map(sdkSoundId)).size).toBe(ids.length);
    expect(sdkSoundId('music/grotto')).toBe('music:grotto');
    // The SDK's own validation decides, never a copy of its pattern.
    expect(() =>
      createNarration({
        baseUrl: 'http://localhost/pearl-sea/',
        onState: () => undefined,
      }).registerPack(sdkPack(map)),
    ).not.toThrow();
    // The contract's IDs as they are, which kept the game silent (PS-QA-02).
    const raw = { ...sdkPack(map), assets: map.music.map(({ id, src }) => ({ id, src })) };
    expect(() =>
      createNarration({
        baseUrl: 'http://localhost/pearl-sea/',
        onState: () => undefined,
      }).registerPack(raw),
    ).toThrow(/stable identifier/);
  });

  it('stays ready to unlock over the real service', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const statuses: string[] = [];
    const audio = createGameAudio({
      baseUrl: 'http://localhost/pearl-sea/',
      map,
      onStatus: (status) => statuses.push(status),
    });
    // Volumes register the pack with the service; only the first tap makes an AudioContext.
    audio.setVolumes({ music: 1, effects: 1 });
    expect(audio.status()).toBe('locked');
    expect(statuses).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });
});
