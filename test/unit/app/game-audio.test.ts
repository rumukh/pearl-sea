/**
 * Game audio over the SDK narration service: nothing before the unlocking gesture, effects
 * from the event map with throttling and timed sequences, music states with the pack's
 * crossfade, music lowered while read-aloud speaks, silence while paused, and a clean slate on
 * clear. The silent map never creates an audio context at all.
 */
import type { NarrationController, NarrationState } from '@aegis/browser/audio';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameAudio, DUCK_LEVEL } from '../../../src/app/audio/game-audio';
import type { AudioMap } from '../../../src/app/audio/sound-map';
import { STUB_AUDIO_MAP } from '../../../src/app/audio/stub-map';

const MAP: AudioMap = {
  packId: 'ps-audio',
  revision: 'r1',
  effects: [
    { id: 'chime', src: 'assets/audio/sfx/chime.wav', durationMs: 300 },
    { id: 'coin', src: 'assets/audio/sfx/coin.wav', durationMs: 300 },
    { id: 'fanfare', src: 'assets/audio/sfx/fanfare.wav', durationMs: 500 },
    { id: 'star-1', src: 'assets/audio/sfx/star-1.wav', durationMs: 400 },
  ],
  music: [{ id: 'grotto-loop', src: 'assets/audio/music/grotto.wav', durationMs: 30_000 }],
  events: {
    'answer.correct': { sounds: ['chime'], pick: 'first' },
    'coins.earned': { sounds: ['coin'], pick: 'first' },
    'level.completed': { sounds: ['fanfare', 'star-1'], pick: 'sequence' },
  },
  musicStates: { grotto: 'grotto-loop', round: 'grotto-loop', battle: null },
  throttle: { coin: { minIntervalMs: 100, maxConcurrent: 3 } },
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

async function ready(fake: ReturnType<typeof fakeNarration>, now?: () => number) {
  const audio = createGameAudio({
    baseUrl: 'http://localhost/',
    map: MAP,
    narration: fake.factory,
    ...(now ? { now } : {}),
  });
  audio.unlock();
  fake.finishUnlock();
  await flush();
  return audio;
}

afterEach(() => {
  vi.useRealTimers();
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
    expect(fake.calls).toEqual(['music grotto-loop']);
    expect(fake.controller.setAtmosphere).toHaveBeenCalledWith({
      packId: 'ps-audio',
      asset: 'grotto-loop',
      fadeSeconds: 1.2,
    });

    audio.cue('answer.correct');
    audio.cue('coins.earned');
    audio.cue('coins.earned');
    now += 100;
    audio.cue('coins.earned');
    audio.cue('monster.freed');
    await flush();
    expect(fake.calls).toEqual(['music grotto-loop', 'effect chime', 'effect coin', 'effect coin']);
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
    audio.setMusic('unknown-state');
    await flush();
    expect(fake.calls).toEqual(['music grotto-loop', 'music silence']);
  });

  it('plays a sequence on time and drops its rest when cleared', async () => {
    vi.useFakeTimers();
    let now = 0;
    const fake = fakeNarration();
    const audio = await ready(fake, () => now);
    audio.cue('level.completed', { count: 1 });
    await flush();
    expect(fake.calls).toEqual(['effect fanfare']);
    now += 500;
    vi.advanceTimersByTime(500);
    await flush();
    expect(fake.calls).toEqual(['effect fanfare', 'effect star-1']);

    audio.cue('level.completed', { count: 1 });
    audio.clear();
    now += 1000;
    vi.advanceTimersByTime(1000);
    await flush();
    expect(fake.calls).toEqual(['effect fanfare', 'effect star-1', 'effect fanfare', 'clear']);
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
    expect(fake.calls).toEqual(['music grotto-loop', 'pause', 'resume', 'music silence', 'clear']);
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

  it('carries on when the service cannot be created at all', () => {
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
  });
});
