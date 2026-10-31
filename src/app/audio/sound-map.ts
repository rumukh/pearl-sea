/**
 * Event-to-sound mapping and throttling, independent of Web Audio so it is unit-testable.
 *
 * The map is built from S5's `assets/audio/manifest.json` (`manifest.ts`): the event map, music
 * states and per-sound throttles. Game events (the contract's `EVENTS`: `answer.correct`,
 * `coins.earned`, …) arrive from live runtime commits only, never from replayed history; shell
 * cues use the manifest's `ui.*` and `fx.*` names. Sounds are named by the contract's
 * `AUDIO_ID_PATTERN`: effects `sfx/<name>`, music loops `music/<loop>`.
 *
 * Selection policies: `first`; `streak` (chime n for the n-th correct answer in a row, holding
 * at the last); `amount` (coin for 1-4 coins, coin shower for 5 or more); `sequence` (all in
 * order, each after the previous, or the first plus `count` of the rest, as stars earned);
 * `cycle` and `random` for variants (bubbles, splashes). Overlap control runs when a sound
 * actually starts: each sound's minimum interval and concurrency from the manifest, and a global
 * burst cap.
 */
import { AUDIO_ID_PATTERN } from '../../rules/contract';

export interface SoundAsset {
  /** `sfx/<name>` for an effect, `music/<loop>` for music. */
  readonly id: string;
  /** Path relative to the deployment base, e.g. `assets/audio/sfx/bubble.ogg`. */
  readonly src: string;
  readonly durationMs: number;
}

export type PickPolicy = 'first' | 'cycle' | 'random' | 'streak' | 'sequence' | 'amount';

export interface EventSound {
  readonly sounds: readonly string[];
  readonly pick: PickPolicy;
}

export interface SoundThrottle {
  readonly minIntervalMs: number;
  readonly maxConcurrent: number;
}

export interface AudioMap {
  readonly packId: string;
  readonly revision: string;
  readonly effects: readonly SoundAsset[];
  readonly music: readonly SoundAsset[];
  readonly events: Readonly<Record<string, EventSound>>;
  /** Music state (`title`, `grotto`, `map`, `battle`, …) to a `music/<loop>`, or null for silence. */
  readonly musicStates: Readonly<Record<string, string | null>>;
  readonly throttle: Readonly<Record<string, SoundThrottle>>;
  readonly crossfadeSeconds: number;
}

export interface CueContext {
  readonly streak?: number;
  readonly amount?: number;
  /** For sequences: how many of the follow-up sounds to play (stars earned). */
  readonly count?: number;
}

export interface PlannedSound {
  readonly sound: string;
  readonly delayMs: number;
}

/** A pack ID or revision. */
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SRC = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._/-]+\.(wav|ogg|mp3|m4a|opus)$/;

/** Longest pause between two sounds of a sequence, so a long sound never stalls the next. */
export const MAX_SEQUENCE_GAP_MS = 700;
/** A shower replaces single coins from this amount on. */
export const COIN_SHOWER_AMOUNT = 5;

/**
 * The cue context carried by a game event's payload: `streak` (answers right in a row),
 * `amount` (coins) and `stars` (as the count of star sounds after the fanfare).
 */
export function eventCueContext(data: unknown): CueContext | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const record = data as Record<string, unknown>;
  const number = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const streak = number(record['streak']);
  const amount = number(record['amount']);
  const count = number(record['stars']);
  if (streak === undefined && amount === undefined && count === undefined) return undefined;
  return {
    ...(streak === undefined ? {} : { streak }),
    ...(amount === undefined ? {} : { amount }),
    ...(count === undefined ? {} : { count }),
  };
}

