// @ts-check
/**
 * The audio pack's manifest generator (docs/audio.md):
 *
 *   node scripts/audio/manifest.mjs          write assets/audio/manifest.json
 *   node scripts/audio/manifest.mjs --check  fail when the manifest is stale or a sound breaks a rule
 *
 * The source is assets/audio/recipes/_manifest.json: the sounds with their bus and loudness tier,
 * the advisory events, the music states and the throttles. Every sound file is measured from its
 * own Ogg Vorbis headers, so the manifest's durations and digests always describe the committed
 * bytes. Rules checked for every sound:
 *
 * - the ID follows the contract (`music/<loop>` on the music bus, `sfx/<name>` on effects);
 * - the file is a single Ogg Vorbis stream, mono, at the pack rate (48 kHz), whose only comment is
 *   the encoder tag;
 * - a loop is a whole number of frames at 22.05, 44.1 and 48 kHz, so a decoded loop never drifts;
 * - events and music states name known sounds, and music states name music;
 * - everything decoded at once (each sound as 32-bit float PCM at the pack rate) stays under
 *   DECODED_BUDGET_BYTES, well inside the SDK's 64 MiB decoded-audio budget.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, readJson, repositoryRoot } from '../lib/tools.mjs';
import { readOggVorbis } from './lib/ogg.mjs';

export const MANIFEST_PATH = 'assets/audio/manifest.json';
export const RECIPE_PATH = 'assets/audio/recipes/_manifest.json';
export const MANIFEST_SCHEMA = 'pearl-sea-audio-manifest/1';
export const PACK_SAMPLE_RATE = 48_000;
export const DECODED_BUDGET_BYTES = 48 * 1024 * 1024;
const ID_PATTERN = /^(music|sfx)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE_PATTERN = /^(music|sfx)\/[a-z0-9]+(?:-[a-z0-9]+)*\.ogg$/;
const LOOP_RATES = [22_050, 44_100, 48_000];

/** @param {Uint8Array} bytes */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** @param {number} value */
function seconds(value) {
  return Number(value.toFixed(6));
}

/**
 * @typedef {{ id: string; file: string; bus: 'music' | 'effects'; tier: string; loop: boolean }} RecipeSound
 * @typedef {{ packId: string; sampleRate: number; sounds: RecipeSound[]; events: Record<string, { sounds: string[]; select?: string }>; music: { states: Record<string, string | null>; crossfadeSeconds: number }; voices?: { throttle?: Record<string, { minIntervalMs: number; maxConcurrent: number }> } }} Recipe
 */

/**
 * Builds the manifest from the recipe and the committed sound files.
 *
 * @param {string} [root]
 * @returns {{ manifest: Record<string, unknown>; problems: string[]; decodedBytes: number; soundCount: number }}
 */
