/**
 * Game audio over one SDK narration service (`createNarration`): independent music and effects
 * buses with volumes from the child's preferences, `playEffect` for sound effects,
 * `setAtmosphere` for music states, and the event-to-sound map with overlap throttling.
 *
 * - `unlock()` must run inside a trusted gesture (the first tap or key anywhere); the SDK
 *   creates and resumes the AudioContext before any asynchronous step. The context runs at the
 *   pack's own 48 kHz where the browser allows it (exact loop seams), else at the default.
 * - Nothing plays while paused (visibility or game pause); music returns on resume.
 * - `clear()` at restore and profile switches drops pending and playing sounds, so no one-shot
 *   from a previous child or session can sound later.
 * - Read-aloud lowers the music while the device speaks (`duck`).
 * - Every failure is contained: sound is decoration, and the game works silently. With no
 *   sounds at all (the silent stub) no AudioContext is ever created.
 */
import { createNarration } from '@aegis/browser/audio';
import type { NarrationController, NarrationState } from '@aegis/browser/audio';
import { createSoundPicker, validateAudioMap } from './sound-map';
import type { AudioMap, CueContext } from './sound-map';

export type AudioStatus = 'silent' | 'locked' | 'ready' | 'blocked' | 'unavailable';

export interface GameAudio {
  unlock(): void;
  status(): AudioStatus;
  setVolumes(volumes: { readonly music: number; readonly effects: number }): void;
  cue(event: string, context?: CueContext): void;
  /**
   * Select the music for a screen's mood (`grotto`, `map`, `practice`, `battle`, …), or null for
   * silence. A mood the pack does not list plays the grotto's loop (`musicFor`).
   */
  setMusic(state: string | null): void;
  /** Lower the music while read-aloud speaks. */
  duck(active: boolean): void;
  pause(): void;
  resume(): void;
  clear(): void;
  dispose(): Promise<void>;
}

export interface GameAudioOptions {
  readonly baseUrl: string;
  readonly map: AudioMap;
  readonly now?: () => number;
  readonly random?: () => number;
  /** For tests: a narration controller stand-in. */
  readonly narration?: (onState: (state: NarrationState) => void) => NarrationController;
}

/** Music level while the device speaks, as a share of the chosen music volume. */
export const DUCK_LEVEL = 0.35;
/** S5's pack is mono 48 kHz Ogg (docs/plan.md §10); decoded audio is held at the context rate. */
export const PACK_SAMPLE_RATE = 48_000;
/** The mood whose loop plays for a mood the pack does not list: the home grotto's. */
export const HOME_MUSIC_STATE = 'grotto';

/**
 * The loop for a screen's mood: the pack's own choice (a loop, or null for silence), else the
 * home grotto's loop. S5's slice has grotto, practice and battle loops, and victory is a one-shot
 * sting, so the map, the results and the finale play the grotto until the pack names their own.
 */
export function musicFor(map: AudioMap, state: string): string | null {
  if (Object.hasOwn(map.musicStates, state)) return map.musicStates[state] ?? null;
  return Object.hasOwn(map.musicStates, HOME_MUSIC_STATE)
    ? (map.musicStates[HOME_MUSIC_STATE] ?? null)
    : null;
}

function createContext(): AudioContext {
  try {
    return new AudioContext({ sampleRate: PACK_SAMPLE_RATE, latencyHint: 'interactive' });
  } catch {
    return new AudioContext();
  }
}

export function createGameAudio(options: GameAudioOptions): GameAudio {
  const map = validateAudioMap(options.map);
  const hasSound = map.effects.length > 0 || map.music.length > 0;
  const picker = createSoundPicker(map, {
    now: options.now ?? (() => performance.now()),
    random: options.random ?? Math.random,
  });
  let status: AudioStatus = hasSound ? 'locked' : 'silent';
  let paused = false;
  let ducked = false;
  let music: string | null = null;
  let volumes = { music: 1, effects: 1 };
  let generation = 0;
  let narration: NarrationController | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const onState = (state: NarrationState): void => {
    if (state.status === 'blocked' && status === 'ready') status = 'blocked';
  };
  const ignore = (): void => undefined;

  const ensure = (): NarrationController | undefined => {
    if (!hasSound || status === 'unavailable') return undefined;
    if (!narration) {
      try {
        narration = options.narration
          ? options.narration(onState)
          : createNarration({ baseUrl: options.baseUrl, onState, contextFactory: createContext });
        narration.registerPack({
          id: map.packId,
          revision: map.revision,
          assets: [...map.effects, ...map.music].map(({ id, src }) => ({ id, src })),
          lines: [],
        });
      } catch {
        status = 'unavailable';
        return undefined;
      }
    }
    return narration;
  };

  const applyVolumes = (): void => {
    const controller = ensure();
    if (!controller) return;
    try {
      controller.setVolume('music', ducked ? volumes.music * DUCK_LEVEL : volumes.music);
      controller.setVolume('effects', volumes.effects);
    } catch {
      // A disposed service stays silent.
    }
  };

  const applyMusic = (): void => {
    const controller = ensure();
    if (!controller || status !== 'ready' || paused) return;
    controller
      .setAtmosphere(
        music ? { packId: map.packId, asset: music, fadeSeconds: map.crossfadeSeconds } : null,
      )
      .catch(ignore);
  };

  const play = (sound: string, own: number): void => {
    if (own !== generation || status !== 'ready' || paused) return;
    if (!picker.admit(sound)) return;
    ensure()?.playEffect(map.packId, sound).catch(ignore);
  };

  return {
    unlock() {
      const controller = ensure();
      if (!controller || status === 'ready') return;
      let attempt: Promise<void>;
      try {
        attempt = controller.unlock();
      } catch {
        status = 'unavailable';
        return;
      }
      attempt.then(
        () => {
          status = 'ready';
          applyVolumes();
          if (music !== null) applyMusic();
        },
        () => {
          if (status !== 'unavailable') status = 'blocked';
        },
      );
    },
    status: () => status,
    setVolumes(next) {
      volumes = { music: next.music, effects: next.effects };
      applyVolumes();
    },
    cue(event, context) {
      if (status !== 'ready' || paused) return;
      const own = generation;
      for (const { sound, delayMs } of picker.plan(event, context)) {
        if (delayMs === 0) {
          play(sound, own);
          continue;
        }
        const timer = setTimeout(() => {
          timers.delete(timer);
          play(sound, own);
        }, delayMs);
        timers.add(timer);
      }
    },
    setMusic(state) {
      const next = state === null ? null : musicFor(map, state);
      if (next === music) return;
      music = next;
      applyMusic();
    },
    duck(active) {
      if (ducked === active) return;
      ducked = active;
      applyVolumes();
    },
    pause() {
      if (paused) return;
      paused = true;
      if (narration && status === 'ready') narration.pause();
    },
    resume() {
      if (!paused) return;
      paused = false;
      if (narration && status === 'ready') {
        narration.resume().catch(ignore);
        // The music state may have changed while paused.
        applyMusic();
      }
    },
    clear() {
      generation += 1;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      music = null;
      narration?.clear();
    },
    async dispose() {
      generation += 1;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      await narration?.dispose().catch(ignore);
      narration = undefined;
      status = hasSound ? 'locked' : 'silent';
    },
  };
}
