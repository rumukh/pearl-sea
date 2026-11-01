/**
 * Watching the page's Web Audio from outside: an init script (`audioProbe`) records every audio
 * context made, every buffer decoded (its length, channels, rate and decoded bytes), every decode
 * that failed, and every buffer source started or stopped, with its length and whether it loops.
 * A sound is known by its length, read from S5's audio manifest (each of its sounds has a
 * different one), so a test never asks the game which sound it meant.
 */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

export interface ManifestSound {
  readonly id: string;
  readonly durationSeconds: number;
  readonly loop: boolean;
  readonly channels: number;
}

export const AUDIO_MANIFEST = JSON.parse(
  readFileSync(new URL('../../../assets/audio/manifest.json', import.meta.url), 'utf8'),
) as { sounds: ManifestSound[]; decoded: { budgetBytes: number } };

export interface Played {
  readonly duration: number;
  readonly loop: boolean;
  /** `performance.now()` in the page (a fixed Date does not stop it). */
  readonly at: number;
}

export interface AudioLog {
  readonly contexts: number;
  readonly decoded: { duration: number; bytes: number; channels: number; rate: number }[];
  readonly started: Played[];
  readonly stopped: Played[];
  readonly failed: string[];
}

/** Runs in the page before the game: records Web Audio. Self-contained (Playwright serialises it). */
export function audioProbe(): void {
  const log: AudioLog = { contexts: 0, decoded: [], started: [], stopped: [], failed: [] };
  Object.defineProperty(window, '__psQaAudio', {
    value: { log: () => JSON.parse(JSON.stringify(log)) as AudioLog },
  });
  // An engine without Web Audio (Playwright's WebKit on Windows) has nothing to watch.
  if (
    typeof AudioContext !== 'function' ||
    typeof BaseAudioContext !== 'function' ||
    typeof AudioBufferSourceNode !== 'function'
  ) {
    return;
  }
  const counts = log as { contexts: number };
  const Original = window.AudioContext;
  window.AudioContext = new Proxy(Original, {
    construct(target, args) {
      counts.contexts += 1;
      return Reflect.construct(target, args) as object;
    },
  });
  const context = BaseAudioContext.prototype;
  const decode = context.decodeAudioData;
  context.decodeAudioData = function (this: BaseAudioContext, ...args: unknown[]) {
    const result = (decode as (...a: unknown[]) => Promise<AudioBuffer>).apply(this, args);
    return result.then(
      (buffer) => {
        log.decoded.push({
          duration: buffer.duration,
          bytes: buffer.length * buffer.numberOfChannels * 4,
          channels: buffer.numberOfChannels,
          rate: buffer.sampleRate,
        });
        return buffer;
      },
      (error: unknown) => {
        log.failed.push(String(error));
        throw error;
      },
    );
  } as typeof context.decodeAudioData;
  const source = AudioBufferSourceNode.prototype;
  const start = source.start;
  source.start = function (this: AudioBufferSourceNode, ...args: unknown[]) {
    log.started.push({
      duration: this.buffer?.duration ?? -1,
      loop: this.loop,
      at: performance.now(),
    });
    return (start as (...a: unknown[]) => void).apply(this, args);
  } as typeof source.start;
  const stop = source.stop;
  source.stop = function (this: AudioBufferSourceNode, ...args: unknown[]) {
    log.stopped.push({
      duration: this.buffer?.duration ?? -1,
      loop: this.loop,
      at: performance.now(),
    });
    return (stop as (...a: unknown[]) => void).apply(this, args);
  } as typeof source.stop;
}

export async function audioLog(page: Page): Promise<AudioLog> {
  return page.evaluate(() =>
    (window as unknown as { __psQaAudio: { log(): AudioLog } }).__psQaAudio.log(),
  );
}

/** The manifest's sound of that length (decoders may round by a sample or two). */
export function soundOf(duration: number): string {
  const found = AUDIO_MANIFEST.sounds.find(
    (sound) => Math.abs(sound.durationSeconds - duration) < 0.05,
  );
  return found?.id ?? `unknown (${duration.toFixed(2)} s)`;
}

export function manifestSound(id: string): ManifestSound {
  const found = AUDIO_MANIFEST.sounds.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`the audio manifest has no ${id}`);
  return found;
}

/** The sounds started so far, by manifest ID, in order. */
export async function startedSounds(page: Page): Promise<string[]> {
  return (await audioLog(page)).started.map((played) => soundOf(played.duration));
}

/** Whether the engine has Web Audio at all (Playwright's WebKit on Windows has none). */
export async function hasWebAudio(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof AudioContext === 'function');
}
