/**
 * Watching the page's Web Audio from outside: an init script (`audioProbe`) records every audio
 * context made, every buffer decoded (its length, channels, rate, decoded bytes and the size of the
 * encoded file it came from), every decode that failed, and every buffer source started or
 * stopped, with its length, its file's size and whether it loops. A sound is known by its file:
 * no two of S5's files have the same size, while many effects share a length (#44: pearl-1 to
 * pearl-5 are all 1.0 s). A buffer whose file the probe did not see is known by its length only
 * when a single sound has it. A test never asks the game which sound it meant.
 */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

export interface ManifestSound {
  readonly id: string;
  /** The encoded file, relative to the site's base (`assets/audio/sfx/tap.ogg`). */
  readonly src: string;
  readonly durationSeconds: number;
  readonly loop: boolean;
  readonly channels: number;
  /** The encoded file's size in bytes. */
  readonly bytes: number;
}

export const AUDIO_MANIFEST = JSON.parse(
  readFileSync(new URL('../../../assets/audio/manifest.json', import.meta.url), 'utf8'),
) as { sounds: ManifestSound[]; decoded: { budgetBytes: number } };

export interface Played {
  readonly duration: number;
  /** The size of the encoded file the buffer was decoded from; -1 if the probe did not see it. */
  readonly encoded: number;
  readonly loop: boolean;
  /** `performance.now()` in the page (a fixed Date does not stop it). */
  readonly at: number;
}

export interface Decoded {
  readonly duration: number;
  /** The size of the encoded data handed to `decodeAudioData`; -1 if it was no ArrayBuffer. */
  readonly encoded: number;
  /** Decoded size: 32-bit float samples. */
  readonly bytes: number;
  readonly channels: number;
  readonly rate: number;
}

export interface AudioLog {
  readonly contexts: number;
  readonly decoded: Decoded[];
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
  /** Each decoded buffer's encoded file size, for the sources that play it. */
  const files = new WeakMap<AudioBuffer, number>();
  const context = BaseAudioContext.prototype;
  const decode = context.decodeAudioData;
  context.decodeAudioData = function (this: BaseAudioContext, ...args: unknown[]) {
    // Decoding detaches the encoded data, so its size is read first.
    const data = args[0] as { byteLength?: unknown } | undefined;
    const encoded = typeof data?.byteLength === 'number' ? data.byteLength : -1;
    const result = (decode as (...a: unknown[]) => Promise<AudioBuffer>).apply(this, args);
    return result.then(
      (buffer) => {
        files.set(buffer, encoded);
        log.decoded.push({
          duration: buffer.duration,
          encoded,
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
  const played = (node: AudioBufferSourceNode): Played => ({
    duration: node.buffer?.duration ?? -1,
    encoded: (node.buffer ? files.get(node.buffer) : undefined) ?? -1,
    loop: node.loop,
    at: performance.now(),
  });
  const source = AudioBufferSourceNode.prototype;
  const start = source.start;
  source.start = function (this: AudioBufferSourceNode, ...args: unknown[]) {
    log.started.push(played(this));
    return (start as (...a: unknown[]) => void).apply(this, args);
  } as typeof source.start;
  const stop = source.stop;
  source.stop = function (this: AudioBufferSourceNode, ...args: unknown[]) {
    log.stopped.push(played(this));
    return (stop as (...a: unknown[]) => void).apply(this, args);
  } as typeof source.stop;
}

export async function audioLog(page: Page): Promise<AudioLog> {
  return page.evaluate(() =>
    (window as unknown as { __psQaAudio: { log(): AudioLog } }).__psQaAudio.log(),
  );
}

/**
 * The manifest's sound a buffer came from: the one whose file has the `encoded` size; or, for a
 * buffer whose file is not known (`encoded` -1), the one sound of that length (decoders may round
 * by a sample or two). Several sounds of that length give "one of …", never a guess, and data
 * that is none of the pack's files gives "unknown".
 */
export function soundOf(duration: number, encoded = -1): string {
  const length = `${duration.toFixed(2)} s`;
  if (encoded >= 0) {
    return (
      AUDIO_MANIFEST.sounds.find((sound) => sound.bytes === encoded)?.id ?? `unknown (${length})`
    );
  }
  const alike = AUDIO_MANIFEST.sounds.filter(
    (sound) => Math.abs(sound.durationSeconds - duration) < 0.05,
  );
  if (alike.length === 1) return alike[0]!.id;
  if (alike.length > 1) return `one of ${alike.map((sound) => sound.id).join(', ')} (${length})`;
  return `unknown (${length})`;
}

/** The manifest's sound a recorded buffer, decoded or played, came from (see `soundOf`). */
export function soundIn(record: { readonly duration: number; readonly encoded: number }): string {
  return soundOf(record.duration, record.encoded);
}

export function manifestSound(id: string): ManifestSound {
  const found = AUDIO_MANIFEST.sounds.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`the audio manifest has no ${id}`);
  return found;
}

/** The sounds started so far, by manifest ID, in order. */
export async function startedSounds(page: Page): Promise<string[]> {
  return (await audioLog(page)).started.map(soundIn);
}

/** Whether the engine has Web Audio at all (Playwright's WebKit on Windows has none). */
export async function hasWebAudio(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof AudioContext === 'function');
}
