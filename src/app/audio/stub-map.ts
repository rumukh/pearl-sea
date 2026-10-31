/**
 * The silent fallback when S5's audio manifest cannot be read: the same shape with no sounds,
 * so every cue is a no-op and no AudioContext is ever created.
 */
import type { AudioMap } from './sound-map';

export const STUB_AUDIO_MAP: AudioMap = {
  packId: 'ps-audio-silent',
  revision: 'silent-1',
  effects: [],
  music: [],
  events: {},
  musicStates: {},
  throttle: {},
  crossfadeSeconds: 1.2,
};
