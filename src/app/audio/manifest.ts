/**
 * Reads S5's audio manifest (the contract's `AUDIO_MANIFEST_PATH`, `assets/audio/manifest.json`,
 * schema `AUDIO_MANIFEST_SCHEMA`, `pearl-sea-audio-manifest/1`: Dragon Valley's format under this
 * game's name) into the shell's `AudioMap`. Only the fields the shell needs are read; anything
 * malformed is refused, and the game then runs silently rather than half-wired. Sound IDs follow
 * the contract (`AUDIO_ID_PATTERN`): effects are `sfx/<name>`, music loops `music/<loop>`.
 *
 * The manifest:
 *
 * ```json
 * {
 *   "schema": "pearl-sea-audio-manifest/1", "packId": "…", "revision": "…",
 *   "sounds": [{ "id": "sfx/bubble", "src": "assets/audio/sfx/bubble.ogg", "bus": "effects",
 *                "durationSeconds": 0.31 }],
 *   "events": { "answer.correct": { "sounds": ["sfx/chime-1", "sfx/chime-2"], "select": "streak" } },
 *   "music": { "states": { "grotto": "music/grotto", "title": null }, "crossfadeSeconds": 1.2 },
 *   "voices": { "throttle": { "sfx/coin": { "minIntervalMs": 70, "maxConcurrent": 3 } } }
 * }
 * ```
 */
import { AUDIO_MANIFEST_PATH, AUDIO_MANIFEST_SCHEMA } from '../../rules/contract';
import { fetchSiteText } from '../content/site';
import type { Fetcher } from '../content/site';
import { validateAudioMap } from './sound-map';
import { STUB_AUDIO_MAP } from './stub-map';
import type { AudioMap, EventSound, PickPolicy, SoundAsset, SoundThrottle } from './sound-map';

const SELECT_POLICIES: Readonly<Record<string, PickPolicy>> = {
  streak: 'streak',
  sequence: 'sequence',
  amount: 'amount',
  random: 'random',
  cycle: 'cycle',
};

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Audio manifest: ${what} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Audio manifest: ${what} must be text.`);
  }
  return value;
}

function count(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Audio manifest: ${what} must be a non-negative number.`);
  }
  return value;
}

export function parseAudioManifest(input: unknown): AudioMap {
  const manifest = record(input, 'the manifest');
  if (manifest['schema'] !== AUDIO_MANIFEST_SCHEMA) {
    throw new Error(`Audio manifest: expected schema ${AUDIO_MANIFEST_SCHEMA}.`);
  }
  if (!Array.isArray(manifest['sounds'])) throw new Error('Audio manifest: sounds must be a list.');
  const effects: SoundAsset[] = [];
  const music: SoundAsset[] = [];
  for (const [index, entry] of (manifest['sounds'] as unknown[]).entries()) {
    const sound = record(entry, `sounds[${index}]`);
    const asset: SoundAsset = {
      id: text(sound['id'], `sounds[${index}].id`),
      src: text(sound['src'], `sounds[${index}].src`),
      durationMs: Math.round(
        count(sound['durationSeconds'], `sounds[${index}].durationSeconds`) * 1000,
      ),
    };
    const bus = sound['bus'];
    if (bus === 'effects') effects.push(asset);
    else if (bus === 'music') music.push(asset);
    else throw new Error(`Audio manifest: sounds[${index}].bus must be effects or music.`);
  }

  const events: Record<string, EventSound> = {};
  for (const [name, entry] of Object.entries(record(manifest['events'], 'events'))) {
    const event = record(entry, `events.${name}`);
    const sounds = event['sounds'];
    if (!Array.isArray(sounds) || sounds.some((id) => typeof id !== 'string')) {
      throw new Error(`Audio manifest: events.${name}.sounds must list sound IDs.`);
    }
    const select = event['select'];
    const pick = select === undefined ? 'first' : SELECT_POLICIES[String(select)];
    if (!pick) throw new Error(`Audio manifest: events.${name}.select is unknown.`);
    events[name] = { sounds: sounds as string[], pick };
  }

  const musicSection = record(manifest['music'], 'music');
  const musicStates: Record<string, string | null> = {};
  for (const [state, asset] of Object.entries(record(musicSection['states'], 'music.states'))) {
    musicStates[state] = asset === null ? null : text(asset, `music.states.${state}`);
  }
  const crossfadeSeconds = count(musicSection['crossfadeSeconds'] ?? 1.2, 'music.crossfadeSeconds');

  const throttle: Record<string, SoundThrottle> = {};
  const voices = manifest['voices'] === undefined ? {} : record(manifest['voices'], 'voices');
  const limits =
    voices['throttle'] === undefined ? {} : record(voices['throttle'], 'voices.throttle');
  const known = new Set(effects.map((asset) => asset.id));
  for (const [id, entry] of Object.entries(limits)) {
    // Group notes such as "bubble-family" are advice for people, not sound IDs.
    if (!known.has(id)) continue;
    const limit = record(entry, `voices.throttle.${id}`);
    throttle[id] = {
      minIntervalMs: count(limit['minIntervalMs'], `voices.throttle.${id}.minIntervalMs`),
      maxConcurrent: Math.max(
        1,
        count(limit['maxConcurrent'], `voices.throttle.${id}.maxConcurrent`),
      ),
    };
  }

  return validateAudioMap({
    packId: text(manifest['packId'], 'packId'),
    revision: text(manifest['revision'], 'revision'),
    effects,
    music,
    events,
    musicStates,
    throttle,
    crossfadeSeconds,
  });
}

/** S5's manifest as the shell's map, or the silent stub when it cannot be read or trusted. */
export async function loadAudioMap(baseUrl: string, fetcher?: Fetcher): Promise<AudioMap> {
  try {
    const body = await fetchSiteText(baseUrl, AUDIO_MANIFEST_PATH, fetcher);
    return parseAudioManifest(JSON.parse(body) as unknown);
  } catch {
    return STUB_AUDIO_MAP;
  }
}