export function buildAudioManifest(root = repositoryRoot) {
  /** @type {Recipe} */
  const recipe = readJson(join(root, ...RECIPE_PATH.split('/')));
  /** @type {string[]} */
  const problems = [];
  if (recipe.sampleRate !== PACK_SAMPLE_RATE) {
    problems.push(`The pack rate must be ${PACK_SAMPLE_RATE} Hz, not ${recipe.sampleRate}.`);
  }
  const sounds = [];
  const ids = new Set();
  let decodedBytes = 0;
  for (const sound of [...recipe.sounds].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const where = `Sound ${sound.id}`;
    if (!ID_PATTERN.test(sound.id)) problems.push(`${where}: the ID breaks the contract pattern.`);
    if (ids.has(sound.id)) problems.push(`${where}: listed twice.`);
    ids.add(sound.id);
    const expectedBus = sound.id.startsWith('music/') ? 'music' : 'effects';
    if (sound.bus !== expectedBus) problems.push(`${where}: belongs on the ${expectedBus} bus.`);
    if (sound.loop && sound.bus !== 'music') problems.push(`${where}: only music loops.`);
    if (!sound.loop && sound.bus === 'music') problems.push(`${where}: music must loop.`);
    if (!FILE_PATTERN.test(sound.file))
      problems.push(`${where}: unexpected file name ${sound.file}.`);
    let bytes;
    try {
      bytes = readFileSync(join(root, 'assets', 'audio', ...sound.file.split('/')));
    } catch {
      problems.push(`${where}: missing file assets/audio/${sound.file}.`);
      continue;
    }
    let info;
    try {
      info = readOggVorbis(bytes);
    } catch (error) {
      problems.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (info.streams !== 1) problems.push(`${where}: ${info.streams} logical streams, expected 1.`);
    if (info.channels !== 1) problems.push(`${where}: ${info.channels} channels, expected mono.`);
    if (info.sampleRate !== PACK_SAMPLE_RATE) {
      problems.push(`${where}: ${info.sampleRate} Hz, expected ${PACK_SAMPLE_RATE} Hz.`);
    }
    const extraTags = info.tags.filter((tag) => !/^encoder=/i.test(tag));
    if (extraTags.length > 0) problems.push(`${where}: metadata tags ${extraTags.join(', ')}.`);
    if (sound.loop) {
      for (const rate of LOOP_RATES) {
        if ((info.samples * rate) % info.sampleRate !== 0) {
          problems.push(`${where}: the loop is not a whole number of frames at ${rate} Hz.`);
        }
      }
    }
    decodedBytes +=
      Math.ceil((info.samples * PACK_SAMPLE_RATE) / info.sampleRate) * info.channels * 4;
    sounds.push({
      id: sound.id,
      src: `assets/audio/${sound.file}`,
      bus: sound.bus,
      tier: sound.tier,
      loop: sound.loop,
      durationSeconds: seconds(info.samples / info.sampleRate),
      samples: info.samples,
      sampleRate: info.sampleRate,
      channels: info.channels,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  for (const [name, event] of Object.entries(recipe.events)) {
    for (const id of event.sounds) {
      if (!ids.has(id)) problems.push(`Event ${name} plays unknown ${id}.`);
    }
  }
  for (const [state, id] of Object.entries(recipe.music.states)) {
    if (id !== null && !(ids.has(id) && id.startsWith('music/'))) {
      problems.push(`Music state ${state} plays ${id}, which is not a music loop of the pack.`);
    }
  }
  if (decodedBytes > DECODED_BUDGET_BYTES) {
    problems.push(
      `Decoded audio needs ${decodedBytes} bytes, over the ${DECODED_BUDGET_BYTES}-byte budget.`,
    );
  }
  const revision = `pack-${sha256(new TextEncoder().encode(sounds.map((s) => `${s.id} ${s.sha256}`).join('\n'))).slice(0, 16)}`;
  const manifest = {
    schema: MANIFEST_SCHEMA,
    packId: recipe.packId,
    revision,
    sampleRate: recipe.sampleRate,
    sounds,
    events: recipe.events,
    music: recipe.music,
    voices: recipe.voices ?? { throttle: {} },
    decoded: { bytes: decodedBytes, budgetBytes: DECODED_BUDGET_BYTES },
  };
  return { manifest, problems, decodedBytes, soundCount: sounds.length };
}

/** @param {Record<string, unknown>} manifest */
export function formatManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

if (isMain(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { manifest, problems, decodedBytes, soundCount } = buildAudioManifest();
  const text = formatManifest(manifest);
  const path = join(repositoryRoot, ...MANIFEST_PATH.split('/'));
  if (check) {
    let current = '';
    try {
      current = readFileSync(path, 'utf8');
    } catch {
      problems.push(`${MANIFEST_PATH} is missing.`);
    }
    if (current !== '' && current !== text) {
      problems.push(`${MANIFEST_PATH} is stale: run node scripts/audio/manifest.mjs.`);
    }
  } else if (problems.length === 0) {
    writeFileSync(path, text);
  }
  if (problems.length > 0) {
    console.error(problems.map((problem) => `- ${problem}`).join('\n'));
    process.exit(1);
  }
  const mib = (decodedBytes / (1024 * 1024)).toFixed(1);
  console.log(
    `${check ? 'Checked' : 'Wrote'} ${MANIFEST_PATH}: ${soundCount} sounds, ${mib} MiB decoded.`,
  );
}