/** Throws a descriptive error when the map refers to something that does not exist. */
export function validateAudioMap(map: AudioMap): AudioMap {
  if (!ID.test(map.packId) || !ID.test(map.revision)) {
    throw new Error('Invalid audio pack identity.');
  }
  const effects = new Set<string>();
  const music = new Set<string>();
  for (const [list, ids, prefix] of [
    [map.effects, effects, 'sfx/'],
    [map.music, music, 'music/'],
  ] as const) {
    for (const asset of list) {
      if (
        !AUDIO_ID_PATTERN.test(asset.id) ||
        !asset.id.startsWith(prefix) ||
        !SRC.test(asset.src)
      ) {
        throw new Error(`Invalid sound ${asset.id}.`);
      }
      if (!(asset.durationMs > 0)) throw new Error(`Sound ${asset.id} has no duration.`);
      if (effects.has(asset.id) || music.has(asset.id)) {
        throw new Error(`Duplicate sound ${asset.id}.`);
      }
      ids.add(asset.id);
    }
  }
  for (const [event, sound] of Object.entries(map.events)) {
    for (const id of sound.sounds) {
      if (!effects.has(id)) throw new Error(`Event ${event} plays unknown effect ${id}.`);
    }
    if (sound.pick === 'amount' && sound.sounds.length !== 2) {
      throw new Error(`Event ${event} needs exactly two sounds for amounts.`);
    }
  }
  for (const [state, id] of Object.entries(map.musicStates)) {
    if (id !== null && !music.has(id)) throw new Error(`Music state ${state} plays unknown ${id}.`);
  }
  for (const [id, throttle] of Object.entries(map.throttle)) {
    if (!(throttle.minIntervalMs >= 0) || !(throttle.maxConcurrent >= 1)) {
      throw new Error(`Throttle for ${id} is invalid.`);
    }
  }
  if (!(map.crossfadeSeconds >= 0 && map.crossfadeSeconds <= 5)) {
    throw new Error('Crossfade must be between 0 and 5 seconds.');
  }
  return map;
}

export interface SoundPicker {
  /** The sounds an event asks for, with start delays; empty for silent or unmapped events. */
  plan(event: string, context?: CueContext): PlannedSound[];
  /** Whether `sound` may start now; records the start when it may. */
  admit(sound: string): boolean;
}

export interface PickerOptions {
  now(): number;
  random(): number;
  maxBurst?: number;
  burstWindowMs?: number;
  defaultMinIntervalMs?: number;
}

export function createSoundPicker(map: AudioMap, options: PickerOptions): SoundPicker {
  const maxBurst = options.maxBurst ?? 6;
  const windowMs = options.burstWindowMs ?? 250;
  const defaultInterval = options.defaultMinIntervalMs ?? 30;
  const durations = new Map(map.effects.map((asset) => [asset.id, asset.durationMs]));
  const starts = new Map<string, number[]>();
  const cycles = new Map<string, number>();
  let recent: number[] = [];

  const one = (sounds: readonly string[], index: number): PlannedSound[] => {
    const sound = sounds[Math.min(Math.max(index, 0), sounds.length - 1)];
    return sound === undefined ? [] : [{ sound, delayMs: 0 }];
  };

  return {
    plan(event, context = {}) {
      const mapped = map.events[event];
      if (!mapped || mapped.sounds.length === 0) return [];
      const { sounds } = mapped;
      switch (mapped.pick) {
        case 'first':
          return one(sounds, 0);
        case 'streak':
          return one(sounds, (context.streak ?? 1) - 1);
        case 'amount':
          return one(sounds, (context.amount ?? 1) >= COIN_SHOWER_AMOUNT ? 1 : 0);
        case 'cycle': {
          const index = (cycles.get(event) ?? 0) % sounds.length;
          cycles.set(event, index + 1);
          return one(sounds, index);
        }
        case 'random':
          return one(sounds, Math.floor(options.random() * sounds.length));
        case 'sequence': {
          const chosen =
            context.count === undefined
              ? sounds
              : sounds.slice(0, 1 + Math.max(0, Math.min(context.count, sounds.length - 1)));
          let delay = 0;
          return chosen.map((sound) => {
            const planned = { sound, delayMs: delay };
            delay += Math.min(durations.get(sound) ?? 0, MAX_SEQUENCE_GAP_MS);
            return planned;
          });
        }
      }
    },
    admit(sound) {
      const now = options.now();
      const rule = map.throttle[sound] ?? { minIntervalMs: defaultInterval, maxConcurrent: 4 };
      const duration = durations.get(sound) ?? 0;
      const keep = Math.max(duration, rule.minIntervalMs);
      const history = (starts.get(sound) ?? []).filter((start) => now - start < keep);
      const last = history[history.length - 1];
      if (last !== undefined && now - last < rule.minIntervalMs) return false;
      const playing = history.filter((start) => now - start < duration);
      if (playing.length >= rule.maxConcurrent) return false;
      recent = recent.filter((time) => now - time < windowMs);
      if (recent.length >= maxBurst) return false;
      history.push(now);
      starts.set(sound, history);
      recent.push(now);
      return true;
    },
  };
}
