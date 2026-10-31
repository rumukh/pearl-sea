/**
 * A child's preferences, stored apart from the game save so they can change even while play is
 * blocked (for example after a failed save) and never enter game hashes (presentation is not
 * game state).
 *
 * - `presentation`: the SDK's PresentationPreferences (text size 100-200 %, less motion,
 *   volumes for narration, music and effects).
 * - `readAloud`, `autoRead`, `voice`: the read-aloud button, reading new tasks aloud by itself,
 *   and the chosen local Czech voice (`voiceURI`), or null for the best one available.
 * - `timeLimit`: an optional grown-up limit on one sitting, in minutes (null: none). The shell
 *   ends a round gently when it runs out.
 */
import { isPresentationPreferences } from '@aegis/browser/ui';
import type { PresentationPreferences } from '@aegis/browser/ui';
import { PREFERENCES_GAME_ID } from '../../rules/contract';
import type { RecordDefinition } from './records';

/** Text sizes offered to grown-ups; the SDK accepts any scale from 1 to 2. */
export const TEXT_SCALES = [1, 1.25, 1.5, 2] as const;

/** Sitting limits offered to grown-ups, in minutes. */
export const TIME_LIMITS = [10, 15, 20, 30, 45, 60] as const;
const MIN_TIME_LIMIT = 5;
const MAX_TIME_LIMIT = 120;

export interface ChildPreferences {
  readonly presentation: PresentationPreferences;
  readonly readAloud: boolean;
  readonly autoRead: boolean;
  readonly voice: string | null;
  readonly timeLimit: number | null;
}

/**
 * Volumes start at full scale: the audio pack's mix is baked into its files, and grown-ups turn
 * the buses down from there.
 */
export const DEFAULT_PRESENTATION: PresentationPreferences = {
  locale: 'cs',
  textScale: 1,
  reducedMotion: false,
  comfort: false,
  hideSpoilers: false,
  volumes: { narration: 1, music: 1, effects: 1 },
};

export const DEFAULT_PREFERENCES: ChildPreferences = {
  presentation: DEFAULT_PRESENTATION,
  readAloud: true,
  autoRead: false,
  voice: null,
  timeLimit: null,
};

const MAX_VOICE_LENGTH = 512;
const KEYS = ['presentation', 'readAloud', 'autoRead', 'voice', 'timeLimit'];

export function isChildPreferences(value: unknown): value is ChildPreferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== KEYS.length || !KEYS.every((key) => keys.includes(key))) return false;
  const record = value as Record<string, unknown>;
  const presentation = record['presentation'];
  if (!isPresentationPreferences(presentation)) return false;
  if (Object.keys(presentation).length !== 6) return false;
  if (Object.keys(presentation.volumes).length !== 3) return false;
  const voice = record['voice'];
  const limit = record['timeLimit'];
  return (
    typeof record['readAloud'] === 'boolean' &&
    typeof record['autoRead'] === 'boolean' &&
    (voice === null ||
      (typeof voice === 'string' && voice.length > 0 && voice.length <= MAX_VOICE_LENGTH)) &&
    (limit === null ||
      (typeof limit === 'number' &&
        Number.isInteger(limit) &&
        limit >= MIN_TIME_LIMIT &&
        limit <= MAX_TIME_LIMIT))
  );
}

/** A mutable copy of preferences for an edit. */
export type PreferencesDraft = { -readonly [K in keyof ChildPreferences]: ChildPreferences[K] };

/** A copy with one change applied, validated; throws on an invalid result. */
export function withPreferences(
  current: ChildPreferences,
  change: (draft: PreferencesDraft) => void,
): ChildPreferences {
  const draft = structuredClone(current) as PreferencesDraft;
  change(draft);
  if (!isChildPreferences(draft)) throw new RangeError('Invalid preferences.');
  return draft;
}

export function preferencesRecord(profileId: string): RecordDefinition<ChildPreferences> {
  return {
    kind: 'preferences',
    gameId: PREFERENCES_GAME_ID,
    profileId,
    schemaVersion: 1,
    contentRevision: 'preferences-1',
    isValid: (value) => isChildPreferences(value),
    isCurrent: isChildPreferences,
  };
}
